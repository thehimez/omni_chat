import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { addSseClient, removeSseClient } from "../lib/sse-broadcaster";
import { logger } from "../lib/logger";

const router = Router();

router.get("/events", async (req: Request, res: Response): Promise<void> => {
  // Cookie-based Clerk auth (same-origin EventSource sends cookies automatically).
  const auth = getAuth(req);
  const clerkId = auth?.userId;

  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!users[0]) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = users[0];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`retry: 3000\n`);
  res.write(`event: connected\ndata: {"status":"connected","userId":"${user.id}"}\n\n`);

  const clientId = addSseClient(user.id, res);
  logger.info({ userId: user.id, clientId }, "SSE client connected");

  // Ping every 10s — Replit's proxy kills idle connections at ~15s
  const ping = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 10000);

  req.on("close", () => {
    clearInterval(ping);
    removeSseClient(clientId);
    logger.info({ clientId }, "SSE client disconnected");
  });
});

export default router;
