# Product Requirements Document
## Xanda Cross — AI-Powered Unified Inbox
**Product:** Xanda Cross  
**Website:** xandacross.com  
**AI Assistant:** Xan  
**Version:** 1.0 — MVP  
**Date:** May 2026  
**Status:** Pre-development

---

## 1. Product Overview

### 1.1 Vision

Xanda Cross is an AI-powered unified communication platform that consolidates all of a user's messages from every major platform — Gmail, Outlook, WhatsApp, LinkedIn, Instagram, Telegram, and Slack — into a single intelligent inbox. The platform is powered by an AI assistant named **Xan**, who understands conversation context, ranks messages by priority, labels conversations by topic, generates message summaries, drafts replies, and surfaces connections across platforms that the user would otherwise miss.

The core insight: professionals in India and globally split their communication lives across 5–7 apps simultaneously. Context is lost constantly. Xanda Cross solves this not by being another aggregator, but by being the first truly intelligent inbox — one where the AI does the heavy lifting so the user only focuses on decisions, not on reading and sorting.

### 1.2 Product Name & Branding

- **Product name:** Xanda Cross
- **Domain:** xandacross.com
- **AI assistant name:** Xan
- **Xan personality:** Calm, precise, contextually aware. Never verbose. Speaks in short, confident sentences. Feels like a highly capable chief of staff, not a chatbot.
- **Design language:** Dark theme. Deep navy/charcoal background. Electric indigo/purple accent. Teal for all AI-generated content. Premium, minimal, intelligent.

### 1.3 Target Users (MVP)

**Primary — Indian startup founders and early operators**
- Manage large professional networks across multiple channels
- High message volume, high cost of missed follow-ups
- Willing to pay for tools that save time
- Already using Gmail + WhatsApp + Slack daily

**Secondary — Recruiters and talent agencies**
- Live across Gmail, LinkedIn, WhatsApp, and Instagram simultaneously
- Missing a follow-up costs them a placement fee
- Extremely high willingness to pay for inbox intelligence
- Strong referral network within their community

**Tertiary — Sales professionals and growth teams**
- Multi-channel outreach across email, LinkedIn, WhatsApp
- Need relationship context across platforms
- High MRR potential per user

---

## 2. Problem Statement

Professionals today manage 5–7 communication apps simultaneously. Every time they switch apps, context is lost. A deal discussed on WhatsApp, followed up on email, and confirmed on LinkedIn exists in three separate silos with no link between them. Existing tools either aggregate without intelligence (just showing all messages together) or are AI assistants with no actual integration (they can talk about email but cannot read it).

Xanda Cross solves all three problems simultaneously:
1. **Aggregation** — all channels in one place
2. **Intelligence** — AI that understands what matters and why
3. **Context** — cross-platform relationship awareness

---

## 3. Core Features

### Feature 1 — Time-Aware Personalised Briefing Screen

**Description:**  
The first screen a logged-in user sees. A calm, intelligent home screen that greets the user by first name and adapts dynamically based on the time of day and actual state of their inbox.

**Time-based greeting logic:**
| Time Range | Greeting |
|---|---|
| 5:00 AM – 11:59 AM | "Good morning, [First Name]." |
| 12:00 PM – 4:59 PM | "Good afternoon, [First Name]." |
| 5:00 PM – 8:59 PM | "Good evening, [First Name]." |
| 9:00 PM – 4:59 AM | "Good night, [First Name]." |

**Inbox state logic:**
| Inbox State | Message Shown |
|---|---|
| New messages exist | "You've got [N] new and [M] active conversations." + "Open today's briefing →" button |
| Inbox empty | "You're all caught up. Nothing needs your attention right now." — no button, calm state |
| Active conversations, no new messages | "No new messages, but you have [N] active conversations in progress." |

**Persistent element:**  
A search bar is always visible at the bottom of this screen regardless of inbox state. Placeholder: *"Ask Xan anything or search across all conversations..."* Invoking the search bar activates Xan.

