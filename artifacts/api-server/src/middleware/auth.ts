import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);

  try {
    const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
    if (!clerkPublishableKey) {
      res.status(503).json({ error: "Auth service unavailable" });
      return;
    }

    const response = await fetch("https://api.clerk.com/v1/tokens/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
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
