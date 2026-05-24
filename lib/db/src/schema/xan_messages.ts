import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const xanMessagesTable = pgTable("xan_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  conversationId: text("conversation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertXanMessageSchema = createInsertSchema(xanMessagesTable).omit({ createdAt: true });
export type InsertXanMessage = z.infer<typeof insertXanMessageSchema>;
export type XanMessage = typeof xanMessagesTable.$inferSelect;
