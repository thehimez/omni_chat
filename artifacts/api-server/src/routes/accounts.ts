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
      accountLabel: a.accountLabel ?? null,
      email: a.email ?? null,
      status: a.status,
      lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
      messageCount: a.messageCount,
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

  const { platform } = parsed.data;

  if (platform === "slack") {
    const slackClientId = process.env.SLACK_CLIENT_ID;
    if (!slackClientId) {
      res.status(503).json({ error: "Slack integration not configured" });
      return;
    }
    const redirectUri = `${process.env.APP_URL ?? "https://xandacross.com"}/api/accounts/slack/callback`;
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=channels:read,chat:write,im:history,users:read&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json(ConnectAccountResponse.parse({ authUrl, accountId: null }));
    return;
  }

  const unipileApiKey = process.env.UNIPILE_API_KEY;
  const unipileHost = process.env.UNIPILE_HOST ?? "api19.unipile.com:14946";
  if (!unipileApiKey) {
    res.status(503).json({ error: "Unipile not configured" });
    return;
  }

  try {
    const resp = await fetch(`https://${unipileHost}/api/v1/hosted/accounts/link`, {
      method: "POST",
      headers: {
        "X-API-KEY": unipileApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: platform.toUpperCase(),
        api_url: `https://${unipileHost}`,
        success_redirect_url: `${process.env.APP_URL ?? "https://xandacross.com"}/accounts?connected=${platform}`,
        failure_redirect_url: `${process.env.APP_URL ?? "https://xandacross.com"}/accounts?error=true`,
      }),
    });

    if (!resp.ok) {
      req.log.error({ status: resp.status }, "Unipile hosted auth error");
      res.status(502).json({ error: "Failed to initiate connection" });
      return;
    }

    const data = await resp.json() as { url: string; object: string };
    res.json(ConnectAccountResponse.parse({ authUrl: data.url, accountId: null }));
  } catch (err) {
    req.log.error({ err }, "Account connect error");
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