---

### Feature 2 — Unified Inbox

**Description:**  
A single feed showing all messages from all connected platforms, ranked by AI priority score — not by time received. This is the core product view.

**Each conversation row displays:**
- Contact profile photo (circular avatar)
- Contact full name (bold)
- Platform icon (small, 16px, in official brand colour) immediately after the name
- AI-generated topic label — pill-shaped badge in teal — auto-assigned by Xan (e.g. "Engineering Hiring", "Investor Update", "Term Sheet Review", "Team Offsite", "Payment Follow-up")
- Message preview text after the label (single line, muted colour, truncated)
- Timestamp (right-aligned)
- Unread indicator dot
- Priority indicator: a coloured left-border on the row (red = High, amber = Medium, grey = Low)

**Filter bar above inbox:**  
All | Gmail | Outlook | WhatsApp | LinkedIn | Instagram | Telegram | Slack

**Sort:**  
Default is AI Priority. User can toggle to Recent if needed.

---

### Feature 3 — AI Priority Ranking

**Description:**  
Every incoming message is automatically scored by Xan and assigned a priority level: High, Medium, or Low. The inbox is always sorted with highest priority first.

**Scoring signals Xan uses:**
- Sender relationship strength (how frequently does the user interact with this person?)
- Message keywords (urgent, invoice, contract, deadline, ASAP, deal, term sheet)
- Whether a response is required (detected via NLP — questions, requests, calls to action)
- Recency and thread age (how long has this been waiting for a reply?)
- Sender importance (VIPs inferred from response speed and interaction history)
- Time sensitivity signals

**Priority is re-computed** each time a new message arrives in a thread.

**User impact:** User never has to decide what to read first. Xan decides.

---

### Feature 4 — AI Message Headline

**Description:**  
Every message gets a one-line AI-generated summary written by Xan. This appears in the inbox row before the user opens the message.

**Examples:**
- "Rohan asking for a call today re: term sheet"
- "Sara confirmed the deal — needs invoice by Friday"
- "Investor requesting Q2 update before board meeting"
- "Candidate accepted offer — needs joining date"

**User impact:** User understands what a message is about without opening it. Reduces cognitive load dramatically when scanning a full inbox.

---

### Feature 5 — AI Auto-Drafted Reply

**Description:**  
Every message gets a pre-drafted reply written by Xan, ready and waiting when the user opens the conversation. The user sees the draft, edits if needed, and sends. Nothing is ever sent automatically without user action.

**How Xan drafts the reply:**
- Reads the full conversation history in the thread (across all platforms if linked)
- Matches the user's tone and writing style based on past sent messages
- Understands the context of what the other person asked or said
- Writes a reply that is appropriately formal or informal based on the relationship

**User flow:**
```
Message arrives → Xan reads it → Xan writes draft reply
User opens message → sees draft already written
User reads, edits if needed → clicks Send
```

**Constraint:** Xan never sends anything autonomously. Every send requires an explicit user action.

---

### Feature 6 — Auto-Labelled Topics

**Description:**  
Xan reads the full conversation context across all messages in a thread (across platforms) and automatically assigns a short topic label in 2–4 words to every conversation. No manual tagging, no user input required.

**Label examples:**
- "Engineering Hiring"
- "Investor Update"
- "Team Building — Offsite Retreat"
- "Strategic Alliances"
- "Contract Renewal"
- "Payment Follow-up"
- "Product Demo Request"

**Visual treatment:** Pill-shaped badge in teal, always visible in the inbox row and at the top of the conversation view.

---

### Feature 7 — Universal Semantic Search

**Description:**  
Users can search across all conversations from all platforms using natural language. Search works by meaning, not just exact keywords.

**Powered by:** Vector embeddings stored in PostgreSQL via `pgvector` extension. Every message is embedded using OpenAI's `text-embedding-3-small` model when it arrives.

**Example queries:**
- "emails about the Series A from Sequoia"
- "WhatsApp messages where someone asked about pricing"
- "everything Rohan said about the launch date"
- "conversations about hiring in the last 30 days"

