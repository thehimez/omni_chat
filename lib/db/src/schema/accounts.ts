import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const connectedAccountsTable = pgTable("connected_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(),
  accountLabel: text("account_label"),
  email: text("email"),
  unipileAccountId: text("unipile_account_id"),
  slackToken: text("slack_token"),
  status: text("status").notNull().default("connected"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertConnectedAccountSchema = createInsertSchema(connectedAccountsTable).omit({ createdAt: true, updatedAt: true });
export type InsertConnectedAccount = z.infer<typeof insertConnectedAccountSchema>;
export type ConnectedAccount = typeof connectedAccountsTable.$inferSelect;
