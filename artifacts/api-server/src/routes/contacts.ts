import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, ilike, desc } from "drizzle-orm";
import { db, contactsTable, conversationsTable } from "@workspace/db";
import {
  GetContactsQueryParams,
  GetContactsResponse,
  GetContactParams,
  GetContactResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { computeRelationshipScore, scoreLabel } from "./intelligence";

const router: IRouter = Router();

router.get("/contacts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = GetContactsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const search = parsed.success ? parsed.data.search : undefined;

  const whereConditions = [eq(contactsTable.userId, user.id)];
  if (search) whereConditions.push(ilike(contactsTable.displayName, `%${search}%`));

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(and(...whereConditions))
    .orderBy(desc(contactsTable.lastSeenAt))
    .limit(limit);

  res.json(GetContactsResponse.parse({
    contacts: contacts.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl ?? null,
      platforms: c.platforms ?? [],
      lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      relationshipScore: computeRelationshipScore(
        c.conversationCount,
        c.lastSeenAt,
        (c.platforms ?? []).length,
      ),
      activeConversationCount: c.conversationCount ?? 0,
    })),
    total: contacts.length,
  }));
});

router.get("/contacts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const contact = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.id, rawId), eq(contactsTable.userId, user.id)))
    .limit(1);

  if (!contact[0]) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.userId, user.id), eq(conversationsTable.contactId, rawId)))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(20);

  // Derive active topics from real conversation topic labels
  const activeTopics = [
    ...new Set(
      conversations
        .map((c) => c.topicLabel)
        .filter((t): t is string => Boolean(t)),
    ),
  ].slice(0, 8);

  const score = computeRelationshipScore(
    contact[0].conversationCount,
    contact[0].lastSeenAt,
    (contact[0].platforms ?? []).length,
  );

  res.json(GetContactResponse.parse({
    id: contact[0].id,
    displayName: contact[0].displayName,
    avatarUrl: contact[0].avatarUrl ?? null,
    identities: (contact[0].platforms ?? []).map((p: string) => ({
      platform: p,
      externalId: contact[0].id + "_" + p,
      displayName: contact[0].displayName,
    })),
    recentConversations: conversations.map((c) => ({
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
    relationshipScore: score,
    lastInteractionAt: contact[0].lastSeenAt?.toISOString() ?? null,
    activeTopics,
  }));
});

export default router;