**Invocation:** Via the persistent search bar on the briefing screen, or by typing @Xan anywhere in the platform followed by the query.

---

### Feature 8 — Contextual Cross-Platform Linking

**Description:**  
Xan proactively identifies when messages across different platforms are about the same topic, deal, or person — and surfaces them together inside the conversation view.

**Example:**  
A contract was sent on WhatsApp on Monday. An email arrived on Gmail Tuesday requesting that same contract. Xan detects the connection and shows both messages together in a "Related messages" section, regardless of which platform you're viewing.

**User impact:** Eliminates the manual effort of cross-referencing multiple apps to reconstruct the full context of a conversation or deal.

---

### Feature 9 — Smart Contact Profiles

**Description:**  
Every contact in the system has a unified profile page showing their full cross-platform communication history with the user.

**Profile page shows:**
- Contact photo, name, all known platform handles (Gmail email, WhatsApp number, LinkedIn URL, etc.)
- Relationship timeline — chronological log of every interaction across all platforms
- Active topics — open conversation threads with this contact, across all channels
- Active goals — any pending follow-ups or action items Xan has detected
- Last interaction date and channel
- Relationship health score (computed by Xan based on interaction frequency and recency)

---

### Feature 10 — @Xan Mentions

**Description:**  
Users can type @Xan anywhere in the platform — in the search bar, inside a conversation, or in a dedicated Xan chat panel — to interact with the AI assistant directly.

**What users can ask @Xan:**
- "Summarise my conversation with Rohan"
- "What's the status of the Acme deal?"
- "Draft a follow-up to Sara's last message"
- "Show me all messages from this week about payments"
- "Who haven't I replied to in more than 3 days?"
- "What did Priya say about the contract on WhatsApp?"
- "Give me a briefing on everything I missed today"

**Response format:** Short, structured. Xan never gives long paragraphs unless the user asks for a full summary. Lists, bullets, and direct answers only.

---

## 4. Platform Integrations

### 4.1 Integration Architecture

All platforms except Slack are connected via **Unipile** — a single unified messaging API that handles authentication, sync, webhooks, and message normalisation. Unipile is accessed via their Node.js SDK and is hosted under a white-label subdomain:

**Auth subdomain:** `auth.xandacross.com`  
Users see only Xanda Cross branding during the OAuth/QR connection flow. Unipile branding is never visible.

Slack is integrated directly via the **official Slack Web API** (`@slack/web-api`), which is free to use with no per-account cost.

### 4.2 Supported Platforms (MVP)

| Platform | Integration Method | What Can Be Accessed | Cost to Platform |
|---|---|---|---|
| **Gmail** | Unipile (official Google API) | Full inbox — read, send, sync | Included in Unipile fee |
| **Outlook** | Unipile (Microsoft Graph API) | Full inbox — read, send, sync | Included in Unipile fee |
| **WhatsApp Personal** | Unipile (QR session auth) | Full personal inbox — read, reply | Included in Unipile fee |
| **WhatsApp Business** | Unipile (Cloud API) | Inbound + reply within 24h window | Included in Unipile fee |
| **LinkedIn** | Unipile (session-based) | DM inbox — read, reply | Included in Unipile fee |
| **Instagram** | Unipile (Meta API) | Business DMs — read, reply | Included in Unipile fee |
| **Telegram** | Unipile (official MTProto) | Full inbox — read, reply | Included in Unipile fee |
| **Slack** | Direct Slack Web API | DMs + channel messages | Free (no per-account cost) |

### 4.3 Unipile Pricing Impact

- Unipile charges approximately **$5.50 per connected account per month**
- Xanda Cross charges users **$7 per connected account per month**
- Margin per account: ~$1.50 (27%) — acceptable at MVP, improves at volume pricing tiers
- Slack has zero Unipile cost — it is integrated directly via free official API

### 4.4 Message Normalisation

