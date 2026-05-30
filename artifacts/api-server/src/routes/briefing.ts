import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, ne } from "drizzle-orm";
import { db, conversationsTable } from "@workspace/db";
import { GetBriefingResponse } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/briefing", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const hour = new Date().getHours();
  let timeOfDay = "morning";
  if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
  else if (hour >= 17 && hour < 21) timeOfDay = "evening";
  else if (hour >= 21 || hour < 5) timeOfDay = "night";

  const firstName = user.firstName ?? user.email.split("@")[0];
  const greetings: Record<string, string> = {
    morning: `Good morning, ${firstName}.`,
    afternoon: `Good afternoon, ${firstName}.`,
    evening: `Good evening, ${firstName}.`,
    night: `Working late, ${firstName}.`,
  };
  const greeting = greetings[timeOfDay] ?? `Hello, ${firstName}.`;

  // Fetch recent conversations for stats
  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, user.id))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(100);

  // Fetch AI-detected action items (unseen only), sorted by score
  const actionItems = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.userId, user.id),
        eq(conversationsTable.aiActionRequired, true),
        ne(conversationsTable.aiActionStatus, "seen"),
      ),
    )
    .orderBy(desc(conversationsTable.aiActionScore))
    .limit(5);

  const unreadCount = conversations.filter((c) => !c.isRead).length;
  const actionCount = actionItems.length;

  const topPriority = actionItems.map((c) => ({
    id: c.id,
    platform: c.platform,
    contactName: c.contactName,
    contactAvatarUrl: c.contactAvatarUrl ?? null,
    contactId: c.contactId ?? null,
    topicLabel: c.aiTopicLabel ?? c.topicLabel ?? null,
    headline: c.headline ?? null,
    preview: null,
    priority: "urgent",
    isRead: c.isRead,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unreadCount: c.unreadCount,
    aiActionScore: c.aiActionScore ?? null,
    aiActionLabel: c.aiActionLabel ?? null,
    aiTopicLabel: c.aiTopicLabel ?? null,
  }));

  let inboxState = "clear";
  if (unreadCount > 20) inboxState = "busy";
  else if (unreadCount > 5) inboxState = "active";

  const xanSummary = conversations.length === 0
    ? "Your inbox is empty. Connect your accounts to get started."
    : actionCount > 0
    ? `You have ${actionCount} message${actionCount === 1 ? "" : "s"} that need${actionCount === 1 ? "s" : ""} your attention.`
    : unreadCount > 0
    ? `You have ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}. No action required.`
    : "You're all caught up. No action items.";

  res.json(GetBriefingResponse.parse({
    greeting,
    timeOfDay,
    newMessageCount: unreadCount,
    activeConversationCount: conversations.length,
    inboxState,
    xanSummary,
    unansweredCount: actionCount,
    topPriorityConversations: topPriority,
  }));
});

export default router;
