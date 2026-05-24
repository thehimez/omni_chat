import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateCheckoutBody,
  CreateCheckoutResponse,
  GetBillingPortalResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/billing/checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID ?? "price_placeholder",
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL ?? "https://xandacross.com"}/billing?success=true`,
      cancel_url: `${process.env.APP_URL ?? "https://xandacross.com"}/billing?canceled=true`,
      metadata: { userId: user.id },
    });

    res.json(CreateCheckoutResponse.parse({ url: session.url ?? "" }));
  } catch (err) {
    req.log.error({ err }, "Stripe checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/billing/portal", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  const dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser[0]?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found" });
    return;
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser[0].stripeCustomerId,
      return_url: `${process.env.APP_URL ?? "https://xandacross.com"}/billing`,
    });

    res.json(GetBillingPortalResponse.parse({ url: session.url }));
  } catch (err) {
    req.log.error({ err }, "Stripe portal error");
    res.status(500).json({ error: "Failed to create billing portal" });
  }
});

export default router;
