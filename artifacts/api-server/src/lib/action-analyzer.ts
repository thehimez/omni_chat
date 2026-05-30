/**
 * Action Detection Agent
 *
 * Analyzes a conversation and determines:
 * 1. Whether the user needs to take an action (actionRequired)
 * 2. What that action is (actionLabel)
 * 3. How urgent it is (actionScore 0-100)
 * 4. A 2-4 word topic label for all views (topicLabel)
 *
 * Runs after sync and on webhook arrival. Results stored in conversations table.
 * UI reads stored values — NOT called on page load.
 */

import OpenAI from "openai";
import { logger } from "./logger";

export interface ActionAnalysisInput {
  contactName: string;
  platform: string;
  headline: string | null;
  topicLabel: string | null;
  needsReply: boolean;
  providerChatId?: string | null;
  unreadCount: number;
}

export interface ActionAnalysisResult {
  actionRequired: boolean;
  actionLabel: string | null;
  actionScore: number;
  actionReason: string;
  topicLabel: string | null;
}

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "no-key";
  return new OpenAI({ baseURL, apiKey });
}

// ── Pre-filter (no AI needed) ─────────────────────────────────────────────────

const NEWSLETTER_RE =
  /unsubscribe|newsletter|mailing list|promotional|marketing email|opt.?out/i;
const NOREPLY_RE = /no.?reply|noreply|do.not.reply|donotreply/i;
const AUTOMATED_RE =
  /\b(notification|automated|alert|receipt|invoice|confirm your|verify your|password reset|otp|one.time|security code)\b/i;
const GREETING_ONLY_RE =
  /^(hi|hello|hey|good morning|good evening|good night|how are you|how r u|howdy|sup|what's up|wassup)[!?.]*$/i;

function isGroupChat(input: ActionAnalysisInput): boolean {
  const pid = input.providerChatId ?? "";
  return pid.endsWith("@g.us") || pid.endsWith("@newsletter");
}

function isBroadcastOrSpam(input: ActionAnalysisInput): boolean {
  const text = `${input.headline ?? ""} ${input.topicLabel ?? ""}`;
  const name = input.contactName;
  if (NEWSLETTER_RE.test(text)) return true;
  if (NOREPLY_RE.test(name)) return true;
  if (AUTOMATED_RE.test(text) && !input.needsReply) return true;
  // Telegram broadcast channels: huge unread counts + likely one-directional
  if (input.platform === "telegram" && input.unreadCount > 200) return true;
  return false;
}

function isGreetingOnly(text: string | null): boolean {
  if (!text) return true;
  return GREETING_ONLY_RE.test(text.trim());
}

// ── Fast-path no-op result ────────────────────────────────────────────────────

function noAction(topicLabel: string | null = null): ActionAnalysisResult {
  return {
    actionRequired: false,
    actionLabel: null,
    actionScore: 0,
    actionReason: "No action required",
    topicLabel,
  };
}

// ── AI analysis ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an executive assistant analyzing incoming messages for a business professional.

Determine if the recipient needs to take an action, and generate a short topic label.

SET actionRequired=true ONLY when someone is:
- Waiting for a reply to a question
- Requesting a document, proposal, or information
- Requesting approval or a decision
- Inviting to something requiring confirmation
- Asking for scheduling or availability
- Assigning a task or work item

NEVER set actionRequired=true for:
- Group chats or broadcast channels
- Newsletters, promotions, sales, marketing
- Automated notifications, receipts, invoices, OTPs
- Greetings ("Hi", "Hello", "Good morning", "How are you")
- Casual acknowledgments ("Thanks", "OK", "Got it", "👍")
- FYI messages with no request
- Social reactions

actionLabel must be verb-first, max 10 words, describing what YOU should do.
Good: "Send the sponsorship proposal document"
Good: "Confirm attendance for the event on Friday"
Bad: "They want the proposal" (describes what they want, not what you do)

topicLabel: 2-4 word noun phrase for ALL conversations.
Examples: "Sponsorship proposal", "Event planning", "Project update", "Partnership discussion", "University application", "Sales inquiry", "Customer support", "Job offer"

Return ONLY valid JSON:
{
  "actionRequired": boolean,
  "actionLabel": "string or null",
  "actionScore": 0-100,
  "actionReason": "one sentence internal note",
  "topicLabel": "2-4 word noun phrase"
}

Score guide:
90-100: Critical (client waiting, deadline today, urgent approval, payment issue)
70-89: High (question needing answer, document requested, meeting to confirm)
40-69: Medium (follow-up, discussion continuation, soft request)
0-39: Low or no action (FYI, casual, social, automated)`;

export async function analyzeConversation(
  input: ActionAnalysisInput,
): Promise<ActionAnalysisResult> {
  // ── Fast-path pre-filters (no AI cost) ──────────────────────────────────────
  if (isGroupChat(input)) {
    return noAction("Group chat");
  }
  if (isBroadcastOrSpam(input)) {
    return noAction(null);
  }

  const msgText = input.topicLabel || input.headline;

  // No content at all → skip AI call entirely
  if (!msgText || msgText.trim().length < 3) {
    return noAction(null);
  }

  // If headline is greeting-only and no unread → no action
  if (isGreetingOnly(msgText) && !input.needsReply) {
    return noAction(null);
  }

  // ── AI analysis ─────────────────────────────────────────────────────────────
  const direction = input.needsReply
    ? "INBOUND — they messaged you, waiting for your reply"
    : "OUTBOUND — you messaged last";

  const userMessage = [
    `Contact: ${input.contactName}`,
    `Platform: ${input.platform}`,
    `Direction: ${direction}`,
    input.topicLabel ? `Subject/Topic: ${input.topicLabel}` : null,
    msgText ? `Message: ${msgText}` : "(no message preview)",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openai = getOpenAIClient();
    const resp = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");

    const parsed = JSON.parse(raw);
    return {
      actionRequired: Boolean(parsed.actionRequired),
      actionLabel: parsed.actionLabel ?? null,
      actionScore: Math.max(0, Math.min(100, Number(parsed.actionScore) || 0)),
      actionReason: parsed.actionReason ?? "",
      topicLabel: parsed.topicLabel ?? null,
    };
  } catch (e) {
    logger.error({ err: e }, "action-analyzer: AI call failed");
    // On failure, return a safe default — will be retried on next sync
    return {
      actionRequired: false,
      actionLabel: null,
      actionScore: 0,
      actionReason: "Analysis failed",
      topicLabel: null,
    };
  }
}
