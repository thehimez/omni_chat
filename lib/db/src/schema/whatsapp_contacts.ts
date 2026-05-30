import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const whatsappContactsTable = pgTable(
  "whatsapp_contacts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    phoneNumber: text("phone_number").notNull(),
    savedName: text("saved_name").notNull(),
    avatarUrl: text("avatar_url"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("wa_contacts_account_phone_idx").on(t.accountId, t.phoneNumber),
  ],
);

export type WhatsappContact = typeof whatsappContactsTable.$inferSelect;
