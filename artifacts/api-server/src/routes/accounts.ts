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
import { syncAccount } from "../lib/unipile-sync";
import { broadcastToUser } from "../lib/sse-broadcaster";
import { syncSlack } from "../lib/slack-sync";

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
    // Bot scopes: read + history for all conversation types, send messages, user info
    const scopes = [
      "channels:read", "channels:history",
      "groups:read", "groups:history",
      "im:read", "im:history",
      "mpim:read", "mpim:history",
      "chat:write",
      "users:read", "users:read.email",
    ].join(",");
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
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

    // Kick off background sync so inbox populates right away
    const confirmedId = existing[0]?.id ?? `acc_${Date.now()}_tmp`;
    // Re-fetch to get the actual inserted ID
    const fresh = await db
      .select()
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.unipileAccountId, unipileAccountId))
      .limit(1);

    if (fresh[0]) {
      syncAccount(fresh[0].id, user.id).catch((err) => {
        logger.warn({ err }, "Background sync after confirm failed");
      });
    }

    res.json({ status: "ok" });
  } catch (err) {
    req.log.error({ err }, "Account confirm error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Slack OAuth callback (no auth middleware — Slack redirects here directly) ──
router.get("/accounts/slack/callback", async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  const appUrl =
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");

  if (error || !code) {
    res.redirect(`${appUrl}/accounts?error=slack_denied`);
    return;
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.redirect(`${appUrl}/accounts?error=slack_not_configured`);
    return;
  }

  try {
    const redirectUri = `${appUrl}/api/accounts/slack/callback`;
    const tokenResp = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenResp.json() as {
      ok: boolean;
      error?: string;
      access_token?: string;
      bot_user_id?: string;
      team?: { name?: string; id?: string };
      authed_user?: { id?: string };
    };

    if (!tokenData.ok || !tokenData.access_token) {
      logger.error({ error: tokenData.error }, "Slack OAuth token exchange failed");
      res.redirect(`${appUrl}/accounts?error=slack_auth_failed`);
      return;
    }

    const token = tokenData.access_token;
    const teamName = tokenData.team?.name ?? "Slack";
    const teamId = tokenData.team?.id ?? "unknown";

    // Upsert connected account — store token in slackToken column
    const accountId = `acc_slack_${teamId}`;
    await db
      .insert(connectedAccountsTable)
      .values({
        id: accountId,
        userId: "demo_user_xanda", // demo mode — single user
        platform: "slack",
        accountLabel: teamName,
        slackToken: token,
        status: "connected",
        lastSyncAt: new Date(),
        messageCount: 0,
      })
      .onConflictDoUpdate({
        target: [connectedAccountsTable.id],
        set: { slackToken: token, status: "connected", lastSyncAt: new Date() },
      });

    logger.info({ accountId, teamName }, "Slack account connected");

    // Kick off background sync
    syncSlack("demo_user_xanda", accountId, token).catch((err) => {
      logger.warn({ err, accountId }, "Slack initial sync failed");
    });

    res.redirect(`${appUrl}/accounts?connected=slack`);
  } catch (err) {
    logger.error({ err }, "Slack OAuth callback error");
    res.redirect(`${appUrl}/accounts?error=slack_callback_failed`);
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

  const jobId = `sync_${rawId}_${Date.now()}`;

  // Tell the UI the sync just kicked off — so the Accounts page can show a
  // live "syncing" indicator without polling.
  broadcastToUser(user.id, "account_sync_started", {
    accountId: rawId,
    platform: account[0].platform,
    jobId,
  });

  // Run sync in background — respond immediately so the UI isn't blocked
  syncAccount(rawId, user.id)
    .then(({ synced, platform }) => {
      logger.info({ jobId, synced, platform }, "Sync job completed");
      // Notify all connected SSE clients for this user so the inbox refetches
      broadcastToUser(user.id, "sync_complete", { platform, synced });
      broadcastToUser(user.id, "account_sync_finished", {
        accountId: rawId,
        platform,
        synced,
        jobId,
        status: "success",
      });
    })
    .catch((err) => {
      logger.error({ err, jobId }, "Sync job failed");
      broadcastToUser(user.id, "account_sync_finished", {
        accountId: rawId,
        platform: account[0].platform,
        jobId,
        status: "error",
      });
    });

  res.json(TriggerSyncResponse.parse({ jobId, status: "queued" }));
});

export default router;
