import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetMeResponse, GetUserStatusResponse } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetMeResponse.parse({
    id: dbUser[0].id,
    clerkId: dbUser[0].clerkId,
    email: dbUser[0].email,
    firstName: dbUser[0].firstName,
    lastName: dbUser[0].lastName,
    avatarUrl: dbUser[0].avatarUrl,
    status: dbUser[0].status,
    trialEndsAt: dbUser[0].trialEndsAt?.toISOString() ?? null,
    createdAt: dbUser[0].createdAt.toISOString(),
  }));
});

router.get("/auth/status", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const now = new Date();
  const trialEndsAt = dbUser[0].trialEndsAt;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const isActive = dbUser[0].status === "active" || (dbUser[0].status === "trial" && (!trialEndsAt || trialEndsAt > now));
  res.json(GetUserStatusResponse.parse({
    status: dbUser[0].status,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    isActive,
  }));
});

export default router;
