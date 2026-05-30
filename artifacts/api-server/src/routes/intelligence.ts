import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  contactsTable,
  conversationsTable,
  messagesTable,
  contactAiSummaryTable,
  contactFactsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import OpenAI from "openai";
import { backfillContactsForUser } from "../lib/contact-linker";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "no-key";
  return new OpenAI({ baseURL, apiKey });
}

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const resp = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    const content = resp.choices[0]?.message?.content;
    if (!content || content.trim() === "") {
      logger.warn({ finish_reason: resp.choices[0]?.finish_reason }, "OpenAI returned empty content");
      throw new Error(`Empty response from model (finish_reason: ${resp.choices[0]?.finish_reason})`);
    }
    return content;
  } catch (err) {
    logger.error({ err }, "OpenAI error in intelligence route");
    throw err;
  }
}

// ── Relationship score computation ────────────────────────────────────────────

function computeRelationshipScore(
  conversationCount: number,
  lastSeenAt: Date | null,
  platformCount: number,
): number {
  if (conversationCount === 0) return 0;

  // Recency score (0-40): decay over 90 days
  let recencyScore = 0;
  if (lastSeenAt) {
    const daysSince = (Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, 40 - Math.floor(daysSince / 2.25));
  }

  // Volume score (0-40): log scale up to 20+ conversations
  const volumeScore = Math.min(40, Math.floor(Math.log2(conversationCount + 1) * 12));

  // Platform diversity score (0-20): bonus for cross-platform engagement
  const platformScore = Math.min(20, (platformCount - 1) * 7);

  return Math.min(100, recencyScore + volumeScore + platformScore);
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Very Strong";
  if (score >= 50) return "Strong";
  if (score >= 25) return "Growing";
  return "Weak";
}

// ── GET /contacts/:id/timeline ─────────────────────────────────────────────────

router.get("/contacts/:id/timeline", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const limitParam = parseInt((req.query.limit as string) ?? "100", 10);

  const convs = await db
    .select({ id: conversationsTable.id, platform: conversationsTable.platform, topicLabel: conversationsTable.topicLabel })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.userId, user.id), eq(conversationsTable.contactId, contactId)));

  if (convs.length === 0) {
    res.json({ events: [] });
    return;
  }

  const convIds = convs.map((c) => c.id);
  const platformMap = new Map(convs.map((c) => [c.id, { platform: c.platform, topicLabel: c.topicLabel }]));

  const messages = await db
    .select()
    .from(messagesTable)
    .where(inArray(messagesTable.conversationId, convIds))
    .orderBy(desc(messagesTable.sentAt))
    .limit(limitParam);

  const events = messages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    platform: platformMap.get(m.conversationId)?.platform ?? m.platform,
    topicLabel: platformMap.get(m.conversationId)?.topicLabel ?? null,
    direction: m.direction,
    bodyText: m.bodyText,
    senderName: m.senderName,
    sentAt: m.sentAt.toISOString(),
  }));

  res.json({ events });
});

// ── GET /contacts/:id/facts ────────────────────────────────────────────────────

router.get("/contacts/:id/facts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const facts = await db
    .select()
    .from(contactFactsTable)
    .where(and(eq(contactFactsTable.userId, user.id), eq(contactFactsTable.contactId, contactId)))
    .orderBy(contactFactsTable.createdAt);

  res.json({ facts: facts.map((f) => ({ ...f, confidence: f.confidence ?? null })) });
});

// ── POST /contacts/:id/facts ───────────────────────────────────────────────────

