# Xanda Cross

AI-powered unified inbox platform that pulls messages from Gmail, Outlook, WhatsApp (personal+business), LinkedIn, Instagram, Telegram, and Slack into one intelligent inbox powered by Xan AI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/xanda-cross run dev` — run the frontend (port 20730, proxied to /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui, wouter routing, TanStack Query
- API: Express 5 (artifacts/api-server, served at /api)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec)
- Auth: Clerk (pending setup — add CLERK_SECRET_KEY + VITE_CLERK_PUBLISHABLE_KEY)
- Payments: Stripe (pending — add STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET)
- AI: OpenAI (pending — add OPENAI_API_KEY) — GPT-4o-mini for Xan
- Messaging: Unipile API (key in env as UNIPILE_API_KEY, host UNIPILE_HOST)
- Build: esbuild (CJS bundle for API)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (users, accounts, conversations, messages, contacts, xan_messages, notification_settings)
- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/api-server/src/middleware/auth.ts` — Clerk JWT verification + user upsert
- `artifacts/xanda-cross/src/pages/` — all frontend pages
- `artifacts/xanda-cross/src/components/` — shared UI components

## Architecture decisions

- Contract-first OpenAPI: spec in lib/api-spec → codegen → typed hooks (api-client-react) + Zod schemas (api-zod)
- Clerk auth middleware verifies JWT on every protected route and upserts user on first login
- Unipile handles all platforms except Slack (direct Slack Web API)
- Admin panel uses its own JWT (env: ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_JWT_SECRET) — not Clerk
- App never crashes when env keys are missing — returns 503 "feature unavailable" instead

## Product

- **Briefing screen** (`/`) — time-aware greeting, Xan's inbox summary, top-priority conversations
- **Unified Inbox** (`/inbox`) — all messages ranked by AI priority, split-panel conversation view with Xan draft reply
- **Xan AI** (`/xan`) — full dedicated chat interface with history
- **Semantic Search** (`/search`) — search across all platforms with @Xan integration
- **Contacts** (`/contacts`, `/contacts/:id`) — smart contact profiles enriched across platforms
- **Accounts** (`/accounts`) — connect/disconnect platforms, trigger sync
- **Settings** (`/settings`) — notifications, theme toggle
- **Billing** (`/billing`) — Stripe subscription management, trial status
- **Admin** (`/admin`) — user management, platform stats (separate bcrypt login)

## Environment variables needed

```
# Required for auth
CLERK_SECRET_KEY=sk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...

# Required for AI (Xan assistant)
OPENAI_API_KEY=sk-...

# Required for messaging (all platforms except Slack)
UNIPILE_API_KEY=OXi7+sjT.vpdLY45oHGT/+xo9I/QJj4ykuvyMRhnkojQToFbmHjE=
UNIPILE_HOST=api19.unipile.com:14946

# Required for Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...

# Required for payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Required for admin panel
ADMIN_EMAIL=admin@xandacross.com
ADMIN_PASSWORD_HASH=<bcrypt hash of admin password>
ADMIN_JWT_SECRET=<random secret>

# App
APP_URL=https://xandacross.com
SESSION_SECRET=<set>
DATABASE_URL=<auto-provisioned>
```

## User preferences

- Dark mode by default, light mode toggle via next-themes
- No emojis in UI
- Admin panel at /admin (separate bcrypt credentials, not Clerk)
- Unipile white-label — users never see Unipile branding
- 7-day free trial, no credit card required

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching routes or frontend
- After any DB schema change: run `pnpm --filter @workspace/db run push`
- The API server uses `pnpm run typecheck:libs` to rebuild lib packages — run this if you get "module has no exported member" errors
- Admin middleware uses `require()` for jsonwebtoken (dynamic import pattern)
- Stripe and OpenAI are dynamically imported to avoid startup crashes when keys are missing

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec naming: all request bodies use entity-shaped names (NoteInput, NoteUpdate) NOT operation-shaped (CreateNoteBody) to avoid TS2308 collisions
