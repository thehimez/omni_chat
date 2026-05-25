import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable, conversationsTable, messagesTable } from "@workspace/db";
import { logger } from "./logger";

const EMAIL_PLATFORMS = new Set(["gmail", "outlook"]);
const CHAT_PLATFORMS = new Set(["whatsapp", "linkedin", "instagram", "telegram", "messenger", "twitter"]);

function unipileHeaders(apiKey: string) {
  return { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

// ─── Email sync (Gmail / Outlook) ─────────────────────────────────────────────

async function syncEmails(
  userId: string,
  accountId: string,
  unipileAccountId: string,
  host: string,
  apiKey: string,
): Promise<number> {
  const url = `https://${host}/api/v1/emails?account_id=${unipileAccountId}&limit=40`;
  const resp = await fetch(url, { headers: unipileHeaders(apiKey) });
  if (!resp.ok) {
    const body = await resp.text();
    logger.warn({ status: resp.status, body }, "Unipile emails fetch failed");
    return 0;
  }

  const data = await resp.json() as {
    items?: Array<{
      id: string;
      thread_id?: string;
      account_id?: string;
      from_attendee?: { name?: string; identifier?: string };
      subject?: string;
      snippet?: string;
      date?: string;
      unread?: boolean;
      folders?: string[];
    }>;
  };

  const emails = data.items ?? [];
  if (emails.length === 0) return 0;

  // Group by thread_id so one conversation = one thread
  const threads = new Map<string, typeof emails>();
  for (const email of emails) {
    const key = email.thread_id ?? email.id;
    if (!threads.has(key)) threads.set(key, []);
    threads.get(key)!.push(email);
  }

  let saved = 0;
  for (const [threadId, threadEmails] of threads) {
    // Sort oldest first
    threadEmails.sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
    const latest = threadEmails[threadEmails.length - 1];
    const contactName = latest.from_attendee?.name ?? latest.from_attendee?.identifier ?? "Unknown";
    const subject = latest.subject ?? "(No subject)";

    const convId = `conv_${accountId}_${threadId.slice(-16)}`;

    // Upsert conversation
    const existing = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.externalId, threadId)))
      .limit(1);

    if (!existing[0]) {
      await db.insert(conversationsTable).values({
        id: convId,
        userId,
        platform: "gmail",
        externalId: threadId,
        contactName,
        topicLabel: subject,
        headline: latest.snippet?.slice(0, 120) ?? null,
        priority: "medium",
        isRead: !(latest.unread ?? false),
        unreadCount: threadEmails.filter((e) => e.unread).length,
        lastMessageAt: latest.date ? new Date(latest.date) : new Date(),
      }).onConflictDoNothing();
    }

    const actualConvId = existing[0]?.id ?? convId;

    // Upsert messages for this thread
    for (const email of threadEmails) {
      const msgId = `msg_${accountId}_${email.id.slice(-20)}`;
      const existingMsg = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.externalId, email.id))
        .limit(1);

      if (!existingMsg[0]) {
        const senderName = email.from_attendee?.name ?? email.from_attendee?.identifier ?? "Unknown";
        await db.insert(messagesTable).values({
          id: msgId,
          conversationId: actualConvId,
          userId,
          platform: "gmail",
          externalId: email.id,
          direction: "inbound",
          bodyText: email.snippet ?? "(No preview)",
          senderName,
          isRead: !(email.unread ?? false),
          sentAt: email.date ? new Date(email.date) : new Date(),
        }).onConflictDoNothing();
        saved++;
      }
    }
  }

  return saved;
}

// ─── Chat sync (WhatsApp, LinkedIn, Telegram, Instagram…) ────────────────────