router.post("/contacts/:id/facts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const body = req.body as { id?: string; factType?: string; label?: string; value?: string };
  if (!body.factType || !body.label || !body.value) { res.status(400).json({ error: "factType, label, and value are required" }); return; }

  const { id: factId, factType, label, value } = body as Required<typeof body>;
  const newId = factId ?? `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db
    .insert(contactFactsTable)
    .values({ id: newId, userId: user.id, contactId, factType, label, value, source: "user_written" })
    .onConflictDoUpdate({ target: contactFactsTable.id, set: { label, value, updatedAt: new Date() } });

  const fact = await db.select().from(contactFactsTable).where(eq(contactFactsTable.id, newId)).limit(1);
  res.json({ fact: fact[0] });
});

// ── DELETE /contacts/:id/facts/:factId ────────────────────────────────────────

router.delete("/contacts/:id/facts/:factId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const factId = Array.isArray(req.params.factId) ? req.params.factId[0] : req.params.factId;

  await db
    .delete(contactFactsTable)
    .where(and(eq(contactFactsTable.id, factId), eq(contactFactsTable.userId, user.id)));

  res.json({ ok: true });
});

// ── POST /contacts/:id/intelligence/memory ────────────────────────────────────

router.post("/contacts/:id/intelligence/memory", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const conversationId = (req.body as any)?.conversationId ?? null;

  // Check cache (3h TTL)
  const cacheKey = conversationId ?? contactId;
  const cached = await db
    .select()
    .from(contactAiSummaryTable)
    .where(
      and(
        eq(contactAiSummaryTable.userId, user.id),
        eq(contactAiSummaryTable.contactId, contactId),
        eq(contactAiSummaryTable.summaryType, "memory_card"),
        conversationId
          ? eq(contactAiSummaryTable.conversationId, conversationId)
          : eq(contactAiSummaryTable.conversationId, ""),
      )
    )
    .limit(1);

  if (cached[0] && cached[0].expiresAt > new Date()) {
    try {
      res.json({ card: JSON.parse(cached[0].content), cached: true });
      return;
    } catch { /* fall through to regenerate */ }
  }

  // Load contact
  const contact = await db.select().from(contactsTable)
    .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, user.id))).limit(1);
  if (!contact[0]) { res.status(404).json({ error: "Contact not found" }); return; }

  // Load recent messages for this conversation (or all conversations for this contact)
  let messageContext = "";
  if (conversationId) {
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.sentAt)).limit(20);
    messageContext = msgs.reverse().map((m) => `${m.senderName} (${m.direction}): ${m.bodyText}`).join("\n");
  } else {
    const convs = await db.select({ id: conversationsTable.id }).from(conversationsTable)
      .where(and(eq(conversationsTable.userId, user.id), eq(conversationsTable.contactId, contactId))).limit(5);
    if (convs.length > 0) {
      const msgs = await db.select().from(messagesTable)
        .where(inArray(messagesTable.conversationId, convs.map((c) => c.id)))
        .orderBy(desc(messagesTable.sentAt)).limit(20);
      messageContext = msgs.reverse().map((m) => `${m.senderName} (${m.direction}): ${m.bodyText}`).join("\n");
    }
  }

  // Load existing facts
  const facts = await db.select().from(contactFactsTable)
    .where(and(eq(contactFactsTable.userId, user.id), eq(contactFactsTable.contactId, contactId)));
  const factsContext = facts.map((f) => `${f.label}: ${f.value}`).join(", ");

  const systemPrompt = `You are Xan, an AI assistant for the Xanda Cross unified inbox. Analyze the conversation and return a JSON memory card. Return ONLY valid JSON, no markdown, no explanation.

The JSON must have exactly these fields:
{
  "lastDiscussed": "brief topic summary (1 sentence)",
  "importantFacts": ["fact 1", "fact 2", "fact 3"],
  "openItems": ["item 1", "item 2"],
  "suggestedFollowUp": "one specific follow-up suggestion"
}

Rules:
- importantFacts: 1-4 key personal/professional facts about the contact
- openItems: 0-3 unresolved action items or pending things
- Keep everything concise and actionable
- If there is not enough data, make importantFacts and openItems empty arrays
- Never invent facts not supported by the conversation`;

  const prompt = `Contact: ${contact[0].displayName}\nPlatforms: ${(contact[0].platforms ?? []).join(", ")}\nKnown facts: ${factsContext || "none"}\n\nRecent messages:\n${messageContext || "(no messages yet)"}`;

  let card: Record<string, unknown>;
  let aiSuccess = false;
  try {
    const raw = await callOpenAI(systemPrompt, prompt);
    card = JSON.parse(raw);
    aiSuccess = true;
  } catch (err) {
    logger.error({ err }, "Failed to generate or parse memory card");
    card = {
      lastDiscussed: "No context yet — try opening a conversation first.",
      importantFacts: [],
      openItems: [],
      suggestedFollowUp: "",
    };
  }

  // Only cache successful AI responses — failures should retry next time
  if (aiSuccess) {
    const summaryId = `ais_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3h
    if (cached[0]) {
      await db.update(contactAiSummaryTable)
        .set({ content: JSON.stringify(card), generatedAt: new Date(), expiresAt })
        .where(eq(contactAiSummaryTable.id, cached[0].id));
    } else {
      await db.insert(contactAiSummaryTable).values({
        id: summaryId,
        userId: user.id,
        contactId,
        conversationId: conversationId ?? "",
        summaryType: "memory_card",
        content: JSON.stringify(card),
        expiresAt,
      });
    }
  }

  res.json({ card, cached: false });
});

// ── POST /contacts/:id/intelligence/meeting-prep ──────────────────────────────

