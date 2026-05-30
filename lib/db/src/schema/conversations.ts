import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(),
  externalId: text("external_id"),
  providerChatId: text("provider_chat_id"),
  contactName: text("contact_name").notNull(),
  contactAvatarUrl: text("contact_avatar_url"),
  contactId: text("contact_id"),
  topicLabel: text("topic_label"),
  headline: text("headline"),
  priority: text("priority").notNull().default("medium"),
  isRead: boolean("is_read").notNull().default(false),
  unreadCount: integer("unread_count").notNull().default(0),
  draftReply: text("draft_reply"),
  aiSummary: text("ai_summary"),
  aiPriorityScore: integer("ai_priority_score"),
  needsReply: boolean("needs_reply").notNull().default(false),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertConversationSchema = createInsertSchema(
  conversationsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
