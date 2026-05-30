import { Router, type IRouter, type Request, type Response } from "express";
import { eq, or, and } from "drizzle-orm";
import { db, usersTable, connectedAccountsTable, conversationsTable, messagesTable, whatsappContactsTable } from "@workspace/db";
import { StripeWebhookResponse, UnipileWebhookResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { appendWebhookEvent } from "../lib/webhook-log";
import { broadcastToUser } from "../lib/sse-broadcaster";
import { syncChatById, normalizePhone } from "../lib/unipile-sync";

const router: IRouter = Router();

router.post("/webhooks/stripe", async (req: Request, res: Response): Promise<void> => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    res.json(StripeWebhookResponse.parse({ status: "ok" }));
    return;
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    let event;
    if (webhookSecret) {
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing signature" });
        return;
      }
      event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
    } else {
      event = req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) {
        await db.update(usersTable).set({
          status: "active",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        }).where(eq(usersTable.id, userId));
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const users = await db.select().from(usersTable).where(eq(usersTable.stripeSubscriptionId, subscription.id));
      if (users[0]) {
        await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, users[0].id));
      }
    }
  } catch (err) {
    logger.error({ err }, "Stripe webhook error");
  }

  res.json(StripeWebhookResponse.parse({ status: "ok" }));
});

// ─── Unipile event name constants (from Unipile dashboard) ───────────────────
// Messaging events:  new_message | message_read | message_reaction | message_edit | message_delete | message_delivered
// Account events:    account_creation_success | account_creation_fail | account_deletion |
//                    account_reconnected | account_sync_success | account_stopped |
//                    account_status_ok | account_connecting | account_error |
//                    account_credentials | account_permissions
// Legacy fallbacks:  account_connected | message_received (older Unipile versions)

// ─── Unipile payload shape (actual format from their API) ────────────────────
// Unipile sends message fields at the TOP LEVEL — not nested under "data".
// Key fields for message_received:
//   provider_chat_id  → conversation external ID
//   message           → message body text
//   message_id        → external message ID
//   sender.attendee_name / sender.attendee_public_identifier → sender display
//   timestamp         → ISO datetime
//   is_sender         → true if WE sent it (skip those)
//   provider          → inside sender.attendee_specifics.provider (e.g. "WHATSAPP")
//   account_id        → top-level, which Unipile account received the message
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, string> = {
  GOOGLE: "gmail", OUTLOOK: "outlook", WHATSAPP: "whatsapp",
  LINKEDIN: "linkedin", INSTAGRAM: "instagram", TELEGRAM: "telegram",
  MESSENGER: "messenger", TWITTER: "twitter",
};

function normalisePlatform(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return PROVIDER_MAP[raw.toUpperCase()] ?? raw.toLowerCase();
}

