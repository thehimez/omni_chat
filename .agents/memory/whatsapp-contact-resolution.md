---
name: WhatsApp contact name resolution
description: How XANDA resolves WhatsApp contact names — the architecture, what works, and the Unipile endpoint that returned 404.
---

## Rule
WhatsApp DMs show: saved contact name if saved, E.164 phone number if unsaved. push_name / attendee.name is NEVER used.

## Implementation
1. `whatsapp_contacts` table in DB — synced from Unipile `/api/v1/users?account_id=...`
2. `normalizePhone()` (exported from unipile-sync.ts) — strips @s.whatsapp.net, returns E.164 (`+digits`)
3. `resolveChatName()` for WhatsApp priority:
   - contacts lookup map (from whatsapp_contacts table)
   - `chat.name` from Unipile (mirrors WhatsApp Web conversation title — saved name or phone)
   - normalized phone from attendee data
   - Never uses `attendee.name` (push_name)
4. `syncWhatsappContacts()` — called inside `syncChats()` before chat loop
5. `reResolveWhatsappConversations()` — called after syncChats in syncAccount; only updates rows where contacts lookup has a match (doesn't force-overwrite unsaved contacts)
6. Webhook handler in webhooks.ts uses same lookup via DB query per incoming message

## Known Limitation
Unipile `/api/v1/users?account_id=...` returns **404** for this deployment. This means the `whatsapp_contacts` table stays empty and address-book sync doesn't work. The `chat.name` fallback compensates — Unipile sets it to saved contact name for saved numbers, and phone number for unsaved numbers, matching WhatsApp Web behavior.

**Why:** Unipile may not expose this endpoint in the API tier/version being used (DSN: api19.unipile.com:14946). If this ever starts working, the whatsapp_contacts table and lookup will activate automatically without code changes.

## Files changed
- `lib/db/src/schema/whatsapp_contacts.ts` — new table schema
- `lib/db/src/schema/index.ts` — added export
- `artifacts/api-server/src/lib/unipile-sync.ts` — all resolution logic
- `artifacts/api-server/src/routes/webhooks.ts` — WhatsApp sender name fix
