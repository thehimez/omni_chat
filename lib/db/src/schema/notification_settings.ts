import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationSettingsTable = pgTable("notification_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  emailDigest: boolean("email_digest").notNull().default(true),
  digestFrequency: text("digest_frequency").notNull().default("daily"),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  priorityOnly: boolean("priority_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettingsTable).omit({ createdAt: true, updatedAt: true });
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type NotificationSettings = typeof notificationSettingsTable.$inferSelect;
