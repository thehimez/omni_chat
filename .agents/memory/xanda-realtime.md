---
name: Xanda inbox realtime and navigation
description: SSE broadcaster, reactive navigation with wouter, optimistic unread updates, and the markRead flow
---

## Navigation (the original bug)
- `window.location.search` + `window.history.pushState` = React NEVER re-renders
- Fix: `useSearch()` from wouter 3.10 returns reactive query string; `navigate()` from `useLocation()` triggers re-renders
- `selectedId = new URLSearchParams(useSearch()).get("id")` — one-liner, always in sync with URL

## SSE realtime layer
- `lib/sse-broadcaster.ts` — in-memory Map of clientId → {userId, res}
- `routes/events.ts` — `GET /api/events?token=X` — SSE endpoint (accepts token via query param because EventSource doesn't support headers)
- `hooks/use-realtime.ts` — subscribes via EventSource, calls `queryClient.invalidateQueries` on `new_message` / `conversation_updated` events
- Reconnects with exponential backoff (starts at 2s, caps at 30s)
- `<RealtimeSync />` mounted in Layout.tsx so it runs globally across all pages

## Optimistic unread update
- On click in inbox list: immediately call `queryClient.setQueryData(getGetConversationsQueryKey(), ...)` to set `isRead: true, unreadCount: 0` for that conversation
- This clears the badge INSTANTLY without waiting for API round-trip
- Backend `markRead` fires in `ConversationView` useEffect([id]) — always runs once per conversation, confirms the update and invalidates

## markRead flow
- `useEffect(() => { markRead.mutate({id}, { onSuccess: () => invalidateConversations() }); }, [id])`
- Only depends on `id` — fires exactly once per conversation switch
- Previous complex `markedReadRef` logic was removed

**Why:** The `markedReadRef` + `!lastMsg.isRead` condition was missing cases where the conversation had `isRead: false` but the last cached message had `isRead: true`.
