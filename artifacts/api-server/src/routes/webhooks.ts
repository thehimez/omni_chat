import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, connectedAccountsTable, conversationsTable, messagesTable } from "@workspace/db";
import { StripeWebhookResponse, UnipileWebhookResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { appendWebhookEvent } from "../lib/webhook-log";

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

router.post("/webhooks/unipile", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body as {
      event?: string;
      account_id?: string;
      data?: {
        id?: string;
        chat_id?: string;
        thread_id?: string;
        text?: string;
        body?: string;
        sender?: { name?: string; display_name?: string; id?: string };
        from?: { name?: string; display_name?: string };
        provider?: string;
        date?: string;
        timestamp?: string;
      };
    };

    const event = payload.event ?? "unknown";
    const accountId = payload.account_id ?? null;
    const data = payload.data;
    const provider = data?.provider ?? null;

    logger.info({ event, accountId, provider }, "Unipile webhook received");

    // ── Build human-readable summary for the event log ──────────────────────
    let summary = event;
    if (provider) summary += ` (${provider})`;
    if (data?.sender?.name || data?.sender?.display_name || data?.from?.name) {
      summary += ` from ${data.sender?.name ?? data.sender?.display_name ?? data.from?.name}`;
    }
    if (data?.text || data?.body) {
      const preview = (data.text ?? data.body ?? "").slice(0, 60);
      if (preview) summary += `: "${preview}"`;
    }

    // Store in in-memory event log for the Admin panel
    appendWebhookEvent({ event, accountId, provider, summary, raw: payload });

    // ── Account events ───────────────────────────────────────────────────────
    const isAccountConnected =
      event === "account_creation_success" ||
      event === "account_connected" ||       // legacy
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
        // First-time connection: insert a new row
        // `name` field in Unipile payload carries the userId we passed during hosted auth
        const userId = (payload as any).name ?? (payload as any).data?.name ?? null;
        const platformFromProvider = provider
          ? Object.entries({
              GOOGLE: "gmail", OUTLOOK: "outlook", WHATSAPP: "whatsapp",
              LINKEDIN: "linkedin", INSTAGRAM: "instagram", TELEGRAM: "telegram",
              MESSENGER: "messenger", TWITTER: "twitter",
            }).find(([k]) => k === provider)?.[1] ?? provider.toLowerCase()
          : "unknown";

        if (userId) {
          await db.insert(connectedAccountsTable).values({
            id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userId,
            platform: platformFromProvider,
            accountLabel: platformFromProvider.charAt(0).toUpperCase() + platformFromProvider.slice(1),
            unipileAccountId: accountId,
            status: "connected",
            lastSyncAt: new Date(),
            messageCount: 0,
          }).onConflictDoNothing();
          logger.info({ userId, platform: platformFromProvider, accountId }, "New account registered via webhook");
        } else {
          logger.warn({ accountId, provider }, "account_creation_success webhook missing userId (name field)");
        }
      }
    }

    // ── Incoming message events ──────────────────────────────────────────────
    const isNewMessage =
      event === "new_message" ||
      event === "message_received";   // legacy

    if (isNewMessage && data) {
      const chatId = data.chat_id ?? data.thread_id;
      if (!chatId) {
        logger.warn({ event }, "new_message webhook missing chat_id");
      } else {
        const msgId = `msg_${data.id ?? Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const senderName =
          data.sender?.name ?? data.sender?.display_name ??
          data.from?.name ?? data.from?.display_name ?? "Unknown";
        const bodyText = data.text ?? data.body ?? "";
        const sentAt = data.date ?? data.timestamp;

        const existing = await db
          .select()
          .from(conversationsTable)
          .where(eq(conversationsTable.externalId, chatId))
          .limit(1);

        if (existing[0]) {
          await db.insert(messagesTable).values({
            id: msgId,
            conversationId: existing[0].id,
            userId: existing[0].userId,
            platform: provider ?? "unknown",
            externalId: data.id,
            direction: "inbound",
            bodyText,
            senderName,
            isRead: false,
            sentAt: sentAt ? new Date(sentAt) : new Date(),
          }).onConflictDoNothing();

          await db
            .update(conversationsTable)
            .set({
              lastMessageAt: new Date(),
              unreadCount: existing[0].unreadCount + 1,
              isRead: false,
            })
            .where(eq(conversationsTable.id, existing[0].id));
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Unipile webhook error");
  }

  res.json(UnipileWebhookResponse.parse({ status: "ok" }));
});

export default router;
