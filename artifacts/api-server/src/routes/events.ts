import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { createClerkClient } from "@clerk/backend";
import { addSseClient, removeSseClient } from "../lib/sse-broadcaster";
import { logger } from "../lib/logger";

const router = Router();

async function resolveUserFromToken(token: string): Promise<typeof usersTable.$inferSelect | null> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!clerkSecretKey) {
    const DEMO_USER_ID = "demo_user_xanda";
    let user = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
    if (!user[0]) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      await db.insert(usersTable).values({
        id: DEMO_USER_ID,
        clerkId: "demo_clerk_id",
        email: "demo@xandacross.com",
        firstName: "Demo",
        lastName: "User",
        status: "active",
        trialEndsAt,
      }).onConflictDoNothing();
      user = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
    }
    return user[0] ?? null;
  }

  try {
    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    const payload = await clerk.verifyToken(token);
    const clerkId = payload.sub;
    const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    return user[0] ?? null;
  } catch {
    return null;
  }
}

router.get("/events", async (req: Request, res: Response): Promise<void> => {
  const token =
    (req.headers.authorization?.replace("Bearer ", "")) ||
    (req.query.token as string | undefined);

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await resolveUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Tell the browser to reconnect in 3s if the connection drops
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
