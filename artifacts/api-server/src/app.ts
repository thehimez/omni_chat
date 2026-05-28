import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, connectedAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { syncAccount } from "./lib/unipile-sync";

const app: Express = express();

// ── Background auto-sync ──────────────────────────────────────────────────────
const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 1000;

async function runBackgroundSync(): Promise<void> {
  try {
    const accounts = await db
      .select()
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.status, "connected"));

    if (accounts.length === 0) return;

    logger.debug({ count: accounts.length }, "Background sync: starting");

    await Promise.allSettled(
      accounts.map((account) =>
        syncAccount(account.id, account.userId).catch((err) => {
          logger.warn({ err, accountId: account.id, platform: account.platform }, "Background sync: account failed");
        }),
      ),
    );

    logger.debug("Background sync: complete");
  } catch (err) {
    logger.warn({ err }, "Background sync: failed");
  }
}

setTimeout(() => {
  runBackgroundSync();
  setInterval(runBackgroundSync, BACKGROUND_SYNC_INTERVAL_MS);
}, 30_000);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Clerk proxy (must come before body parsers — streams raw bytes) ────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Clerk session middleware ───────────────────────────────────────────────────
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
