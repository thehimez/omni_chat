import { pgTable, text, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactFactsTable = pgTable("contact_facts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: text("contact_id").notNull(),
  factType: text("fact_type").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull(),
  confidence: real("confidence"),
  extractedFrom: text("extracted_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContactFactSchema = createInsertSchema(contactFactsTable).omit({ createdAt: true, updatedAt: true });
export type InsertContactFact = z.infer<typeof insertContactFactSchema>;
export type ContactFact = typeof contactFactsTable.$inferSelect;
