import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, connectedAccountsTable, conversationsTable, messagesTable } from "@workspace/db";
import { StripeWebhookResponse, UnipileWebhookResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

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

router.post("/webhooks/unipile", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body as {
      event?: string;
      account_id?: string;
      data?: {
        id?: string;
        chat_id?: string;
        text?: string;
        sender?: { name?: string; id?: string };
        provider?: string;
        date?: string;
      };
    };

    logger.info({ event: payload.event }, "Unipile webhook received");

    if (payload.event === "account_connected" && payload.account_id) {
      const accounts = await db
        .select()
        .from(connectedAccountsTable)
        .where(eq(connectedAccountsTable.unipileAccountId, payload.account_id));

      if (accounts[0]) {
        await db
          .update(connectedAccountsTable)
          .set({ status: "connected", lastSyncAt: new Date() })
          .where(eq(connectedAccountsTable.id, accounts[0].id));
      }
    }

    if (payload.event === "message_received" && payload.data) {
      const data = payload.data;
      const convId = `conv_${data.chat_id ?? Date.now()}`;
      const msgId = `msg_${data.id ?? Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const existing = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.externalId, data.chat_id ?? ""))
        .limit(1);

      if (existing[0]) {
        await db.insert(messagesTable).values({
          id: msgId,
          conversationId: existing[0].id,
          userId: existing[0].userId,
          platform: data.provider ?? "unknown",
          externalId: data.id,
          direction: "inbound",
          bodyText: data.text ?? "",
          senderName: data.sender?.name ?? "Unknown",
          isRead: false,
          sentAt: data.date ? new Date(data.date) : new Date(),
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
  } catch (err) {
    logger.error({ err }, "Unipile webhook error");
  }

  res.json(UnipileWebhookResponse.parse({ status: "ok" }));
});

export default router;
