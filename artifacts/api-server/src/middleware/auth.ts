import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

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

  // Demo mode: no Clerk configured -> use demo user for any bearer token
  const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const isDemoMode = !clerkPublishableKey || !clerkSecretKey;

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

  // Production mode: Clerk JWT verification
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);

  try {
    const response = await fetch("https://api.clerk.com/v1/tokens/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const payload = await response.json() as { sub: string; email_address?: string };
    const clerkId = payload.sub;

    let dbUser = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);

    if (!dbUser[0]) {
      const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      await db.insert(usersTable).values({
        id: newId,
        clerkId,
        email: payload.email_address ?? "",
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
