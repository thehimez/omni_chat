import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
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

// WhatsApp ghost-conversation filter.
// Hides WhatsApp DM conversations that have zero messages and zero unread — these are
// chats updated by reactions, calls, or protocol events with no readable content.
// Matches WhatsApp Web behaviour. Data is never deleted; only hidden from the list view.
// A conversation re-appears automatically the moment a real message is stored.
const hideWhatsAppGhosts = sql`NOT (
  conversations.platform = 'whatsapp'
  AND COALESCE(conversations.provider_chat_id, '') NOT LIKE '%@g.us'
  AND COALESCE(conversations.provider_chat_id, '') NOT LIKE '%@newsletter'
  AND COALESCE(conversations.provider_chat_id, '') <> '0@s.whatsapp.net'
  AND conversations.unread_count = 0
  AND NOT EXISTS (
    SELECT 1 FROM messages WHERE messages.conversation_id = conversations.id
  )
)`;

router.get("/conversations", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = GetConversationsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;
  const platform = parsed.success ? parsed.data.platform : undefined;
  const priority = parsed.success ? parsed.data.priority : undefined;

  const whereConditions = [eq(conversationsTable.userId, user.id), hideWhatsAppGhosts];
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
      preview: c.headline ?? null,
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