Every platform produces messages in a different format. All incoming messages from Unipile and Slack are normalised into a single **CanonicalMessage** schema before storage:

```
CanonicalMessage {
  id
  platform (gmail | outlook | whatsapp | linkedin | instagram | telegram | slack)
  direction (inbound | outbound)
  from { externalId, displayName, avatarUrl }
  to [ { externalId, displayName } ]
  subject (optional)
  bodyText
  sentAt
  threadId
  contactId (resolved internal contact)
  priorityScore (set after Xan analysis)
  headline (set after Xan analysis)
  topicLabel (set after Xan analysis)
  draftReply (set after Xan analysis)
}
```

---

## 5. AI Architecture (Xan)

### 5.1 What Xan Is

Xan is not a general-purpose chatbot. Xan is a purpose-built AI layer that runs four specific jobs on every incoming message and is additionally available for on-demand queries via @Xan mentions.

### 5.2 Xan's Four Automatic Jobs (per message)

All four run as background jobs via BullMQ immediately after a message is stored. Results are pushed to the user's browser via WebSocket when ready (within 2–5 seconds).

| Job | Model | Output |
|---|---|---|
| `generate-headline` | GPT-4o-mini | One-line message summary |
| `score-priority` | GPT-4o-mini | High / Medium / Low score + reasoning |
| `assign-topic-label` | GPT-4o-mini | 2–4 word topic label |
| `draft-reply` | GPT-4o | Full draft reply in user's tone |

### 5.3 Xan's On-Demand Capabilities (@Xan mentions)

| User Request Type | Xan Response |
|---|---|
| Conversation summary | Summarises full thread across all platforms |
| Deal/topic status | Aggregates all related messages and gives current status |
| Search query | Semantic vector search across all messages |
| Draft request | Writes or regenerates a reply |
| Briefing request | Summarises missed messages by priority |
| Relationship query | Pulls contact history and active threads |

### 5.4 AI Models Used

| Purpose | Model | Why |
|---|---|---|
| Headline generation | GPT-4o-mini | Fast, cheap, high quality for summarisation |
| Priority scoring | GPT-4o-mini | Good classification at low cost |
| Topic label assignment | GPT-4o-mini | Short structured output — no need for full GPT-4o |
| Reply drafting | GPT-4o | Higher quality writing; worth the cost |
| Structured output | Zod schemas via function calling | Never parse free-form LLM text |
| Embeddings | text-embedding-3-small | $0.02/1M tokens; 1536 dimensions |
| Semantic search | pgvector (PostgreSQL) | Embedded in primary DB for MVP; no extra DB needed |
| Long context (future) | Claude 3.5 (200k context) | For full inbox analysis and relationship summaries |

---

## 6. User Flows

### 6.1 Onboarding Flow

```
1. User lands on xandacross.com
2. Clicks "Start free" or "Get early access"
3. Signs up via Clerk (Google OAuth or email + password)
4. Account created — status: PENDING
5. User sees Pending Screen: "You're on the list."
6. Two activation paths:
   a. Manual: Admin enables user in admin panel
   b. Automatic: User pays via Stripe → webhook activates account instantly
7. User receives email: "Your Xanda Cross account is ready."
8. User logs in → lands on Connect Accounts screen
9. User connects platforms (Unipile QR/OAuth flow, white-labelled on auth.xandacross.com)
10. Initial sync begins → progress shown live
11. Sync complete → Briefing Screen with first messages
```

### 6.2 Daily Usage Flow

```
1. User opens xandacross.com
2. Briefing Screen — sees time-aware greeting + message counts
3. Clicks "Open today's briefing" (or goes directly to Inbox)
4. Inbox — all messages ranked by priority
5. User scans topic labels and headlines to decide what to open
6. User opens a high-priority message
7. Sees full thread + cross-platform related messages (if any)
8. Xan's draft reply is already visible
9. User edits draft → hits Send
10. Repeat for next priority message
```

### 6.3 @Xan Interaction Flow

