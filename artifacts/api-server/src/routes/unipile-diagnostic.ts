import { Router, type IRouter, type Request, type Response } from "express";
import { getWebhookLog } from "../lib/webhook-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/unipile/status", async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.UNIPILE_API_KEY;
  const host = process.env.UNIPILE_DSN ?? "api19.unipile.com:14946";
  const webhookUrl = process.env.UNIPILE_WEBHOOK_URL ?? null;

  if (!apiKey) {
    res.status(503).json({ ok: false, error: "UNIPILE_API_KEY not set", accounts: [], host, webhookUrl });
    return;
  }

  try {
    const resp = await fetch(`https://${host}/api/v1/accounts`, {
      headers: {
        "X-API-KEY": apiKey,
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      logger.warn({ status: resp.status, body }, "Unipile status check failed");
      res.status(200).json({
        ok: false,
        httpStatus: resp.status,
        error: `Unipile API returned ${resp.status}`,
        accounts: [],
        host,
        webhookUrl,
      });
      return;
    }

    const data = await resp.json() as {
      items?: Array<{
        id: string;
        name?: string;
        type?: string;
        provider?: string;
        status?: string;
        created_at?: string;
        connection_params?: { mail?: { username?: string }; identifier?: string };
      }>;
    };

    const accounts = (data.items ?? []).map((a) => ({
      id: a.id,
      name: a.name ?? a.connection_params?.mail?.username ?? a.connection_params?.identifier ?? a.id,
      type: a.type ?? a.provider ?? "unknown",
      status: a.status ?? "unknown",
      createdAt: a.created_at ?? null,
    }));

    res.json({ ok: true, accounts, host, webhookUrl, accountCount: accounts.length });
  } catch (err: any) {
    logger.error({ err }, "Unipile status check error");
    res.status(200).json({ ok: false, error: err?.message ?? "Network error", accounts: [], host, webhookUrl });
  }
});

router.get("/unipile/events", (req: Request, res: Response): void => {
  const events = getWebhookLog();
  res.json({ events, total: events.length });
});

router.get("/unipile/events/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const sendSnapshot = () => {
    const events = getWebhookLog();
    res.write(`data: ${JSON.stringify({ events })}\n\n`);
  };

  sendSnapshot();
  const interval = setInterval(sendSnapshot, 2000);

  req.on("close", () => {
    clearInterval(interval);
  });
});

export default router;
