import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { createClerkClient } from "@clerk/backend";

const DEMO_USER_ID = "demo_user_xanda";
const DEMO_CLERK_ID = "demo_clerk_id";

async function ensureDemoUser(): Promise<typeof usersTable.$inferSelect> {
  let user = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
  if (!user[0]) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    await db.insert(usersTable).values({
      id: DEMO_USER_ID,
      clerkId: DEMO_CLERK_ID,
      email: "demo@xandacross.com",
      firstName: "Demo",
      lastName: "User",
      status: "active",
      trialEndsAt,
    });
    user = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
  }
  return user[0];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const isDemoMode = !clerkSecretKey;

  if (isDemoMode) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const demoUser = await ensureDemoUser();
    (req as any).user = demoUser;
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);

  try {
    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    const payload = await clerk.verifyToken(token);
    const clerkId = payload.sub;

    let dbUser = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);

    if (!dbUser[0]) {
      const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      // Fetch full user profile from Clerk
      const clerkUser = await clerk.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      await db.insert(usersTable).values({
        id: newId,
        clerkId,
        email,
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        avatarUrl: clerkUser.imageUrl ?? null,
        status: "trial",
        trialEndsAt,
      });
      dbUser = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    }

    (req as any).user = dbUser[0];
    next();
  } catch (err) {
    logger.error({ err }, "Auth middleware error");
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const jwt = require("jsonwebtoken");
    const secret = process.env.ADMIN_JWT_SECRET ?? "xanda-admin-secret";
    const payload = jwt.verify(token, secret) as { role: string };
    if (payload.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid admin token" });
  }
}
