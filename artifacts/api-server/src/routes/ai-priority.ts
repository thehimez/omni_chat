import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, isNull, or, gt } from "drizzle-orm";
import { db, conversationsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { scoreConversation } from "../lib/priority-scorer";
import { logger } from "../lib/logger";
import OpenAI from "openai";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "no-key";
  return new OpenAI({ baseURL, apiKey });
}

async function generateSummary(conv: {
  contactName: string;
  platform: string;
  headline: string | null;
  topicLabel: string | null;
}): Promise<string | null> {
  const msgText = conv.topicLabel || conv.headline || "(no preview)";
  if (msgText === "(no preview)") return null;

  const input = `Contact: ${conv.contactName}\nPlatform: ${conv.platform}\nMessage: ${msgText}`;

  try {
    const openai = getOpenAIClient();
    const resp = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 60,
      messages: [
        {
          role: "system",
          content: `You write one-sentence inbox summaries for a business messaging app.
Write exactly ONE sentence (max 12 words) describing what action or content is in this conversation.
Start with an active verb: "Wants", "Sent", "Shared", "Asked about", "Waiting for", "Needs", "Requested", etc.
Be specific to the actual topic. Never generic. No quotes, no punctuation at end.`,
        },
        { role: "user", content: input },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    logger.error({ err: e }, "ai-priority: generateSummary failed");
    return null;
  }
}

/**
 * POST /api/ai/prioritize
 *
 * Step 1: Rule-based score all unscored conversations (instant, no AI).
 * Step 2: AI-summarize the top 30 unsummarized conversations.
 *
 * Returns { scored, summarized } — safe to call repeatedly (idempotent).
 */
router.post(
  "/ai/prioritize",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;

    // ── Step 1: Score unscored conversations ─────────────────────────────────
    const unscored = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.userId, user.id),
          isNull(conversationsTable.aiPriorityScore),
        ),
      );

    for (const conv of unscored) {
      const { score, priority, needsReply } = scoreConversation({
        unreadCount: conv.unreadCount,
        isRead: conv.isRead,
        lastMessageAt: conv.lastMessageAt,
        headline: conv.headline,
        topicLabel: conv.topicLabel,
        contactName: conv.contactName,
        platform: conv.platform,
        providerChatId: conv.providerChatId,
      });
      await db
        .update(conversationsTable)
        .set({ aiPriorityScore: score, priority, needsReply })
        .where(eq(conversationsTable.id, conv.id));
    }

    logger.info(
      { userId: user.id, count: unscored.length },
      "ai-priority: scored conversations",
    );

    // ── Step 2: AI-summarize top 30 unsummarized ──────────────────────────────
    const unsummarized = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.userId, user.id),
          isNull(conversationsTable.aiSummary),
        ),
      )
      .orderBy(
        desc(conversationsTable.aiPriorityScore),
        desc(conversationsTable.lastMessageAt),
      )
      .limit(30);

    let summarized = 0;

    // Process in batches of 5 (parallel within batch, sequential batches)
    for (let i = 0; i < unsummarized.length; i += 5) {
      const batch = unsummarized.slice(i, i + 5);
      await Promise.all(
        batch.map(async (conv) => {
          const summary = await generateSummary(conv);
          if (summary) {
            await db
              .update(conversationsTable)
              .set({ aiSummary: summary })
              .where(eq(conversationsTable.id, conv.id));
            summarized++;
          }
        }),
      );
    }

    logger.info(
      { userId: user.id, summarized },
      "ai-priority: summarized conversations",
    );

    res.json({ ok: true, scored: unscored.length, summarized });
  },
);

/**
 * GET /api/ai/prioritize/status
 * Returns counts so the frontend can show a progress indicator.
 */
router.get(
  "/ai/prioritize/status",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;

    const [totalRows, unscoredRows, unsummarizedRows] = await Promise.all([
      db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(eq(conversationsTable.userId, user.id)),
      db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.userId, user.id),
            isNull(conversationsTable.aiPriorityScore),
          ),
        ),
      db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.userId, user.id),
            isNull(conversationsTable.aiSummary),
          ),
        ),
    ]);

    res.json({
      total: totalRows.length,
      unscored: unscoredRows.length,
      unsummarized: unsummarizedRows.length,
    });
  },
);

export default router;