```
1. User types @Xan anywhere on the platform
2. Xan input panel activates
3. User types natural language query
4. Xan processes and responds inline
5. If Xan surfaces specific messages, user can click to open them
6. If Xan generates a draft, user can click to load it into the compose box
```

---

## 7. Authentication & Access Control

### 7.1 Authentication Provider

**Clerk** handles all user authentication. Supported sign-in methods:
- Google OAuth (primary)
- Email + password (fallback)

### 7.2 User Status States

| Status | Description | Access |
|---|---|---|
| `pending` | Default on signup | Login allowed; platform locked. Sees Pending Screen. |
| `active` | Enabled by admin or Stripe payment | Full platform access |
| `disabled` | Manually disabled by admin | Login blocked |

### 7.3 Activation Methods

**Manual activation:**
- Admin goes to the Admin Panel
- Finds the user by name or email
- Flips toggle to `active`
- User is immediately activated (no email required unless configured)

**Automatic activation (Stripe):**
- User completes payment on Pricing Page
- Stripe fires `checkout.session.completed` webhook
- Backend receives webhook → matches Stripe customer ID to Clerk user
- Backend sets user status to `active` via Clerk `publicMetadata`
- User gains instant full access

### 7.4 Unipile White-Label Auth

All Unipile-powered connection flows (OAuth for Gmail/Outlook, QR for WhatsApp, session login for LinkedIn/Instagram) are hosted on:

**`auth.xandacross.com`**

Users never see the Unipile brand name or any Unipile UI. The subdomain is configured in Unipile's white-label settings and styled with Xanda Cross branding.

---

## 8. Pricing Model

### 8.1 Philosophy

No fixed tiers. Users build their own plan by selecting exactly what they need. Low barrier to entry. Revenue scales naturally as users grow their usage.

### 8.2 Plan Structure

**Base Plan — $10/month (mandatory)**

Includes:
- AI priority ranking on all messages
- AI message headlines
- AI auto-drafted replies
- Universal semantic search powered by Xan
- Contextual cross-platform message linking
- Morning briefing and time-aware home screen
- @Xan mentions anywhere in the platform
- Unlimited Slack accounts (Slack uses free official API — no per-account cost)

**Add-On Accounts — $7 per account/month**

Each additional platform account the user connects costs $7/month. Supported add-ons:
- Gmail
- Outlook
- WhatsApp (Personal or Business — each account = one unit)
- LinkedIn
- Instagram
- Telegram

### 8.3 Pricing Screen UX

The pricing screen is a live calculator. As the user clicks + or − next to each platform, the total updates in real time before they hit the payment button.

```
[ AI Features + Slack Unlimited ]         $10/month
──────────────────────────────────────────────────
Add accounts                        $7 per account

  Gmail            [ − ]  0  [ + ]         $0
  Outlook          [ − ]  0  [ + ]         $0
  WhatsApp         [ − ]  1  [ + ]         $7
  LinkedIn         [ − ]  1  [ + ]         $7
  Instagram        [ − ]  0  [ + ]         $0
  Telegram         [ − ]  0  [ + ]         $0
──────────────────────────────────────────────────
Total                                  $24/month

[ Start my plan → ]
```

### 8.4 Example Scenarios

| What User Selects | Monthly Total |
|---|---|
| Base only + Slack | $10/month |
| Base + 1 Gmail + 1 WhatsApp | $24/month |
| Base + 1 LinkedIn + 1 Instagram + 1 Gmail | $31/month |
| Base + 2 WhatsApp + 1 LinkedIn + 1 Gmail | $38/month |

### 8.5 Billing Details

- Billing via Stripe
- Monthly subscription
- Mid-cycle additions/removals are prorated automatically by Stripe
- Annual billing option (optional — adds ~17% discount if offered later)
- Indian users: pricing displayed in USD; Razorpay integration for INR payments considered for Phase 2

---

## 9. Admin Panel

### 9.1 Purpose

