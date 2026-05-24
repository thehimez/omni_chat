import { Router, type IRouter, type Request, type Response } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, messagesTable, conversationsTable } from "@workspace/db";
import { SemanticSearchBody, SemanticSearchResponse } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.post("/search", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = SemanticSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, platform, limit = 20 } = parsed.data;

  const messages = await db
    .select({
      message: messagesTable,
      conversation: conversationsTable,
    })
    .from(messagesTable)
    .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
    .where(
      or(
        ilike(messagesTable.bodyText, `%${query}%`),
        ilike(conversationsTable.contactName, `%${query}%`)
      )
    )
    .limit(limit ?? 20);

  const filteredMessages = platform
    ? messages.filter((r) => r.message.platform === platform)
    : messages;

  res.json(SemanticSearchResponse.parse({
    results: filteredMessages
      .filter((r) => r.conversation.userId === user.id)
      .map((r) => ({
        conversationId: r.message.conversationId,
        messageId: r.message.id,
        platform: r.message.platform,
        contactName: r.conversation.contactName,
        snippet: r.message.bodyText.slice(0, 200),
        relevanceScore: 0.9,
        matchedAt: r.message.sentAt.toISOString(),
      })),
    total: filteredMessages.length,
  }));
});

export default router;
