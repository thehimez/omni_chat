import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, xanMessagesTable, conversationsTable, messagesTable } from "@workspace/db";
import {
  ChatWithXanBody,
  ChatWithXanResponse,
  RegenerateDraftParams,
  RegenerateDraftResponse,
  GetXanHistoryQueryParams,
  GetXanHistoryResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "AI assistant is not configured. Please add your OpenAI API key.";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1000,
    }),
  });

  if (!resp.ok) {
    logger.error({ status: resp.status }, "OpenAI API error");
    return "I encountered an error while processing your request. Please try again.";
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "No response generated.";
}

router.post("/xan/chat", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = ChatWithXanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, conversationId } = parsed.data;

  const history = await db
    .select()
    .from(xanMessagesTable)
    .where(eq(xanMessagesTable.userId, user.id))
    .orderBy(desc(xanMessagesTable.createdAt))
    .limit(10);

  const systemPrompt = `You are Xan, an AI assistant built into the Xanda Cross unified inbox platform. You help users manage their communications across Gmail, Outlook, WhatsApp, LinkedIn, Instagram, Telegram, and Slack. You can summarize conversations, suggest replies, prioritize messages, and answer questions about the user's inbox. Be concise, helpful, and professional. Today's date: ${new Date().toDateString()}.`;

  const contextualMessage = conversationId
    ? `[Context: User is viewing conversation ${conversationId}]\n\n${message}`
    : message;

  const response = await callOpenAI(systemPrompt, contextualMessage);

  const msgId = `xan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const assistantId = `xan_${Date.now() + 1}_${Math.random().toString(36).slice(2, 9)}`;

  await db.insert(xanMessagesTable).values([
    { id: msgId, userId: user.id, role: "user", content: message, conversationId: conversationId ?? null },
    { id: assistantId, userId: user.id, role: "assistant", content: response, conversationId: conversationId ?? null },
  ]);

  res.json(ChatWithXanResponse.parse({
    response,
    type: "text",
    relatedConversations: [],
    draft: null,
  }));
});

router.post("/xan/draft/:conversationId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;

  const conversation = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, rawId))
    .limit(1);

  if (!conversation[0] || conversation[0].userId !== user.id) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const recentMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, rawId))
    .orderBy(desc(messagesTable.sentAt))
    .limit(5);

  const messageContext = recentMessages
    .reverse()
    .map((m) => `${m.senderName} (${m.direction}): ${m.bodyText}`)
    .join("\n");

  const systemPrompt = `You are Xan, an AI assistant for the Xanda Cross inbox platform. Generate a concise, professional reply draft for the following conversation. Match the tone of the conversation. Output only the draft reply text, nothing else.`;
  const prompt = `Platform: ${conversation[0].platform}\nContact: ${conversation[0].contactName}\n\nRecent messages:\n${messageContext}\n\nWrite a reply:`;

  const draft = await callOpenAI(systemPrompt, prompt);

  await db
    .update(conversationsTable)
    .set({ draftReply: draft })
    .where(eq(conversationsTable.id, rawId));

  res.json(RegenerateDraftResponse.parse({ draft, conversationId: rawId }));
});

router.get("/xan/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = GetXanHistoryQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;

  const messages = await db
    .select()
    .from(xanMessagesTable)
    .where(eq(xanMessagesTable.userId, user.id))
    .orderBy(desc(xanMessagesTable.createdAt))
    .limit(limit);

  res.json(GetXanHistoryResponse.parse({
    messages: messages.reverse().map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  }));
});

export default router;
