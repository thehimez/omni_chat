/**
 * Rule-based conversation priority scorer.
 * Runs instantly during sync — no AI calls, no network.
 *
 * Score range: 5–95
 * 70+  → "high"
 * 45–69 → "medium"
 * <45  → "low"
 */

export interface ScoredConversation {
  score: number;
  priority: "high" | "medium" | "low";
  needsReply: boolean;
}

const NEWSLETTER_RE =
  /unsubscribe|newsletter|marketing email|mailing list|opt.?out|promotional/i;
const NOREPLY_RE = /no.?reply|noreply|do.not.reply|donotreply/i;
const AUTOMATED_RE =
  /notification|automated|alert|receipt|invoice|confirm|verify|password|otp|code/i;
const QUESTION_RE = /\?/;

export function scoreConversation(conv: {
  unreadCount: number;
  isRead: boolean;
  lastMessageAt: Date | null;
  headline: string | null;
  topicLabel: string | null;
  contactName: string;
  platform: string;
  providerChatId?: string | null;
}): ScoredConversation {
  let score = 40;

  const text = `${conv.headline ?? ""} ${conv.topicLabel ?? ""}`.toLowerCase();
  const name = conv.contactName.toLowerCase();

  // ── Positive signals ──────────────────────────────────────────────────────

  // Unread messages (each unread = urgency)
  if (conv.unreadCount > 0) {
    score += Math.min(25, conv.unreadCount * 8);
    score += 10; // needs attention bonus
  }

  // Recency
  if (conv.lastMessageAt) {
    const minutesAgo = (Date.now() - conv.lastMessageAt.getTime()) / 60_000;
    if (minutesAgo < 60) score += 20;
    else if (minutesAgo < 360) score += 15;
    else if (minutesAgo < 1440) score += 8;
    else if (minutesAgo < 4320) score += 3;
  }

  // Direct question waiting for answer
  if (QUESTION_RE.test(conv.headline ?? "") || QUESTION_RE.test(conv.topicLabel ?? "")) {
    score += 8;
  }

  // ── Negative signals ──────────────────────────────────────────────────────

  // Newsletter / promotional
  if (NEWSLETTER_RE.test(text)) score -= 30;

  // No-reply senders
  if (NOREPLY_RE.test(name)) score -= 20;

  // Automated / transactional
  if (AUTOMATED_RE.test(text)) score -= 12;

  // Already read with nothing pending
  if (conv.isRead && conv.unreadCount === 0) score -= 10;

  // Group chats (less personal urgency)
  const isGroup = conv.providerChatId?.endsWith("@g.us") ?? false;
  if (isGroup) score -= 8;

  const clamped = Math.max(5, Math.min(95, score));
  const priority: "high" | "medium" | "low" =
    clamped >= 70 ? "high" : clamped >= 45 ? "medium" : "low";

  return {
    score: clamped,
    priority,
    needsReply: conv.unreadCount > 0 && !conv.isRead,
  };
}
