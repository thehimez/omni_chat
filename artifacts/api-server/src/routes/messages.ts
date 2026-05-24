import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, conversationsTable, messagesTable, connectedAccountsTable } from "@workspace/db";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/messages/send", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { conversationId, platform, body, accountId } = parsed.data;

  const conversation = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.userId, user.id)))
    .limit(1);

  if (!conversation[0]) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  let sentMessageId: string | null = null;

  try {
    if (platform === "slack") {
      const slackToken = process.env.SLACK_BOT_TOKEN;
      if (!slackToken) {
        res.status(503).json({ error: "Slack not configured" });
        return;
      }
      const channel = conversation[0].externalId ?? "";
      const slackResp = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel, text: body }),
      });
      const slackData = await slackResp.json() as { ok: boolean; ts?: string };
      if (slackData.ok) sentMessageId = slackData.ts ?? null;
    } else {
      const unipileApiKey = process.env.UNIPILE_API_KEY;
      const unipileHost = process.env.UNIPILE_HOST ?? "api19.unipile.com:14946";
      if (!unipileApiKey) {
        res.status(503).json({ error: "Unipile not configured" });
        return;
      }
      const unipileResp = await fetch(`https://${unipileHost}/api/v1/chats/${conversation[0].externalId}/messages`, {
        method: "POST",
        headers: {
          "X-API-KEY": unipileApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: body }),
      });
      if (unipileResp.ok) {
        const unipileData = await unipileResp.json() as { id?: string };
        sentMessageId = unipileData.id ?? null;
      }
    }
  } catch (err) {
    req.log.error({ err }, "Send message error");
  }

  const newMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.insert(messagesTable).values({
    id: newMsgId,
    conversationId,
    userId: user.id,
    platform,
    externalId: sentMessageId,
    direction: "outbound",
    bodyText: body,
    senderName: user.firstName ?? user.email,
    isRead: true,
    sentAt: new Date(),
  });

  await db
    .update(conversationsTable)
    .set({ lastMessageAt: new Date(), draftReply: null })
    .where(eq(conversationsTable.id, conversationId));

  res.json(SendMessageResponse.parse({ success: true, messageId: newMsgId }));
});

export default router;
