import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable } from "@workspace/db";
import {
  GetConnectedAccountsResponse,
  ConnectAccountBody,
  ConnectAccountResponse,
  DisconnectAccountParams,
  DisconnectAccountResponse,
  TriggerSyncParams,
  TriggerSyncBody,
  TriggerSyncResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PLATFORM_TO_UNIPILE_PROVIDER: Record<string, string> = {
  gmail: "GOOGLE",
  outlook: "OUTLOOK",
  whatsapp: "WHATSAPP",
  linkedin: "LINKEDIN",
  instagram: "INSTAGRAM",
  telegram: "TELEGRAM",
  messenger: "MESSENGER",
  twitter: "TWITTER",
};

router.get("/accounts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const accounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, user.id));

  res.json(GetConnectedAccountsResponse.parse({
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      displayName: a.accountLabel ?? a.platform,
      externalId: a.unipileAccountId ?? a.slackToken ?? null,
      status: a.status,
      lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
      syncProgress: null,
    })),
  }));
});

router.post("/accounts/connect", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = ConnectAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { platform, redirectBase } = parsed.data;

  // Determine base URL for redirects — prefer what the frontend sent (its own origin),
  // then APP_URL env var, then REPLIT_DEV_DOMAIN, then fallback.
  const appUrl =
    redirectBase ??
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://xandacross.com");

  if (platform === "slack") {
    const slackClientId = process.env.SLACK_CLIENT_ID;
    if (!slackClientId) {
      res.status(503).json({ error: "Slack integration not configured" });
      return;
    }
    const redirectUri = `${appUrl}/api/accounts/slack/callback`;
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=channels:read,chat:write,im:history,users:read&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json(ConnectAccountResponse.parse({ authUrl, connectionId: null, status: "pending" }));
    return;
  }

  const unipileApiKey = process.env.UNIPILE_API_KEY;
  const unipileHost = process.env.UNIPILE_DSN ?? process.env.UNIPILE_HOST ?? "api19.unipile.com:14946";
  if (!unipileApiKey) {
    res.status(503).json({ error: "Unipile not configured" });
    return;
  }

  const provider = PLATFORM_TO_UNIPILE_PROVIDER[platform];
  if (!provider) {
    res.status(400).json({ error: `Unsupported platform: ${platform}` });
    return;
  }

  const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, ".000Z");

  try {
    const resp = await fetch(`https://${unipileHost}/api/v1/hosted/accounts/link`, {
      method: "POST",
      headers: {
        "X-API-KEY": unipileApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        type: "create",
        providers: [provider],
        expiresOn,
        api_url: `https://${unipileHost}`,
        name: user.id,
        success_redirect_url: `${appUrl}/accounts?connected=${platform}&account_id={account_id}`,
        failure_redirect_url: `${appUrl}/accounts?error=true`,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      req.log.error({ status: resp.status, body: errBody }, "Unipile hosted auth error");
      res.status(502).json({ error: "Failed to initiate connection" });
      return;
    }

    const data = await resp.json() as { url?: string; object?: string };
    res.json(ConnectAccountResponse.parse({ authUrl: data.url ?? null, connectionId: null, status: "pending" }));
  } catch (err) {
    req.log.error({ err }, "Account connect error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Called by the frontend after Unipile redirects back with ?account_id=
// Upserts the account row so the user sees it immediately (webhook may lag)
router.post("/accounts/confirm", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { platform, unipileAccountId } = req.body as { platform?: string; unipileAccountId?: string };

  if (!platform || !unipileAccountId) {
    res.status(400).json({ error: "platform and unipileAccountId are required" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.unipileAccountId, unipileAccountId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(connectedAccountsTable)
        .set({ status: "connected", lastSyncAt: new Date() })
        .where(eq(connectedAccountsTable.id, existing[0].id));
    } else {
      const PROVIDER_TO_LABEL: Record<string, string> = {
        gmail: "Personal Gmail", outlook: "Work Outlook", whatsapp: "Personal WhatsApp",
        linkedin: "LinkedIn", instagram: "Instagram", telegram: "Telegram", slack: "Slack",
      };
      await db.insert(connectedAccountsTable).values({
        id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: user.id,
        platform,
        accountLabel: PROVIDER_TO_LABEL[platform] ?? platform,
        unipileAccountId,
        status: "connected",
        lastSyncAt: new Date(),
        messageCount: 0,
      });
    }

    res.json({ status: "ok" });
  } catch (err) {
    req.log.error({ err }, "Account confirm error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/accounts/:id/disconnect", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  await db
    .delete(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, rawId), eq(connectedAccountsTable.userId, user.id)));

  res.json(DisconnectAccountResponse.parse({ status: "ok" }));
});

router.post("/accounts/:id/sync", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const account = await db
    .select()
    .from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, rawId), eq(connectedAccountsTable.userId, user.id)))
    .limit(1);

  if (!account[0]) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db
    .update(connectedAccountsTable)
    .set({ status: "syncing" })
    .where(eq(connectedAccountsTable.id, rawId));

  res.json(TriggerSyncResponse.parse({ jobId: `sync_${rawId}_${Date.now()}`, status: "queued" }));
});

export default router;
