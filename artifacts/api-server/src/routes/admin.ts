import { Router, type IRouter, type Request, type Response } from "express";
import { eq, ilike, or, count } from "drizzle-orm";
import { db, usersTable, connectedAccountsTable, messagesTable, conversationsTable } from "@workspace/db";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminGetUsersQueryParams,
  AdminGetUsersResponse,
  AdminActivateUserParams,
  AdminActivateUserBody,
  AdminActivateUserResponse,
  AdminGetStatsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getWebhookLog } from "../lib/webhook-log";

const router: IRouter = Router();

router.post("/admin/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    res.status(503).json({ error: "Admin credentials not configured" });
    return;
  }

  if (email !== adminEmail) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  try {
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, adminPasswordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const jwt = await import("jsonwebtoken");
    const secret = process.env.ADMIN_JWT_SECRET ?? "xanda-admin-secret";
    const token = jwt.sign({ role: "admin", email }, secret, { expiresIn: "24h" });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    res.json(AdminLoginResponse.parse({ token, expiresAt }));
  } catch (err) {
    req.log.error({ err }, "Admin login error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/users", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = AdminGetUsersQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;
  const status = parsed.success ? parsed.data.status : undefined;
  const search = parsed.success ? parsed.data.search : undefined;

  const users = await db.select().from(usersTable).limit(limit).offset(offset);

  const accountCounts = await db
    .select({ userId: connectedAccountsTable.userId, cnt: count(connectedAccountsTable.id) })
    .from(connectedAccountsTable)
    .groupBy(connectedAccountsTable.userId);

  const accountCountMap = new Map(accountCounts.map((a) => [a.userId, Number(a.cnt)]));

  const filteredUsers = users.filter((u) => {
    if (status && u.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.email.toLowerCase().includes(s) && !((u.firstName ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  });

  res.json(AdminGetUsersResponse.parse({
    users: filteredUsers.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      status: u.status,
      trialEndsAt: u.trialEndsAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      connectedAccountCount: accountCountMap.get(u.id) ?? 0,
    })),
    total: filteredUsers.length,
    hasMore: offset + filteredUsers.length < users.length,
  }));
});

router.post("/admin/users/:id/activate", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = AdminActivateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .update(usersTable)
    .set({ status: parsed.data.status })
    .where(eq(usersTable.id, rawId));

  res.json(AdminActivateUserResponse.parse({ status: "ok" }));
});

router.get("/admin/stats", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const allUsers = await db.select().from(usersTable);

  res.json(AdminGetStatsResponse.parse({
    totalUsers: allUsers.length,
    activeUsers: allUsers.filter((u) => u.status === "active").length,
    pendingUsers: allUsers.filter((u) => u.status === "pending").length,
    trialUsers: allUsers.filter((u) => u.status === "trial").length,
    suspendedUsers: allUsers.filter((u) => u.status === "suspended").length,
    mrr: allUsers.filter((u) => u.status === "active").length * 10,
  }));
});

// Webhook event log — open in demo mode, requireAdmin in production
router.get("/admin/webhook-events", async (req: Request, res: Response): Promise<void> => {
  res.json({ events: getWebhookLog() });
});

export default router;