Internal tool for the Xanda Cross team to manage users, monitor platform health, and control access during early stage.

### 9.2 Access Control

- Admin panel accessible only to users with `admin: true` in Clerk `publicMetadata`
- URL: `xandacross.com/admin` (or separate internal subdomain)

### 9.3 Admin Panel Features

**Dashboard stats:**
- Total users
- Active users
- Pending users
- Monthly Recurring Revenue (MRR)
- Connected accounts by platform (breakdown)

**User management table:**
Columns: Name | Email | Signed Up | Status | Plan | Connected Accounts | Actions

- **Status badge:** Active (green) / Pending (amber) / Disabled (red)
- **Actions per user:** Enable/Disable toggle | View account details

**Search and filter:**
- Filter by status (Pending / Active / Disabled)
- Search by name or email

---

## 10. Technical Architecture

### 10.1 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + Vite | Fast, modern, large ecosystem |
| Routing | TanStack Router | Type-safe routing |
| Server state | TanStack Query | Caching, background refetch, ideal for inbox |
| Styling | Tailwind CSS | Rapid UI development |
| Components | Radix UI | Accessible, unstyled primitives |
| Real-time | Socket.io | Push new messages and AI results to browser instantly |
| Backend | Node.js + Express 5 + TypeScript | Existing workspace stack |
| Validation | Zod | Shared with codegen |
| ORM | Drizzle ORM | Type-safe, lightweight |
| Database | PostgreSQL + pgvector | Primary data store + semantic search |
| Queue | BullMQ + Redis | Async AI processing jobs |
| Auth | Clerk | User auth, session management, metadata |
| Payments | Stripe | Subscriptions, webhooks, billing portal |
| Messaging API | Unipile Node.js SDK | All platforms except Slack |
| Slack | @slack/web-api | Direct Slack integration (free) |
| AI | OpenAI API | GPT-4o + GPT-4o-mini + text-embedding-3-small |
| Hosting | Railway (MVP) → AWS Mumbai (scale) | Simple deployment, auto SSL |
| Error tracking | Sentry | Production error monitoring |

### 10.2 Message Processing Pipeline

```
Webhook arrives (Unipile or Slack)
       ↓
API server receives → validates signature
       ↓
Message normalised to CanonicalMessage schema
       ↓
Stored in PostgreSQL (messages table)
       ↓
Contact resolved / created (contacts table)
       ↓
Four BullMQ jobs dispatched in parallel:
  ├── generate-headline    → GPT-4o-mini → saved to DB
  ├── score-priority       → GPT-4o-mini → saved to DB
  ├── assign-topic-label   → GPT-4o-mini → saved to DB
  └── draft-reply          → GPT-4o      → saved to DB
       ↓
Embedding job: text-embedding-3-small → stored in pgvector
       ↓
Socket.io pushes update to user's browser
       ↓
Inbox updates live with all AI outputs
```

### 10.3 Core Database Schema (Simplified)

```sql
users              — Clerk user ID, status, metadata
contacts           — Unified contact across all platforms
contact_identities — One contact, many platform handles
messages           — All messages, normalised
threads            — Conversation threads
oauth_connections  — Encrypted Unipile + Slack tokens per user
subscriptions      — Stripe subscription data per user
connected_accounts — Which platforms each user has connected
```

### 10.4 Infrastructure Costs

| Scale | Estimated Monthly Cost |
|---|---|
| 100 users | ~$80–120/month (infra + AI) |
| 1,000 users | ~$300–400/month |
| 10,000 users | ~$2,000–3,000/month |

Unipile cost (separate): ~$5.50 × total connected accounts

---

## 11. Pages & Screens

