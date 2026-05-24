import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, notificationSettingsTable } from "@workspace/db";
import {
  GetNotificationSettingsResponse,
  UpdateNotificationSettingsBody,
  UpdateNotificationSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/notifications/settings", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  let settings = await db
    .select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.userId, user.id))
    .limit(1);

  if (!settings[0]) {
    const newId = `ns_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db.insert(notificationSettingsTable).values({
      id: newId,
      userId: user.id,
      emailDigest: true,
      digestFrequency: "daily",
      pushEnabled: false,
      priorityOnly: false,
    });
    settings = await db
      .select()
      .from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.userId, user.id))
      .limit(1);
  }

  res.json(GetNotificationSettingsResponse.parse({
    dailyDigest: settings[0].emailDigest,
    digestTime: settings[0].digestFrequency,
    trialReminders: false,
    priorityAlerts: settings[0].pushEnabled || settings[0].priorityOnly,
  }));
});

router.put("/notifications/settings", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const parsed = UpdateNotificationSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.userId, user.id))
    .limit(1);

  const dbFields = {
    emailDigest: parsed.data.dailyDigest,
    digestFrequency: parsed.data.digestTime ?? "daily",
    pushEnabled: parsed.data.priorityAlerts ?? false,
    priorityOnly: parsed.data.priorityAlerts ?? false,
    trialReminders: false,
  };

  if (!existing[0]) {
    const newId = `ns_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db.insert(notificationSettingsTable).values({
      id: newId,
      userId: user.id,
      ...dbFields,
    });
  } else {
    await db
      .update(notificationSettingsTable)
      .set(dbFields)
      .where(eq(notificationSettingsTable.userId, user.id));
  }

  res.json(UpdateNotificationSettingsResponse.parse({
    dailyDigest: parsed.data.dailyDigest,
    digestTime: parsed.data.digestTime,
    trialReminders: parsed.data.trialReminders,
    priorityAlerts: parsed.data.priorityAlerts,
  }));
});

export default router;