async function syncChats(
  userId: string,
  accountId: string,
  platform: string,
  unipileAccountId: string,
  host: string,
  apiKey: string,
): Promise<number> {
  const url = `https://${host}/api/v1/chats?account_id=${unipileAccountId}&limit=30`;
  const resp = await fetch(url, { headers: unipileHeaders(apiKey) });
  if (!resp.ok) {
    const body = await resp.text();
    logger.warn({ status: resp.status, body, platform }, "Unipile chats fetch failed");
    return 0;
  }

  const data = await resp.json() as {
    items?: Array<{
      id: string;
      account_id?: string;
      provider?: string;
      name?: string;
      last_message_date?: string;
      unread_count?: number;
      attendees?: Array<{ name?: string; identifier?: string; is_sender?: boolean }>;
    }>;
  };

  const chats = data.items ?? [];
  if (chats.length === 0) return 0;

  let saved = 0;

  for (const chat of chats.slice(0, 25)) {
    const chatId = chat.id;
    const contactName = chat.name ?? chat.attendees?.find((a) => !a.is_sender)?.name ?? "Unknown";
    const convId = `conv_${accountId}_${chatId.slice(-16)}`;

    // Upsert conversation
    const existing = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.externalId, chatId)))
      .limit(1);

    if (!existing[0]) {
      await db.insert(conversationsTable).values({
        id: convId,
        userId,
        platform,
        externalId: chatId,
        contactName,
        priority: "medium",
        isRead: (chat.unread_count ?? 0) === 0,
        unreadCount: chat.unread_count ?? 0,
        lastMessageAt: chat.last_message_date ? new Date(chat.last_message_date) : new Date(),
      }).onConflictDoNothing();
    }

    const actualConvId = existing[0]?.id ?? convId;

    // Fetch recent messages for this chat
    try {
      const msgUrl = `https://${host}/api/v1/chats/${chatId}/messages?limit=15`;
      const msgResp = await fetch(msgUrl, { headers: unipileHeaders(apiKey) });
      if (!msgResp.ok) continue;

      const msgData = await msgResp.json() as {
        items?: Array<{
          id: string;
          text?: string;
          body?: string;
          is_sender?: boolean;
          sender?: { name?: string; display_name?: string; identifier?: string };
          from?: { name?: string };
          date?: string;
          timestamp?: string;
        }>;
      };

      for (const msg of (msgData.items ?? []).reverse()) {
        const msgId = `msg_${accountId}_${msg.id.slice(-20)}`;
        const existingMsg = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.externalId, msg.id))
          .limit(1);

        if (!existingMsg[0]) {
          const senderName =
            msg.sender?.name ?? msg.sender?.display_name ?? msg.sender?.identifier ??
            msg.from?.name ?? "Unknown";
          const bodyText = msg.text ?? msg.body ?? "";
          const sentAt = msg.date ?? msg.timestamp;

          await db.insert(messagesTable).values({
            id: msgId,
            conversationId: actualConvId,
            userId,
            platform,
            externalId: msg.id,
            direction: msg.is_sender ? "outbound" : "inbound",
            bodyText: bodyText || "(Media message)",
            senderName,
            isRead: true,
            sentAt: sentAt ? new Date(sentAt) : new Date(),
          }).onConflictDoNothing();
          saved++;
        }
      }
    } catch (err) {
      logger.warn({ err, chatId }, "Failed to fetch messages for chat");
    }
  }

  return saved;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function syncAccount(accountDbId: string, userId: string): Promise<{ synced: number; platform: string }> {
  const apiKey = process.env.UNIPILE_API_KEY;
  const host = process.env.UNIPILE_DSN ?? process.env.UNIPILE_HOST ?? "api19.unipile.com:14946";

  if (!apiKey) throw new Error("UNIPILE_API_KEY not set");

  const account = await db
    .select()
    .from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, accountDbId), eq(connectedAccountsTable.userId, userId)))
    .limit(1);

  if (!account[0]) throw new Error("Account not found");

  const { platform, unipileAccountId } = account[0];
  if (!unipileAccountId) throw new Error("Account has no Unipile ID — cannot sync");

  await db
    .update(connectedAccountsTable)
    .set({ status: "syncing" })
    .where(eq(connectedAccountsTable.id, accountDbId));

  let synced = 0;
  try {
    if (EMAIL_PLATFORMS.has(platform)) {
      synced = await syncEmails(userId, accountDbId, unipileAccountId, host, apiKey);
    } else if (CHAT_PLATFORMS.has(platform)) {
      synced = await syncChats(userId, accountDbId, platform, unipileAccountId, host, apiKey);
    }

    await db
      .update(connectedAccountsTable)
      .set({ status: "connected", lastSyncAt: new Date(), messageCount: synced })
      .where(eq(connectedAccountsTable.id, accountDbId));

    logger.info({ accountDbId, platform, synced }, "Sync complete");
  } catch (err) {
    await db
      .update(connectedAccountsTable)
      .set({ status: "error" })
      .where(eq(connectedAccountsTable.id, accountDbId));
    throw err;
  }

  return { synced, platform };
}
