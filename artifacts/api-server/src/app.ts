import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, connectedAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { syncAccount } from "./lib/unipile-sync";

const app: Express = express();

// ── Background auto-sync ──────────────────────────────────────────────────────
// Runs every 2 minutes. Covers:
//   • Gmail outbound (no webhooks for sent mail — must poll)
//   • Any group/conversation whose providerChatId hasn't been backfilled yet
//   • New chats/emails that arrived while the server was briefly offline
// This makes Sync All a manual backup, not a required action.
const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

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

// Start the background sync loop once the process is running
// (first run after 30s to let the server finish startup)
setTimeout(() => {
  runBackgroundSync();
  setInterval(runBackgroundSync, BACKGROUND_SYNC_INTERVAL_MS);
}, 30_000);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);


export default app;
