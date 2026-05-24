import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, count } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
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

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, user.id))
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(50);

  const unreadCount = conversations.filter((c) => !c.isRead).length;
  const unansweredCount = conversations.filter(
    (c) => !c.isRead && c.priority === "high" || c.priority === "urgent"
  ).length;

  const topPriority = conversations
    .filter((c) => c.priority === "urgent" || c.priority === "high")
    .slice(0, 5)
    .map((c) => ({
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
    }));

  let inboxState = "clear";
  if (unreadCount > 20) inboxState = "busy";
  else if (unreadCount > 5) inboxState = "active";

  const xanSummary = conversations.length === 0
    ? "Your inbox is empty. Connect your accounts to get started."
    : unreadCount > 0
    ? `You have ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}.${unansweredCount > 0 ? ` ${unansweredCount} need${unansweredCount === 1 ? "s" : ""} your attention.` : ""}`
    : "You're all caught up.";

  res.json(GetBriefingResponse.parse({
    greeting,
    timeOfDay,
    newMessageCount: unreadCount,
    activeConversationCount: conversations.length,
    inboxState,
    xanSummary,
    unansweredCount,
    topPriorityConversations: topPriority,
  }));
});

export default router;