| Screen | Description |
|---|---|
| Landing Page | Marketing page with hero, features, platform logos, pricing teaser |
| Sign Up / Login | Clerk-powered auth — Google OAuth + email/password |
| Pending Screen | Shown to users awaiting activation |
| Briefing Screen | Time-aware home screen with greeting, message counts, search bar |
| Unified Inbox | All messages ranked by priority with labels, headlines, platform icons |
| Conversation View | Full thread + cross-platform related messages + AI draft reply |
| Smart Contact Profile | Full cross-platform history per contact |
| Pricing Page | Live plan calculator — base + add-on accounts |
| Settings — Connected Accounts | Connect/disconnect platforms, sync status |
| Settings — Billing | Current plan, manage via Stripe portal |
| Admin Panel | User management, activation controls, stats dashboard |

---

## 12. MVP Scope — 30 Days

### Build in MVP

- Clerk authentication + pending/active status
- Stripe payment → auto-activation webhook
- Unipile integration (Gmail, Outlook, WhatsApp, LinkedIn, Instagram, Telegram)
- Slack direct integration
- Message normalisation pipeline
- Briefing screen (all states)
- Unified inbox (priority-ranked, with labels, headlines, platform icons)
- AI pipeline: headline + priority score + topic label + draft reply
- Semantic search via pgvector
- @Xan search and summary in search bar
- Basic smart contact profiles
- Admin panel (user list + enable/disable)
- Pricing page with live calculator
- Stripe checkout + subscription management

### Defer to Phase 2

- Contextual cross-platform message linking (Xan surfacing related messages)
- Full @Xan mention UI inside conversation threads
- Mobile app (React Native via Expo)
- Razorpay (INR payments for India)
- LinkedIn Recruiter InMail integration
- Relationship health scoring dashboard
- Annual billing option
- Enterprise SSO (Okta/Azure AD)
- Team/shared inbox (multi-seat plans)
- Chrome browser extension
- CRM integrations (HubSpot, Salesforce)

---

## 13. Success Metrics

### MVP Success (Month 1–2)

- 50 activated beta users
- D7 retention ≥ 50% (users return within 7 days)
- D30 retention ≥ 30%
- At least 30% of users connect 3+ platforms
- User feedback: "I wouldn't go back to checking apps separately" from ≥10 users

### Growth Milestones

| Milestone | Target |
|---|---|
| First paying user | Week 3 of beta |
| 100 paying users | Month 3 |
| $2,500 MRR | Month 4 |
| 500 paying users | Month 6 |
| $10,000 MRR | Month 8 |
| 2,000 paying users | Month 12 |

---

## 14. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Unipile API instability / downtime | Medium | Unipile SLA monitoring; fallback to direct Gmail/Outlook API for email |
| WhatsApp session bans (personal accounts) | Medium | Unipile handles this risk; educate users on session hygiene |
| LinkedIn session detection | Medium | Unipile handles; treat as enhancement not core |
| Google OAuth verification delay | Medium | Launch beta with up to 100 whitelisted test users during review |
| AI cost overrun from power users | Medium | Daily caps per plan; GPT-4o-mini for all except reply drafting |
| Low D30 retention — "cool demo" problem | High | Daily email digest; morning briefing push notification; habit loop |
| Stripe + Clerk webhook failure | Low | Idempotency keys; webhook retry logic; manual override in admin |

---

## 15. Competitive Positioning

| Product | What They Do | Xanda Cross Advantage |
|---|---|---|
| Kinso AI | AI relationship OS, contacts focus | We have WhatsApp + LinkedIn DM sync; Indian market focus |
| Superhuman | AI email client (Gmail/Outlook only) | We cover 7 platforms, not just email |
| Front | Team inbox, customer support | We are personal/individual focused; no team complexity |
| Notion AI | Docs + AI | Not a communications tool |
| ChatGPT | General AI | No actual integration with real mailboxes |

**Unfair advantages for India:**
- WhatsApp personal inbox sync — nobody else offers this legitimately
- Priced in accessible range ($10 base) vs. Superhuman ($30/month, Gmail only)
- Telegram-first — massive in Indian startup/tech community
- WhatsApp + Gmail cross-linking — solves the exact split-communication problem every Indian professional has

---

*Document prepared based on product discussions and architecture analysis. Ready for engineering implementation.*
