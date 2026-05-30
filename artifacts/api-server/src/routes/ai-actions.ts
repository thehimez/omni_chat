/**
 * AI Action Inbox routes
 *
 * POST /api/ai/analyze   — Batch-analyze pending conversations with the Action
 *                          Detection Agent.  Runs asynchronously; UI reads
 *                          stored column values — NOT called on page load.
 *
 * POST /api/ai/analyze/:id — Analyze a single conversation immediately
 *                            (used after webhook / new message arrives).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, or, isNull, lt, desc } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { analyzeConversation } from "../lib/action-analyzer";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Run analysis for a single conversation ID ─────────────────────────────────

export async function analyzeOne(
  conversationId: string,
  userId: string,
): Promise<void> {
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, conversationId),
        eq(conversationsTable.userId, userId),
      ),
    )
    .limit(1);

  if (!conv) return;

  const result = await analyzeConversation({
    contactName: conv.contactName,
    platform: conv.platform,
    headline: conv.headline,
    topicLabel: conv.topicLabel,
    needsReply: conv.needsReply,
    providerChatId: conv.providerChatId,
    unreadCount: conv.unreadCount,
  });

  const now = new Date();

  // When a conversation already has aiActionStatus="seen" and we're re-analyzing
  // (because a new message arrived), reset it to "active" so it re-appears.
  const newStatus =
    result.actionRequired && conv.aiActionStatus === "seen"
      ? "active"
      : conv.aiActionStatus;

  await db
    .update(conversationsTable)
    .set({
      aiActionRequired: result.actionRequired,
      aiActionLabel: result.actionLabel,
      aiActionScore: result.actionScore,
      aiActionReason: result.actionReason,
      aiTopicLabel: result.topicLabel ?? conv.aiTopicLabel,
      aiLastAnalyzedAt: now,
      aiActionStatus: newStatus,
    })
    .where(eq(conversationsTable.id, conversationId));
}

// ── POST /api/ai/analyze  (batch — analyzes pending conversations) ─────────────

router.post(
  "/api/ai/analyze",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;

    // Conversations that need (re-)analysis:
    //   ai_last_analyzed_at IS NULL   → never analyzed
    //   ai_last_analyzed_at < last_message_at  → new message arrived since analysis
    const pending = await db
      .select({
        id: conversationsTable.id,
        contactName: conversationsTable.contactName,
        platform: conversationsTable.platform,
        headline: conversationsTable.headline,
        topicLabel: conversationsTable.topicLabel,
        needsReply: conversationsTable.needsReply,
        providerChatId: conversationsTable.providerChatId,
        unreadCount: conversationsTable.unreadCount,
        aiActionStatus: conversationsTable.aiActionStatus,
        aiLastAnalyzedAt: conversationsTable.aiLastAnalyzedAt,
        lastMessageAt: conversationsTable.lastMessageAt,
      })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.userId, user.id),
          or(
            isNull(conversationsTable.aiLastAnalyzedAt),
            lt(conversationsTable.aiLastAnalyzedAt, conversationsTable.lastMessageAt),
          ),
        ),
      )
      .orderBy(desc(conversationsTable.lastMessageAt))
      .limit(30);

    res.json({ status: "started", pending: pending.length });

    // Run analysis in background — do not block the HTTP response
    const CONCURRENCY = 5;
    const chunks: typeof pending[] = [];
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      chunks.push(pending.slice(i, i + CONCURRENCY));
    }

    (async () => {
      let analyzed = 0;
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (conv) => {
            try {
              const result = await analyzeConversation({
                contactName: conv.contactName,
                platform: conv.platform,
                headline: conv.headline,
                topicLabel: conv.topicLabel,
                needsReply: conv.needsReply,
                providerChatId: conv.providerChatId,
                unreadCount: conv.unreadCount,
              });

              const now = new Date();
              const newStatus =
                result.actionRequired && conv.aiActionStatus === "seen"
                  ? "active"
                  : conv.aiActionStatus;

              await db
                .update(conversationsTable)
                .set({
                  aiActionRequired: result.actionRequired,
                  aiActionLabel: result.actionLabel,
                  aiActionScore: result.actionScore,
                  aiActionReason: result.actionReason,
                  aiTopicLabel:
                    result.topicLabel ?? conv.topicLabel,
                  aiLastAnalyzedAt: now,
                  aiActionStatus: newStatus,
                })
                .where(eq(conversationsTable.id, conv.id));

              analyzed++;
            } catch (e) {
              logger.error(
                { err: e, conversationId: conv.id },
                "ai-actions: failed to analyze conversation",
              );
            }
          }),
        );
      }
      logger.info({ analyzed, total: pending.length }, "ai-actions: batch complete");
    })();
  },
);

// ── POST /api/ai/analyze/:id  (single conversation — called from webhook) ─────

router.post(
  "/api/ai/analyze/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    res.json({ status: "started" });

    // Run in background
    analyzeOne(rawId, user.id).catch((e) =>
      logger.error({ err: e, conversationId: rawId }, "ai-actions: single analyze failed"),
    );
  },
);

export default router;