router.post("/contacts/:id/intelligence/meeting-prep", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Check cache (24h TTL for meeting prep)
  const cached = await db.select().from(contactAiSummaryTable)
    .where(and(
      eq(contactAiSummaryTable.userId, user.id),
      eq(contactAiSummaryTable.contactId, contactId),
      eq(contactAiSummaryTable.summaryType, "meeting_prep"),
    )).limit(1);

  if (cached[0] && cached[0].expiresAt > new Date()) {
    try {
      res.json({ brief: JSON.parse(cached[0].content), cached: true });
      return;
    } catch { /* regenerate */ }
  }

  const contact = await db.select().from(contactsTable)
    .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, user.id))).limit(1);
  if (!contact[0]) { res.status(404).json({ error: "Contact not found" }); return; }

  const convs = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.userId, user.id), eq(conversationsTable.contactId, contactId)))
    .orderBy(desc(conversationsTable.lastMessageAt)).limit(5);

  let messageContext = "";
  if (convs.length > 0) {
    const msgs = await db.select().from(messagesTable)
      .where(inArray(messagesTable.conversationId, convs.map((c) => c.id)))
      .orderBy(desc(messagesTable.sentAt)).limit(30);
    messageContext = msgs.reverse().map((m) => `[${m.platform}] ${m.senderName} (${m.direction}): ${m.bodyText}`).join("\n");
  }

  const facts = await db.select().from(contactFactsTable)
    .where(and(eq(contactFactsTable.userId, user.id), eq(contactFactsTable.contactId, contactId)));
  const factsContext = facts.map((f) => `${f.label}: ${f.value}`).join("\n");

  const topicsFromConvs = [...new Set(convs.map((c) => c.topicLabel).filter(Boolean))];

  const systemPrompt = `You are Xan, an AI executive assistant. Generate a comprehensive pre-meeting briefing. Return ONLY valid JSON with exactly these fields:
{
  "whoIsThisPerson": "2-3 sentence profile",
  "relationshipSummary": "2-3 sentences about the nature and history of this relationship",
  "lastDiscussions": ["topic 1", "topic 2", "topic 3"],
  "importantFacts": ["fact 1", "fact 2", "fact 3"],
  "openCommitments": ["commitment 1", "commitment 2"],
  "suggestedTalkingPoints": ["point 1", "point 2", "point 3"],
  "recommendedNextAction": "one clear recommended next action"
}`;

  const prompt = `Contact: ${contact[0].displayName}\nPlatforms: ${(contact[0].platforms ?? []).join(", ")}\nConversation count: ${contact[0].conversationCount}\nKnown topics: ${topicsFromConvs.join(", ") || "none"}\nKnown facts:\n${factsContext || "none"}\n\nRecent message history:\n${messageContext || "(no messages)"}`;

  let brief: Record<string, unknown>;
  let aiSuccess = false;
  try {
    const raw = await callOpenAI(systemPrompt, prompt);
    brief = JSON.parse(raw);
    aiSuccess = true;
  } catch (err) {
    logger.error({ err }, "Failed to generate meeting prep");
    brief = {
      whoIsThisPerson: contact[0].displayName,
      relationshipSummary: "Not enough conversation history yet to generate a briefing.",
      lastDiscussions: topicsFromConvs,
      importantFacts: [],
      openCommitments: [],
      suggestedTalkingPoints: [],
      recommendedNextAction: "Review recent messages before meeting.",
    };
  }

  // Only cache successful AI responses
  if (aiSuccess) {
    const summaryId = `ais_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    if (cached[0]) {
      await db.update(contactAiSummaryTable)
        .set({ content: JSON.stringify(brief), generatedAt: new Date(), expiresAt })
        .where(eq(contactAiSummaryTable.id, cached[0].id));
    } else {
      await db.insert(contactAiSummaryTable).values({
        id: summaryId, userId: user.id, contactId, conversationId: null,
        summaryType: "meeting_prep", content: JSON.stringify(brief), expiresAt,
      });
    }
  }

  res.json({ brief, cached: false });
});

// ── GET /contacts/:id/score ───────────────────────────────────────────────────

router.get("/contacts/:id/score", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const contact = await db.select().from(contactsTable)
    .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, user.id))).limit(1);
  if (!contact[0]) { res.status(404).json({ error: "Contact not found" }); return; }

  const score = computeRelationshipScore(
    contact[0].conversationCount,
    contact[0].lastSeenAt,
    (contact[0].platforms ?? []).length,
  );

  res.json({ score, label: scoreLabel(score) });
});

// ── POST /contacts/backfill ───────────────────────────────────────────────────

router.post("/contacts/backfill", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  logger.info({ userId: user.id }, "Starting contact backfill");
  const result = await backfillContactsForUser(user.id);
  logger.info({ userId: user.id, ...result }, "Contact backfill complete");
  res.json({ ok: true, ...result });
});

export { computeRelationshipScore, scoreLabel };
export default router;
