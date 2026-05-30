---
name: Xanda email mode architecture
description: How the Email Mode UI is structured, platform detection, component tree, and what backend features are still gaps.
---

## Platform detection
In `Inbox.tsx`, the right pane checks `selConv?.platform === "gmail" || "outlook"` from the conversations list and renders `<EmailView>` instead of `<ConversationView>`. No separate route — same unified inbox, same URL structure.

## Component tree
- `EmailView` — orchestrates all state (expandedIds, replyText, composeModal), fetches conversation via `useGetConversation`
- `EmailCard` — stacked card per message, expand/collapse, delegates body rendering
- `HtmlRenderer` — sandboxed iframe (`sandbox="allow-same-origin allow-popups"`) for safe HTML email rendering; auto-resizes via `onLoad`; collapses quoted history at known Gmail/Outlook patterns
- `AIWorkspace` — 6 AI action buttons (Summarize, Suggest Reply, Rewrite Pro/Friendly, Extract Actions, Detect Meetings); all call `/api/xan/chat` with crafted prompts; "Use as reply" injects result into composer
- `EmailComposer` — Quick/Full mode toggle; Full mode shows To (read-only), CC/BCC (optional expansion), Subject (read-only); Reply sends via existing `useSendMessage` hook
- `ComposeModal` — New Email compose modal (bottom-right corner, minimizable); AI Draft button calls `/api/xan/chat`; Send is UI-complete but backend not wired (Phase 3)

## Avatar proxy
All `contactAvatarUrl` and `senderAvatarUrl` values are rewritten to `/api/avatar-proxy?url=<encoded>` in `conversations.ts` via `toProxyUrl()`. Proxy validates against allowlist: `.licdn.com`, `.cdninstagram.com`, `.fbcdn.net`, `.whatsapp.net`.

## Backend gaps (Phase 3)
- New email sending: `MessageSendInput` has no `to`/`subject` fields; Unipile API supports it
- Reply All: CC/BCC not in schema or Unipile call
- Forward: no API concept; must be implemented as new compose with quoted body
- Attachments: not in DB schema; UI architecture is in place
- From/To/CC per-message: sync code discards these; need to persist in messages table

**Why:** The approach deliberately keeps the unified inbox intact — email mode is a different renderer for the same data, not a separate app.
