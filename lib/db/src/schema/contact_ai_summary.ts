import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactAiSummaryTable = pgTable("contact_ai_summary", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: text("contact_id").notNull(),
  conversationId: text("conversation_id"),
  summaryType: text("summary_type").notNull(),
  content: text("content").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const insertContactAiSummarySchema = createInsertSchema(contactAiSummaryTable).omit({ generatedAt: true });
export type InsertContactAiSummary = z.infer<typeof insertContactAiSummarySchema>;
export type ContactAiSummary = typeof contactAiSummaryTable.$inferSelect;
