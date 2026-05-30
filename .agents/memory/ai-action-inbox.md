---
name: Xanda AI Action Inbox
description: Architecture and gotchas for the AI Action Detection Agent powering the ⚡ Actions tab in Xanda Cross
---

## What it does
Analyzes conversations for genuine user-action items (questions, prize selections, feedback requests, decisions needed) and stores results in the `conversations` table. Only unseen items with `ai_action_required=true AND ai_action_status != 'seen'` appear in the Actions tab.

## Key DB columns (all on conversations table)
- `ai_action_required` boolean
- `ai_action_label` text (e.g. "Select preferred prize and reply")
- `ai_action_score` int (0–100)
- `ai_action_reason` text
- `ai_action_status` "active" | "seen" — resets to "active" on webhook if action detected
- `ai_last_analyzed_at` timestamp
- `ai_topic_label` text (2–4 word topic)

## Critical: max_completion_tokens must be 4096 for json_object
Using `response_format: { type: "json_object" }` with `max_completion_tokens < 4096` causes the model to return empty content (no error, just empty string). Always use `max_completion_tokens: 4096` with json_object format via the Replit AI proxy.

**Why:** The Replit proxy (gpt-5-mini) with json_object format silently truncates the response if the token budget is too tight, returning an empty `choices[0].message.content`. The error handler catches this as "Empty AI response" and falls back to noAction(), which is safe but wastes the analysis.

## Only fire analyzer when needsReply=true (in sync pipeline)
The batch sync (syncGmailThreads, syncChatConversations) processes 200+ conversations per run. Firing the AI for each one would cause:
1. Hundreds of concurrent AI calls
2. Rate limit / cost issues
3. Noisy logs full of "Empty AI response" errors

**Rule:** In `syncGmailThreads` and `syncChatConversations`, wrap the `analyzeConversation(...)` call in `if (needsReply)`. In `syncChatById` (webhook path), always fire — a new inbound message just arrived.

## Pre-filters (built into action-analyzer.ts)
- WhatsApp groups: `providerChatId.endsWith('@g.us')` or contains `@newsletter`
- Telegram broadcast channels: `unreadCount > 200`
- Automated senders: "noreply", "no-reply", "notifications", "alert", "newsletter"
- Greetings-only: headline < 3 chars or is only "Hi", "Hello", "Hey", "ok"

## Backfill script
`artifacts/api-server/src/scripts/backfill-actions.ts` — analyzes 30 conversations per run (those where `ai_last_analyzed_at IS NULL OR ai_last_analyzed_at < last_message_at`). Run multiple times to cover all conversations. Found 4 genuine action items in the real inbox (most "needs_reply" conversations are broadcast channels/groups that correctly get filtered out).

## Auto-dismiss flow
- Opening a conversation calls `POST /api/conversations/:id/read` → sets `ai_action_status = "seen"`
- Optimistic update in Inbox.tsx immediately hides the card from the Actions tab
- If a new inbound message arrives via webhook AND AI detects action → resets to "active"

## Real inbox data note
The test account's "needs_reply" conversations are mostly Telegram broadcast channels (1000+ unread), WhatsApp groups, and educational notifications. Very few personal DMs needing action — this is correct behavior, not a bug.
