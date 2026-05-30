---
name: Xanda contact intelligence v1
description: DB schema, API routes, frontend components, and design decisions for the contact intelligence layer built in Phase 1.
---

## DB Tables added (via drizzle push)
- `contact_ai_summary` — cached AI output (memory cards, meeting preps). Fields: id, userId, contactId, conversationId, summaryType, content (JSON text), generatedAt, expiresAt.
- `contact_facts` — AI-extracted + user-written facts. Fields: id, userId, contactId, factType, label, value, source, confidence (real), extractedFrom (conversationId).

## Backend routes (artifacts/api-server/src/routes/intelligence.ts)
- `GET /api/contacts/:id/timeline` — unified cross-platform message feed for a contact
- `GET /api/contacts/:id/facts` — list facts for a contact
- `POST /api/contacts/:id/facts` — upsert (user_written) fact
- `DELETE /api/contacts/:id/facts/:factId` — delete fact
- `POST /api/contacts/:id/intelligence/memory` — get or generate memory card (3h TTL); body: `{ conversationId? }`. Returns `{ card, cached }`.
- `POST /api/contacts/:id/intelligence/meeting-prep` — get or generate meeting brief (24h TTL). Returns `{ brief, cached }`.
- `GET /api/contacts/:id/score` — relationship score (0–100) + label

## Relationship score formula
`min(100, recencyScore[0-40] + volumeScore[0-40] + platformScore[0-20])`
- Recency: max(0, 40 - daysSinceLastSeen / 2.25)
- Volume: min(40, log2(conversationCount+1) * 12)
- Platform diversity: min(20, (platformCount-1) * 7)

## Important: zod/v4 cannot be used in api-server routes
The esbuild bundler in api-server cannot resolve `zod/v4`. Use `@workspace/api-zod` validators or plain manual validation instead. The schema files in lib/db can use zod/v4 fine.

## Frontend components
- `XanMemoryCard` (src/components/XanMemoryCard.tsx) — compact collapsible card above composer in ConversationView; only appears when `conv.contactId` is set; fetches lazily on conversation open.
- `ContactProfile.tsx` — fully rebuilt with tabs (Overview | Timeline | Facts), meeting prep slide-over modal, relationship score SVG ring, clickable platform identity badges.
- Contact header in ConversationView: avatar + name are `<Link href="/contacts/:contactId">` when contactId is present.

## Memory card JSON shape
```json
{ "lastDiscussed": "string", "importantFacts": ["..."], "openItems": ["..."], "suggestedFollowUp": "string" }
```

## Meeting prep JSON shape
```json
{ "whoIsThisPerson": "string", "relationshipSummary": "string", "lastDiscussions": [...], "importantFacts": [...], "openCommitments": [...], "suggestedTalkingPoints": [...], "recommendedNextAction": "string" }
```

## Phase 2 opportunities
- Fact extractor: run GPT on every new inbound message, auto-populate contact_facts with ai_extracted source + confidence
- Merge suggestion engine: name fuzzy-match + email cross-platform match → contact_merge_suggestions table
- Semantic search: embed contact facts+summaries into pgvector
- Proactive reconnect reminder: "You haven't spoken with X in 30 days"
