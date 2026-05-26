---
name: Unipile sync architecture
description: Key patterns for syncing Gmail/WhatsApp/LinkedIn via Unipile API — name resolution, message normalization, webhook handling, incremental sync
---

## Name resolution
- Gmail: use `from_attendee.display_name` (NOT `.name`)
- WhatsApp/LinkedIn: fetch `/chats/{id}/attendees`, find the non-self attendee (`is_self !== 1`), use `attendee.name` → `specifics.phone_number` → `formatPhone(public_identifier)` as fallbacks
- `is_sender` field is an int (0 or 1), not boolean

## Message normalization
- WhatsApp reaction tokens like `{{153790028214398@lid}}` must be stripped with `/\{\{[^}]+\}\}\s*/g`
- Apply this BOTH in `truncate()` (full sync) AND in the webhook handler (incremental)
- Unipile chat messages come **newest-first** — reverse before storing
- `body_plain` > HTML stripped `body` for Gmail previews

## Webhook handling (POST /api/webhooks/unipile)
- `event: "new_message"` or legacy `"message_received"`
- `chat_id` field (not `thread_id`) for chats; `thread_id` for email
- If conversation NOT in DB: call `syncChatById()` to create it, then broadcast SSE
- Account events: `account_creation_success | account_reconnected | account_sync_success` → status = "connected"

## Incremental sync
- `syncChatById(externalChatId, unipileAccountId, accountDbId, userId, platform)` in unipile-sync.ts
- Fetches single chat + attendees + messages in parallel, upserts all
- Called from webhook handler when `existing[0]` is null

## API endpoints used
- `GET /api/v1/emails?account_id=X&limit=50`
- `GET /api/v1/chats?account_id=X&limit=30`
- `GET /api/v1/chats/{id}/attendees`
- `GET /api/v1/chats/{id}/messages?limit=20`
- `GET /api/v1/chats/{id}` (single chat for incremental)
- Auth: `X-API-KEY` header

**Why:** Unipile's API structure is non-obvious; these patterns took multiple iterations to get right.
