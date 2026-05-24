import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, ilike } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import {
  GetConversationsQueryParams,
  GetConversationsResponse,
  GetConversationParams,
  GetConversationResponse,
  MarkConversationReadParams,
  MarkConversationReadResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/conversations", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = GetConversationsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;
  const platform = parsed.success ? parsed.data.platform : undefined;
  const priority = parsed.success ? parsed.data.priority : undefined;

  const whereConditions = [eq(conversationsTable.userId, user.id)];
  if (platform) whereConditions.push(eq(conversationsTable.platform, platform));
  if (priority) whereConditions.push(eq(conversationsTable.priority, priority));

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(and(...whereConditions))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: conversationsTable.id })
    .from(conversationsTable)
    .where(and(...whereConditions));

  res.json(GetConversationsResponse.parse({
    conversations: conversations.map((c) => ({
      id: c.id,
      platform: c.platform,
      contactName: c.contactName,
      contactAvatarUrl: c.contactAvatarUrl ?? null,
      contactId: c.contactId ?? null,
      topicLabel: c.topicLabel ?? null,
      headline: c.headline ?? null,
      preview: null,
      priority: c.priority,
      isRead: c.isRead,
      lastMessageAt: c.lastMessageAt.toISOString(),
      unreadCount: c.unreadCount,
    })),
    total: total.length,
    hasMore: offset + conversations.length < total.length,
  }));
});

router.get("/conversations/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const conversation = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, rawId), eq(conversationsTable.userId, user.id)))
    .limit(1);

  if (!conversation[0]) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, rawId))
    .orderBy(messagesTable.sentAt);

  res.json(GetConversationResponse.parse({
    id: conversation[0].id,
    platform: conversation[0].platform,
    contactName: conversation[0].contactName,
    contactAvatarUrl: conversation[0].contactAvatarUrl ?? null,
    contactId: conversation[0].contactId ?? null,
    topicLabel: conversation[0].topicLabel ?? null,
    priority: conversation[0].priority,
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      platform: m.platform,
      direction: m.direction,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml ?? null,
      senderName: m.senderName,
      senderAvatarUrl: m.senderAvatarUrl ?? null,
      headline: m.headline ?? null,
      sentAt: m.sentAt.toISOString(),
      isRead: m.isRead,
    })),
    draftReply: conversation[0].draftReply ?? null,
    relatedConversations: [],
  }));
});

router.post("/conversations/:id/read", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  await db
    .update(conversationsTable)
    .set({ isRead: true, unreadCount: 0 })
    .where(and(eq(conversationsTable.id, rawId), eq(conversationsTable.userId, user.id)));

  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(eq(messagesTable.conversationId, rawId));

  res.json(MarkConversationReadResponse.parse({ status: "ok" }));
});

export default router;
