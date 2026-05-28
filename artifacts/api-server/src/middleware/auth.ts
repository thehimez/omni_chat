import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;

  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    let dbUser = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);

    if (!dbUser[0]) {
      // JIT-provision a new user record on first authenticated request
      const { createClerkClient } = await import("@clerk/backend");
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const clerkUser = await clerk.users.getUser(clerkId);

      const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      await db.insert(usersTable).values({
        id: newId,
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
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
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // For admin routes, additionally verify the user has the admin role
  // (set via Clerk public metadata: { role: "admin" })
  const sessionClaims = auth.sessionClaims as Record<string, unknown> | null;
  const role = (sessionClaims?.publicMetadata as Record<string, unknown> | null)?.role;
  if (role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
