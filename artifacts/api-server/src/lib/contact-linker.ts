import { eq, and, desc } from "drizzle-orm";
import { db, contactsTable, conversationsTable } from "@workspace/db";
import { createHash } from "crypto";

/**
 * MD5 hash — matches the Postgres MD5() function so IDs are consistent
 * whether contacts are created by the sync pipeline or via SQL backfill.
 */
function stableHash(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

/** Normalize a contact name for identity matching */
function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Upsert a contact record and link the given conversation to it.
 * Returns the contactId.
 *
 * Strategy: one contact per (userId, normalized display name). Simple but safe
 * for Phase 1 — no false merges across different people with similar names.
 */
export async function upsertContactForConversation(
  userId: string,
  contactName: string,
  platform: string,
  avatarUrl: string | null,
  convId: string,
  lastMessageAt: Date,
): Promise<string> {
  if (!contactName || contactName === "Me") return "";

  const normalized = normalizeDisplayName(contactName);
  const contactId = `contact_${stableHash(userId + "_" + normalized)}`;

  // Read current contact to decide how to update platforms[]
  const existing = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, contactId))
    .limit(1);

  if (existing[0]) {
    const platforms = existing[0].platforms ?? [];
    const updatedPlatforms = platforms.includes(platform)
      ? platforms
      : [...platforms, platform];

    await db
      .update(contactsTable)
      .set({
        displayName: existing[0].displayName,
        avatarUrl: existing[0].avatarUrl ?? avatarUrl,
        platforms: updatedPlatforms,
        lastSeenAt:
          !existing[0].lastSeenAt || lastMessageAt > existing[0].lastSeenAt
            ? lastMessageAt
            : existing[0].lastSeenAt,
      })
      .where(eq(contactsTable.id, contactId));
  } else {
    await db.insert(contactsTable).values({
      id: contactId,
      userId,
      displayName: contactName,
      avatarUrl,
      platforms: [platform],
      conversationCount: 0,
      lastSeenAt: lastMessageAt,
    }).onConflictDoNothing();
  }

  // Link the conversation to this contact
  await db
    .update(conversationsTable)
    .set({ contactId })
    .where(and(eq(conversationsTable.id, convId), eq(conversationsTable.userId, userId)));

  return contactId;
}

/**
 * Backfill all unlinked conversations for a user.
 * Groups by normalized contactName — one contact per unique name.
 * Returns count of contacts created/updated.
 */
export async function backfillContactsForUser(userId: string): Promise<{ contacts: number; linked: number }> {
  const convs = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, userId))
    .orderBy(desc(conversationsTable.lastMessageAt));

  if (convs.length === 0) return { contacts: 0, linked: 0 };

  // Group conversations by normalized name
  const groups = new Map<string, typeof convs>();
  for (const conv of convs) {
    if (!conv.contactName || conv.contactName === "Me") continue;
    const key = normalizeDisplayName(conv.contactName);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(conv);
  }

  let contactsCreated = 0;
  let linked = 0;

  for (const [, group] of groups) {
    const representative = group[0]; // most recent conversation
    const normalized = normalizeDisplayName(representative.contactName);
    const contactId = `contact_${stableHash(userId + "_" + normalized)}`;

    // Derive platform list and counts from the group
    const platforms = [...new Set(group.map((c) => c.platform))];
    const lastSeenAt = group.reduce<Date | null>((best, c) => {
      return !best || c.lastMessageAt > best ? c.lastMessageAt : best;
    }, null);

    const existing = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.id, contactId))
      .limit(1);

    if (!existing[0]) {
      await db.insert(contactsTable).values({
        id: contactId,
        userId,
        displayName: representative.contactName,
        avatarUrl: representative.contactAvatarUrl ?? null,
        platforms,
        conversationCount: group.length,
        lastSeenAt,
      }).onConflictDoNothing();
      contactsCreated++;
    } else {
      const mergedPlatforms = [...new Set([...(existing[0].platforms ?? []), ...platforms])];
      await db.update(contactsTable).set({
        platforms: mergedPlatforms,
        conversationCount: group.length,
        lastSeenAt: (!existing[0].lastSeenAt || (lastSeenAt && lastSeenAt > existing[0].lastSeenAt))
          ? lastSeenAt
          : existing[0].lastSeenAt,
        avatarUrl: existing[0].avatarUrl ?? representative.contactAvatarUrl ?? null,
      }).where(eq(contactsTable.id, contactId));
    }

    // Link all conversations in this group
    for (const conv of group) {
      if (conv.contactId !== contactId) {
        await db.update(conversationsTable)
          .set({ contactId })
          .where(eq(conversationsTable.id, conv.id));
        linked++;
      }
    }
  }

  return { contacts: contactsCreated, linked };
}
