---
name: Xanda AI Priority Inbox
description: Architecture for the AI-ranked inbox — scoring, summarization, DB columns, tabs, and backfill pattern.
---

## DB columns added to conversations
- `ai_summary` text — AI one-liner ("Wants pricing for sponsorship package")
- `ai_priority_score` integer 0–100 — rule-based score
- `needs_reply` boolean — true if unread_count > 0 AND NOT is_read

## Scoring logic (rule-based, zero AI cost)
File: `artifacts/api-server/src/lib/priority-scorer.ts`
- Base 40; clamp 5–95
- +8–25 for unread, +3–20 for recency, +8 for question marks
- −12 automated/notification, −20 no-reply sender, −30 newsletter/promo, −8 group chat
- Priority thresholds: ≥70 = high, ≥45 = medium, <45 = low
- Scoring is called synchronously at every conversation upsert in unipile-sync.ts (3 locations: gmail, chat-sync, webhook)

## AI summarization
File: `artifacts/api-server/src/routes/ai-priority.ts`
- `POST /api/ai/prioritize` — step 1 scores unscored (instant), step 2 AI-summarizes top 30 unsummarized
- `GET /api/ai/prioritize/status` — progress counts
- AI call uses plain text output (NOT response_format json_object — that's only for memory/meeting-prep)
- max_completion_tokens: 60 (one sentence)
- Frontend triggers this automatically when Priority tab is first opened

## Frontend tabs
File: `artifacts/xanda-cross/src/pages/Inbox.tsx`
- `activeView` state: "all" | "priority" | "followups"
- All → chronological (same as before)
- Priority → sorted by aiPriorityScore DESC; triggers POST /api/ai/prioritize once on first open
- Follow-ups → filtered: needsReply OR (!isRead && unreadCount > 0)
- Card shows aiSummary when available (falls back to topicLabel → headline → preview)
- High priority (score ≥70) unread items get a rose dot instead of blue dot

## Backfill pattern
- SQL UPDATE can score all existing conversations (no Node.js runner needed):
  `UPDATE conversations SET ai_priority_score = ..., priority = ..., needs_reply = ... WHERE ai_priority_score IS NULL`
- 409 conversations scored on first run; 38 high, 99 medium, 567 low; 83 need reply

## Why plain text AI output for summaries
- Intelligence routes (memory/meeting-prep) use `response_format: { type: "json_object" }` — must return JSON
- Priority summaries return plain English — do NOT add json_object format or the model wraps it in JSON