router.post("/webhooks/unipile", async (req: Request, res: Response): Promise<void> => {
  try {
    // Unipile sends a flat payload — all fields at top level
    const payload = req.body as Record<string, any>;

    // ── Normalise AccountStatus wrapper ─────────────────────────────────────
    // Some Unipile events arrive as { AccountStatus: { account_id, message, account_type } }
    // instead of the standard { event, account_id } flat shape. Detect and unwrap.
    const accountStatusPayload = payload.AccountStatus as
      | { account_id?: string; message?: string; account_type?: string }
      | undefined;

    const event: string =
      payload.event ??
      (accountStatusPayload
        ? `account_status_${(accountStatusPayload.message ?? "unknown").toLowerCase()}`
        : "unknown");

    const accountId: string | null =
      payload.account_id ??
      accountStatusPayload?.account_id ??
      null;

    // Provider can live in multiple places depending on event type
    const provider: string | null =
      payload.provider ??
      payload.data?.provider ??
      payload.sender?.attendee_specifics?.provider ??
      (accountStatusPayload?.account_type
        ? normalisePlatform(accountStatusPayload.account_type)
        : null) ??
      null;

    logger.info({ event, accountId, provider }, "Unipile webhook received");

    // ── Build human-readable summary ─────────────────────────────────────────
    const senderDisplay: string =
      payload.sender?.attendee_name ??
      payload.sender?.attendee_public_identifier ??
      payload.data?.sender?.name ??
      payload.data?.from?.name ??
      "";

    const messagePreview: string = (
      payload.message ??
      payload.data?.text ??
      payload.data?.body ??
      ""
    ).slice(0, 60);

    let summary = event;
    if (provider) summary += ` (${provider})`;
    if (senderDisplay) summary += ` from ${senderDisplay}`;
    if (messagePreview) summary += `: "${messagePreview}"`;

    appendWebhookEvent({ event, accountId, provider, summary, raw: payload });

    // ── Account status events ─────────────────────────────────────────────────
    const isAccountConnected =
      event === "account_creation_success" ||
      event === "account_connected" ||
      event === "account_reconnected" ||
      event === "account_sync_success";

    const isAccountError =
      event === "account_creation_fail" ||
      event === "account_error" ||
      event === "account_credentials";

    const isAccountStopped =
      event === "account_stopped" ||
      event === "account_deletion";

    if ((isAccountConnected || isAccountError || isAccountStopped) && accountId) {
      const newStatus = isAccountConnected ? "connected" : isAccountStopped ? "disconnected" : "error";

      const accounts = await db
        .select()
        .from(connectedAccountsTable)
        .where(eq(connectedAccountsTable.unipileAccountId, accountId));

      if (accounts[0]) {
        await db
          .update(connectedAccountsTable)
          .set({
            status: newStatus,
            ...(isAccountConnected ? { lastSyncAt: new Date() } : {}),
          })
          .where(eq(connectedAccountsTable.id, accounts[0].id));
      } else if (event === "account_creation_success") {
        const userId = payload.name ?? payload.data?.name ?? null;
        const platform = normalisePlatform(provider) ?? "unknown";
        if (userId) {
          await db.insert(connectedAccountsTable).values({
            id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userId,
            platform,
            accountLabel: platform.charAt(0).toUpperCase() + platform.slice(1),
            unipileAccountId: accountId,
            status: "connected",
            lastSyncAt: new Date(),
            messageCount: 0,
          }).onConflictDoNothing();
          logger.info({ userId, platform, accountId }, "New account registered via webhook");
        }
      }
    }

    // ── Incoming message events ───────────────────────────────────────────────
    const isNewMessage =
      event === "new_message" ||
      event === "message_received";

    if (isNewMessage) {
      // ── Guard: only process webhooks from accounts we know about ──────────
      // Unipile sends every webhook TWICE — once per internal account ID.
      // One is the real account (in our connectedAccounts table), the other
      // is their internal mirror account (not in our DB). Dropping the mirror
      // here prevents duplicate DB writes and duplicate SSE broadcasts.
      if (accountId) {
        const knownAccount = await db
          .select({ id: connectedAccountsTable.id })
          .from(connectedAccountsTable)
          .where(eq(connectedAccountsTable.unipileAccountId, accountId))
          .limit(1);

        if (!knownAccount[0]) {
          logger.debug({ accountId }, "Skipping webhook from unknown Unipile account (mirror)");
          res.json(UnipileWebhookResponse.parse({ status: "ok" }));
          return;
        }
      }

      // ── Extract fields from real Unipile flat payload ─────────────────────
      // Primary format: fields at top level (message_received from Unipile dashboard)
      // Fallback format: nested under data (older/custom integrations)
      const chatId: string | null =
        payload.provider_chat_id ??        // real Unipile format
        payload.data?.chat_id ??
        payload.data?.thread_id ??
        null;

      const rawText: string =
        payload.message ??                 // real Unipile format
        payload.data?.text ??
        payload.data?.body ??
        "";

      const externalMsgId: string | null =
        payload.message_id ??             // real Unipile format
        payload.data?.id ??
        null;

      const sentAtRaw: string | null =
        payload.timestamp ??              // real Unipile format
        payload.data?.date ??
        payload.data?.timestamp ??
        null;

      // is_sender=true means WE sent this message (from phone, WhatsApp Web,
      // or the app itself). Use it to set direction — don't skip these.
      // App-sent messages are deduplicated via the deterministic message ID.
      const isSender: boolean = payload.is_sender === true;
      const direction: "inbound" | "outbound" = isSender ? "outbound" : "inbound";

      // For WhatsApp, we resolve the sender from the saved address-book contacts,
      // not push_name. Compute a preliminary name now; override below once platform
      // is confirmed.
      const rawSenderJid: string = payload.sender?.attendee_public_identifier ?? "";
      let senderName: string = isSender
        ? "Me"
        : (payload.sender?.attendee_name ??
           rawSenderJid ??
           payload.data?.sender?.name ??
           payload.data?.sender?.display_name ??
           payload.data?.from?.name ??
           "Unknown");

      // Derive platform: sender specifics > top-level provider > account lookup
      const rawProvider: string | null =
        payload.sender?.attendee_specifics?.provider ??
        provider;
      const platform = normalisePlatform(rawProvider);

      // WhatsApp: resolve sender from saved address-book contacts (never push_name)
      if (!isSender && platform === "whatsapp" && accountId) {
        const senderPhone = normalizePhone(rawSenderJid);
        if (senderPhone) {
          const [acc] = await db
            .select({ id: connectedAccountsTable.id })
            .from(connectedAccountsTable)
            .where(eq(connectedAccountsTable.unipileAccountId, accountId))
            .limit(1);
          if (acc) {
            const [saved] = await db
              .select({ savedName: whatsappContactsTable.savedName })
              .from(whatsappContactsTable)
              .where(and(eq(whatsappContactsTable.accountId, acc.id), eq(whatsappContactsTable.phoneNumber, senderPhone)))
              .limit(1);
            senderName = saved?.savedName ?? senderPhone;
            logger.debug({ senderPhone, resolved: senderName }, "WhatsApp webhook sender resolved from contacts");
          }
        }
      }

      if (!chatId) {
        logger.warn({ event, payload: JSON.stringify(payload).slice(0, 200) }, "Unipile webhook missing chat ID");
        res.json(UnipileWebhookResponse.parse({ status: "ok" }));
        return;
      }

      // Normalise text — strip WhatsApp LID tokens {{xxx@lid}}
      const bodyText = rawText
        .replace(/\{\{[^}]+\}\}\s*/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const headline = bodyText.slice(0, 120) || null;
      const sentAt = sentAtRaw ? new Date(sentAtRaw) : new Date();

      // ── Look up existing conversation ─────────────────────────────────────
      // Match by Unipile internal ID (externalId) OR by native platform ID
      // (providerChatId, e.g. "919019410659@s.whatsapp.net" for WhatsApp).
      // Unipile webhooks send the native platform ID in provider_chat_id,
      // while our initial sync stores the Unipile internal ID as externalId.
      // We now store both — this OR covers legacy rows where providerChatId
      // wasn't populated yet (until the next Sync All fills them in).
      const existing = await db
        .select()
        .from(conversationsTable)
        .where(
          or(
            eq(conversationsTable.externalId, chatId),
            eq(conversationsTable.providerChatId, chatId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        // ── Backfill providerChatId if missing ────────────────────────────
        // Groups are stored during sync with providerChatId=null because
        // Unipile's chat list doesn't expose the native group JID directly.
        // When the first webhook arrives, we learn the native JID (chatId)
        // and store it so that all subsequent webhook lookups use direct match.
        if (!existing[0].providerChatId && chatId) {
          await db
            .update(conversationsTable)
            .set({ providerChatId: chatId })
            .where(eq(conversationsTable.id, existing[0].id));
          logger.info({ convId: existing[0].id, chatId }, "Backfilled providerChatId for group/conversation");
        }

        // ── Deterministic message ID ───────────────────────────────────────
        // Derive the ID from the provider's message_id so that if the same
        // webhook arrives a second time (retry, mirror account, etc.) the
        // INSERT hits a primary-key conflict and onConflictDoNothing skips it.
        // Random suffix is only used as last resort when message_id is absent.
        const msgId = externalMsgId
          ? `msg_whook_${externalMsgId}`
          : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Use .returning() to detect whether the row was actually inserted or
        // was a duplicate (conflict → returns empty array).
        const inserted = await db.insert(messagesTable).values({
          id: msgId,
          conversationId: existing[0].id,
          userId: existing[0].userId,
          platform: platform ?? existing[0].platform,
          externalId: externalMsgId,
          direction,                        // "inbound" or "outbound" from is_sender
          bodyText: bodyText || "(Media)",
          senderName,
          isRead: isSender ? true : false,  // own sent messages are already "read"
          sentAt,
        }).onConflictDoNothing().returning({ id: messagesTable.id });

        if (inserted.length === 0) {
          // Duplicate — already processed (mirror account webhook or retry). Skip.
          logger.debug({ msgId, externalMsgId, chatId }, "Duplicate message webhook ignored");
        } else {
          await db
            .update(conversationsTable)
            .set({
              ...(headline ? { headline } : {}),
              lastMessageAt: sentAt,
              // Only bump unread count for incoming messages, not our own sends
              ...(isSender ? {} : {
                unreadCount: existing[0].unreadCount + 1,
                isRead: false,
              }),
            })
            .where(eq(conversationsTable.id, existing[0].id));

          broadcastToUser(existing[0].userId, "new_message", {
            conversationId: existing[0].id,
            senderName,
            preview: bodyText.slice(0, 80) || "(Media)",
            platform: platform ?? existing[0].platform,
            direction,
          });

          logger.info(
            { conversationId: existing[0].id, userId: existing[0].userId, chatId, msgId, direction },
            "new_message: saved & broadcast to SSE",
          );
        }
      } else if (accountId) {
        // Unknown conversation — look up account and pull the chat from Unipile
        const account = await db
          .select()
          .from(connectedAccountsTable)
          .where(eq(connectedAccountsTable.unipileAccountId, accountId))
          .limit(1);

        if (account[0]) {
          const resolvedPlatform = platform ?? account[0].platform;

          const convId = await syncChatById(
            chatId,
            accountId,
            account[0].id,
            account[0].userId,
            resolvedPlatform,
          );

          if (convId) {
            broadcastToUser(account[0].userId, "new_message", {
              conversationId: convId,
              senderName,
              preview: bodyText.slice(0, 80) || "(Media)",
              platform: resolvedPlatform,
            });
            logger.info({ convId, chatId }, "new_message: new conversation synced & broadcast");
          }
        } else {
          logger.warn({ chatId, accountId }, "new_message: no matching account in DB for this accountId");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Unipile webhook error");
  }

  res.json(UnipileWebhookResponse.parse({ status: "ok" }));
});

// ── (Slack Events webhook removed) ───────────────────────────────────────────
// Slack integration has been removed.
/*
// Slack sends events here for real-time message delivery.
// The Events URL must be configured in the Slack App's "Event Subscriptions" page.
// Subscribed bot events: message.channels, message.groups, message.im, message.mpim
*/

export default router;
