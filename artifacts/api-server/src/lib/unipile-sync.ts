import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable, conversationsTable, messagesTable, whatsappContactsTable } from "@workspace/db";
import { logger } from "./logger";
import { broadcastToUser } from "./sse-broadcaster";

const EMAIL_PLATFORMS = new Set(["gmail", "outlook"]);
const CHAT_PLATFORMS = new Set(["whatsapp", "linkedin", "instagram", "telegram", "messenger", "twitter"]);

function unipileHeaders(apiKey: string) {
  return { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

/**
 * Extract a human-readable display name from Unipile attendee fields.
 * Priority: display_name → parse "Name <email>" → humanize email username → identifier as-is
 */
function extractDisplayName(
  displayName?: string | null,
  identifier?: string | null,
): string {
  if (displayName?.trim()) return displayName.trim();
  if (!identifier) return "Unknown";
  const angleMatch = identifier.match(/^"?(.+?)"?\s*<[^>]+>$/);
  if (angleMatch) return angleMatch[1].trim();
  const atIdx = identifier.indexOf("@");
  if (atIdx > 0) {
    const username = identifier.slice(0, atIdx);
    return username
      .split(/[._+\-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return identifier;
}

/** Normalize any WhatsApp phone representation to E.164 (+<digits>). Exported for webhook handler. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.split("@")[0].trim();
  const digits = stripped.replace(/\D/g, "");
  if (!digits) return null;
  return `+${digits}`;
}

/** Backward-compat wrapper */
function formatPhone(identifier?: string | null): string {
  return normalizePhone(identifier) ?? "Unknown";
}

/** Strip HTML tags to get plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean + truncate a string for use as a message preview */
function truncate(text: string | null | undefined, max = 120): string | null {
  if (!text?.trim()) return null;
  const cleaned = text
    .replace(/\{\{[^}]+\}\}\s*/g, "")   // strip {{WhatsApp LID}} tokens
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

// ─── Chat attendees ────────────────────────────────────────────────────────────

interface UnipileAttendee {
  id?: string;
  name?: string | null;
  is_self?: number;
  public_identifier?: string | null;
  picture_url?: string | null;
  specifics?: { phone_number?: string | null; [k: string]: unknown };
}

async function fetchChatAttendees(
  chatId: string,
  host: string,
  apiKey: string,
): Promise<UnipileAttendee[]> {
  try {
    const resp = await fetch(`https://${host}/api/v1/chats/${chatId}/attendees`, {
      headers: unipileHeaders(apiKey),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { items?: UnipileAttendee[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ─── WhatsApp address-book contacts ───────────────────────────────────────────

/** In-memory lookup: normalised E.164 phone → { savedName, avatarUrl } */
type ContactsLookup = Map<string, { savedName: string; avatarUrl: string | null }>;

interface UnipileUser {
  id?: string;
  name?: string | null;
  display_name?: string | null;
  public_identifier?: string | null;
  picture_url?: string | null;
  specifics?: { phone_number?: string | null; [k: string]: unknown };
}

/**
 * Fetch and upsert the WhatsApp account's saved address-book contacts from
 * Unipile's /users endpoint.  Returns the number of contacts stored.
 */
async function syncWhatsappContacts(
  accountId: string,
  unipileAccountId: string,
  host: string,
  apiKey: string,
): Promise<number> {
  let total = 0;
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ account_id: unipileAccountId, limit: "100" });
    if (cursor) params.set("cursor", cursor);

    let data: { items?: UnipileUser[]; cursor?: string };
    try {
      const resp = await fetch(`https://${host}/api/v1/users?${params}`, {
        headers: unipileHeaders(apiKey),
      });
      if (!resp.ok) {
        logger.warn({ status: resp.status, accountId }, "WhatsApp /users fetch failed");
        break;
      }
      data = await resp.json() as { items?: UnipileUser[]; cursor?: string };
    } catch (err) {
      logger.warn({ err, accountId }, "WhatsApp /users fetch error");
      break;
    }

    const items = data.items ?? [];
    for (const user of items) {
      const rawPhone = user.specifics?.phone_number ?? user.public_identifier ?? null;
      const phone = normalizePhone(rawPhone);
      if (!phone) continue;

      const name = user.display_name?.trim() || user.name?.trim() || "";
      if (!name) continue; // contacts with no saved name are treated as unsaved

      const id = `wac_${accountId}_${phone.replace(/\D/g, "")}`;
      await db
        .insert(whatsappContactsTable)
        .values({ id, accountId, phoneNumber: phone, savedName: name, avatarUrl: user.picture_url ?? null, syncedAt: new Date() })
        .onConflictDoUpdate({
          target: whatsappContactsTable.id,
          set: { savedName: name, avatarUrl: user.picture_url ?? null, syncedAt: new Date() },
        });
      total++;
    }

    cursor = data.cursor;
  } while (cursor);

  logger.info({ accountId, total }, "WhatsApp address-book contacts synced");
  return total;
}

/** Load saved contacts for an account into an in-memory phone→name lookup map */
async function buildContactsLookup(accountId: string): Promise<ContactsLookup> {
  const rows = await db
    .select({ phoneNumber: whatsappContactsTable.phoneNumber, savedName: whatsappContactsTable.savedName, avatarUrl: whatsappContactsTable.avatarUrl })
    .from(whatsappContactsTable)
    .where(eq(whatsappContactsTable.accountId, accountId));

  const map: ContactsLookup = new Map();
  for (const r of rows) map.set(r.phoneNumber, { savedName: r.savedName, avatarUrl: r.avatarUrl });
  return map;
}

/** Resolve the best possible contact name for a chat conversation */
function resolveChatName(
  chatName: string | null | undefined,
  chatSubject: string | null | undefined,
  isGroup: boolean,
  attendees: UnipileAttendee[],
  platform: string,
  chatAttendeePublicId?: string | null,
  contactsLookup?: ContactsLookup,
): string {
  if (isGroup && chatName?.trim()) return chatName.trim();
  const other = attendees.find((a) => !a.is_self);

  if (platform === "whatsapp") {
    // WhatsApp resolution priority:
    // 1. Address-book contacts lookup (synced from /api/v1/users if available)
    // 2. chat.name — Unipile mirrors WhatsApp's own conversation title, which is
    //    the saved contact name for saved numbers, and the phone number for
    //    unsaved numbers, matching WhatsApp Web behaviour exactly.
    // 3. Normalised phone number from attendee data as last resort.
    // NOTE: attendee.name (push_name) is intentionally never used.
    const rawPhone =
      other?.specifics?.phone_number ??
      other?.public_identifier ??
      chatAttendeePublicId ??
      null;
    const phone = normalizePhone(rawPhone);

    // Priority 1: saved address-book contact
    if (phone && contactsLookup?.has(phone)) return contactsLookup.get(phone)!.savedName;

    // Priority 2: WhatsApp-level conversation title from Unipile (skipping groups
    // — they're handled at the top of the function)
    if (!isGroup && chatName?.trim()) return chatName.trim();
    if (isGroup && chatName?.trim()) return chatName.trim();

    // Priority 3: normalised phone number
    return phone ?? "Unknown";
  }

  // Non-WhatsApp platforms: attendee name → chat name → subject
  if (other?.name?.trim()) return other.name.trim();
  if (chatName?.trim()) return chatName.trim();
  if (chatSubject?.trim()) return chatSubject.trim();
  return "Unknown";
}

// ─── Email sync (Gmail / Outlook) ─────────────────────────────────────────────

type UnipileEmail = {
  id: string;
  thread_id?: string;
  from_attendee?: { display_name?: string | null; identifier?: string | null };
  to_attendees?: Array<{ display_name?: string | null; identifier?: string | null }>;
  subject?: string | null;
  body_plain?: string | null;
  body?: string | null;
  date?: string | null;
  unread?: boolean;
};

async function fetchEmailsFromFolder(
  unipileAccountId: string,
  host: string,
  apiKey: string,
  folder?: string,
): Promise<UnipileEmail[]> {
  const folderParam = folder ? `&folder=${encodeURIComponent(folder)}` : "";
  const url = `https://${host}/api/v1/emails?account_id=${unipileAccountId}&limit=50${folderParam}`;
  try {
    const resp = await fetch(url, { headers: unipileHeaders(apiKey) });
    if (!resp.ok) {
      logger.warn({ status: resp.status, folder }, "Unipile emails fetch failed");
      return [];
    }
    const data = await resp.json() as { items?: UnipileEmail[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function syncEmails(
  userId: string,
  accountId: string,
  unipileAccountId: string,
  host: string,
  apiKey: string,
): Promise<number> {
  // Fetch inbox and sent in parallel
  const [inboxEmails, sentEmails] = await Promise.all([
    fetchEmailsFromFolder(unipileAccountId, host, apiKey),           // inbox (default)
    fetchEmailsFromFolder(unipileAccountId, host, apiKey, "SENT"),   // sent folder
  ]);

  // Merge, deduplicate by email id, and tag sent emails
  type TaggedEmail = UnipileEmail & { _isSent?: boolean };
  const emailMap = new Map<string, TaggedEmail>();
  for (const e of inboxEmails) emailMap.set(e.id, e);
  for (const e of sentEmails)  emailMap.set(e.id, { ...e, _isSent: true });
  const allEmails = Array.from(emailMap.values());

  if (allEmails.length === 0) return 0;

  // Group by thread_id
  const threads = new Map<string, TaggedEmail[]>();
  for (const email of allEmails) {
    const key = email.thread_id ?? email.id;
    if (!threads.has(key)) threads.set(key, []);
    threads.get(key)!.push(email);
  }

  let saved = 0;

  for (const [threadId, threadEmails] of threads) {
    threadEmails.sort(
      (a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime(),
    );
    const latest = threadEmails[threadEmails.length - 1];

    // For threads where the latest message is sent by us, use the recipient as contact name
    const latestIsSent = (latest as TaggedEmail)._isSent;
    const contactName = latestIsSent
      ? extractDisplayName(
          latest.to_attendees?.[0]?.display_name,
          latest.to_attendees?.[0]?.identifier,
        )
      : extractDisplayName(
          latest.from_attendee?.display_name,
          latest.from_attendee?.identifier,
        );

    const subject = latest.subject ?? "(No subject)";
    const rawBody = latest.body_plain ?? (latest.body ? stripHtml(latest.body) : null);
    const headline = truncate(rawBody);
    const convId = `conv_${accountId}_${threadId.slice(-16)}`;

    await db
      .insert(conversationsTable)
      .values({
        id: convId,
        userId,
        platform: "gmail",
        externalId: threadId,
        contactName,
        topicLabel: subject,
        headline,
        priority: "medium",
        isRead: !(latest.unread ?? false),
        unreadCount: threadEmails.filter((e) => e.unread).length,
        lastMessageAt: latest.date ? new Date(latest.date) : new Date(),
      })
      .onConflictDoUpdate({
        target: conversationsTable.id,
        set: {
          contactName,
          topicLabel: subject,
          headline,
          isRead: !(latest.unread ?? false),
          unreadCount: threadEmails.filter((e) => e.unread).length,
          lastMessageAt: latest.date ? new Date(latest.date) : new Date(),
        },
      });

    // Stream this conversation to the UI immediately instead of waiting for
    // the whole sync to finish.
    broadcastToUser(userId, "conversation_updated", {
      conversationId: convId,
      platform: "gmail",
      contactName,
      headline,
    });

    for (const email of threadEmails) {
      const msgId = `msg_${accountId}_${email.id.slice(-20)}`;
      const isSent = (email as TaggedEmail)._isSent ?? false;

      const senderName = isSent
        ? "Me"
        : extractDisplayName(
            email.from_attendee?.display_name,
            email.from_attendee?.identifier,
          );
      const bodyText = truncate(email.body_plain ?? email.body, 500) ?? "(No content)";

      await db
        .insert(messagesTable)
        .values({
          id: msgId,
          conversationId: convId,
          userId,
          platform: "gmail",
          externalId: email.id,
          direction: isSent ? "outbound" : "inbound",
          bodyText,
          senderName,
          isRead: isSent ? true : !(email.unread ?? false),
          sentAt: email.date ? new Date(email.date) : new Date(),
        })
        .onConflictDoUpdate({
          target: messagesTable.id,
          set: { bodyText, senderName, isRead: isSent ? true : !(email.unread ?? false) },
        });
      saved++;
    }
  }

  return saved;
}

// ─── Chat sync (WhatsApp, LinkedIn, Telegram, Instagram…) ─────────────────────

interface UnipileChat {
  id: string;
  name?: string | null;
  subject?: string | null;
  type?: number;
  timestamp?: string | null;
  last_message_date?: string | null;
  unread_count?: number;
  attendee_public_identifier?: string | null;
  // Additional fields Unipile may include (vary by version/provider)
  identifier?: string | null;
  jid?: string | null;
  provider_id?: string | null;
  chat_id?: string | null;
}

interface UnipileChatMessage {
  id: string;
  text?: string | null;
  body?: string | null;
  is_sender?: number | boolean;
  timestamp?: string | null;
  date?: string | null;
}

async function fetchRecentMessages(
  chatId: string,
  host: string,
  apiKey: string,
): Promise<UnipileChatMessage[]> {
  try {
    const resp = await fetch(`https://${host}/api/v1/chats/${chatId}/messages?limit=20`, {
      headers: unipileHeaders(apiKey),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { items?: UnipileChatMessage[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

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
    logger.warn({ status: resp.status, platform }, "Unipile chats fetch failed");
    return 0;
  }

  const data = await resp.json() as { items?: UnipileChat[] };
  const chats = data.items ?? [];
  if (chats.length === 0) return 0;

  // For WhatsApp: sync the address-book contacts first so name resolution uses
  // saved names instead of push_name or raw phone numbers.
  let contactsLookup: ContactsLookup = new Map();
  if (platform === "whatsapp") {
    const contactCount = await syncWhatsappContacts(accountId, unipileAccountId, host, apiKey);
    contactsLookup = await buildContactsLookup(accountId);
    logger.info({ accountId, contactCount, lookupSize: contactsLookup.size }, "WhatsApp contacts lookup ready");
  }

  // Fetch attendees + messages in parallel, batched to avoid rate limits
  const BATCH_SIZE = 5;
  const chatDetails: Array<{
    chat: UnipileChat;
    attendees: UnipileAttendee[];
    messages: UnipileChatMessage[];
  }> = [];

  for (let i = 0; i < chats.length; i += BATCH_SIZE) {
    const batch = chats.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (chat) => ({
        chat,
        attendees: await fetchChatAttendees(chat.id, host, apiKey),
        messages: await fetchRecentMessages(chat.id, host, apiKey),
      })),
    );
    chatDetails.push(...results);
  }

  let saved = 0;

  for (const { chat, attendees, messages } of chatDetails) {
    const isGroup = (chat.type ?? 0) > 0;
    const contactName = resolveChatName(chat.name, chat.subject, isGroup, attendees, platform, chat.attendee_public_identifier, contactsLookup);

    // Latest message preview — messages come newest-first
    const latestMsg = messages[0];
    const headline = truncate(latestMsg?.text ?? latestMsg?.body);

    const other = attendees.find((a) => !a.is_self);
    const avatarUrl = (other as any)?.picture_url ?? null;

    const convId = `conv_${accountId}_${chat.id.slice(-16)}`;
    const lastAt = chat.last_message_date ?? chat.timestamp ?? new Date().toISOString();

    // Resolve the native platform chat ID (e.g. "919019410659@s.whatsapp.net"
    // for personal WhatsApp, "120363...@g.us" for groups). Unipile stores this
    // in attendee_public_identifier for DMs; for groups it may be in other fields.
    // We check all known field names so webhook lookups can match by provider JID.
    const providerChatId = chatProviderJid(chat);

    await db
      .insert(conversationsTable)
      .values({
        id: convId,
        userId,
        platform,
        externalId: chat.id,
        providerChatId,
        contactName,
        headline,
        contactAvatarUrl: avatarUrl,
        priority: "medium",
        isRead: (chat.unread_count ?? 0) === 0,
        unreadCount: chat.unread_count ?? 0,
        lastMessageAt: new Date(lastAt),
      })
      .onConflictDoUpdate({
        target: conversationsTable.id,
        set: {
          providerChatId,
          contactName,
          headline,
          contactAvatarUrl: avatarUrl,
          unreadCount: chat.unread_count ?? 0,
          isRead: (chat.unread_count ?? 0) === 0,
          lastMessageAt: new Date(lastAt),
        },
      });

    // Stream this conversation to the UI immediately so it appears one-by-one
    // during a Sync All instead of all-at-once when the job finishes.
    broadcastToUser(userId, "conversation_updated", {
      conversationId: convId,
      platform,
      contactName,
      headline,
    });

    // Store messages oldest-first (reverse the newest-first array)
    for (const msg of [...messages].reverse()) {
      const msgId = `msg_${accountId}_${msg.id.slice(-20)}`;
      const bodyText = truncate(msg.text ?? msg.body, 500) ?? "(Media)";
      const isSender = msg.is_sender === 1 || msg.is_sender === true;
      const senderName = isSender ? "Me" : contactName;
      const sentAt = msg.date ?? msg.timestamp;

      await db
        .insert(messagesTable)
        .values({
          id: msgId,
          conversationId: convId,
          userId,
          platform,
          externalId: msg.id,
          direction: isSender ? "outbound" : "inbound",
          bodyText,
          senderName,
          isRead: true,
          sentAt: sentAt ? new Date(sentAt) : new Date(),
        })
        .onConflictDoUpdate({
          target: messagesTable.id,
          set: { bodyText, senderName },
        });
      saved++;
    }
  }

  return saved;
}

// ─── Single-chat incremental sync (called from webhook for unknown conversations) ──

/**
 * When the webhook sends a provider/native chat ID (e.g. "918837424644@s.whatsapp.net")
 * instead of the Unipile internal ID, the direct `/chats/<id>` call returns null.
 * This helper searches the account's chat list for a matching attendee_public_identifier
 * and returns the Unipile-internal chat ID.
 */
/** Resolve any possible native provider JID field from a chat object */
function chatProviderJid(chat: UnipileChat): string | null {
  return (
    chat.attendee_public_identifier ||
    chat.identifier ||
    chat.jid ||
    chat.provider_id ||
    chat.chat_id ||
    null
  );
}

async function resolveInternalChatId(
  providerChatId: string,
  unipileAccountId: string,
  host: string,
  apiKey: string,
): Promise<string | null> {
  try {
    // Strategy 1: Unipile identifier query param (fastest, O(1) if supported)
    // Unipile may support filtering chats by native provider JID directly.
    const identifierUrl = `https://${host}/api/v1/chats?account_id=${unipileAccountId}&identifier=${encodeURIComponent(providerChatId)}&limit=1`;
    const identifierResp = await fetch(identifierUrl, { headers: unipileHeaders(apiKey) });
    if (identifierResp.ok) {
      const identifierData = await identifierResp.json() as { items?: UnipileChat[] };
      const found = identifierData.items?.[0];
      if (found?.id) return found.id;
    }

    // Strategy 2: Page through the chats list and match on any native JID field
    // Covers: attendee_public_identifier (personal chats), identifier/jid/etc (groups)
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const url = `https://${host}/api/v1/chats?account_id=${unipileAccountId}&limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const resp = await fetch(url, { headers: unipileHeaders(apiKey) });
      if (!resp.ok) break;
      const data = await resp.json() as { items?: UnipileChat[]; cursor?: string };
      const items = data.items ?? [];
      const match = items.find((c) => chatProviderJid(c) === providerChatId);
      if (match) return match.id;
      if (!data.cursor || items.length === 0) break;
      cursor = data.cursor;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function syncChatById(
  externalChatId: string,
  unipileAccountId: string,
  accountDbId: string,
  userId: string,
  platform: string,
): Promise<string | null> {
  const apiKey = process.env.UNIPILE_API_KEY;
  const host = process.env.UNIPILE_DSN ?? "api19.unipile.com:14946";
  if (!apiKey) return null;

  try {
    // Try direct fetch first (works when externalChatId is a Unipile internal ID)
    let resolvedChatId = externalChatId;
    let chatResp = await fetch(`https://${host}/api/v1/chats/${externalChatId}`, {
      headers: unipileHeaders(apiKey),
    }).then((r) => (r.ok ? r.json() : null));

    // If direct fetch failed, the ID is likely a native provider ID
    // (e.g. "918837424644@s.whatsapp.net"). Search the chat list for a match.
    if (!chatResp) {
      const internalId = await resolveInternalChatId(externalChatId, unipileAccountId, host, apiKey);
      if (internalId) {
        resolvedChatId = internalId;
        chatResp = await fetch(`https://${host}/api/v1/chats/${internalId}`, {
          headers: unipileHeaders(apiKey),
        }).then((r) => (r.ok ? r.json() : null));
      }
    }

    if (!chatResp) {
      logger.warn({ externalChatId, unipileAccountId }, "syncChatById: chat not found via direct or search");
      return null;
    }

    // Fetch attendees + messages using the resolved (internal) chat ID
    const [attendees, messages] = await Promise.all([
      fetchChatAttendees(resolvedChatId, host, apiKey),
      fetchRecentMessages(resolvedChatId, host, apiKey),
    ]);

    const chat = chatResp as UnipileChat;
    const isGroup = (chat.type ?? 0) > 0;

    // For WhatsApp: load the saved contacts lookup so single-chat syncs (e.g.
    // webhook-triggered syncs for new conversations) also use address-book names.
    let contactsLookup: ContactsLookup = new Map();
    if (platform === "whatsapp") {
      contactsLookup = await buildContactsLookup(accountDbId);
    }

    const contactName = resolveChatName(
      chat.name,
      chat.subject,
      isGroup,
      attendees,
      platform,
      chat.attendee_public_identifier,
      contactsLookup,
    );

    const latestMsg = messages[0];
    const headline = truncate(latestMsg?.text ?? latestMsg?.body);
    const other = attendees.find((a) => !a.is_self);
    const avatarUrl = (other as any)?.picture_url ?? null;
    // Use resolvedChatId (Unipile internal ID) for convId — this prevents a
    // bad ID like "918837424644@s.whatsapp.net" from becoming the convId suffix.
    const convId = `conv_${accountDbId}_${resolvedChatId.slice(-16)}`;
    const lastAt = chat.last_message_date ?? chat.timestamp ?? new Date().toISOString();
    // Use any available native JID field, fall back to the externalChatId that
    // was passed to us (which might already be the native JID from the webhook)
    const providerChatId = chatProviderJid(chat) ?? externalChatId;

    await db
      .insert(conversationsTable)
      .values({
        id: convId,
        userId,
        platform,
        externalId: resolvedChatId,
        providerChatId,
        contactName,
        headline,
        contactAvatarUrl: avatarUrl,
        priority: "medium",
        isRead: (chat.unread_count ?? 0) === 0,
        unreadCount: chat.unread_count ?? 0,
        lastMessageAt: new Date(lastAt),
      })
      .onConflictDoUpdate({
        target: conversationsTable.id,
        set: {
          providerChatId,
          contactName,
          headline,
          contactAvatarUrl: avatarUrl,
          unreadCount: chat.unread_count ?? 0,
          isRead: (chat.unread_count ?? 0) === 0,
          lastMessageAt: new Date(lastAt),
        },
      });

    for (const msg of [...messages].reverse()) {
      const msgId = `msg_${accountDbId}_${msg.id.slice(-20)}`;
      const bodyText = truncate(msg.text ?? msg.body, 500) ?? "(Media)";
      const isSender = msg.is_sender === 1 || msg.is_sender === true;
      const sentAt = msg.date ?? msg.timestamp;

      await db
        .insert(messagesTable)
        .values({
          id: msgId,
          conversationId: convId,
          userId,
          platform,
          externalId: msg.id,
          direction: isSender ? "outbound" : "inbound",
          bodyText,
          senderName: isSender ? "Me" : contactName,
          isRead: true,
          sentAt: sentAt ? new Date(sentAt) : new Date(),
        })
        .onConflictDoUpdate({
          target: messagesTable.id,
          set: { bodyText },
        });
    }

    logger.info({ convId, externalChatId, platform }, "Incremental single-chat sync complete");
    return convId;
  } catch (err) {
    logger.warn({ err, externalChatId }, "syncChatById failed");
    return null;
  }
}

// ─── Re-resolve WhatsApp conversation names from address book ─────────────────

/**
 * After the address book is synced, update ALL existing WhatsApp DM conversations
 * for this user so that:
 *  - Numbers saved in contacts → display the saved contact name
 *  - Numbers NOT in contacts   → display the E.164 phone number
 * Groups (JIDs ending in @g.us) are skipped; they keep their group name.
 * Returns { matched, updated, total } counts for reporting.
 */
export async function reResolveWhatsappConversations(
  userId: string,
  accountId: string,
  contactsLookup: ContactsLookup,
): Promise<{ matched: number; updated: number; total: number }> {
  const conversations = await db
    .select({ id: conversationsTable.id, providerChatId: conversationsTable.providerChatId, contactName: conversationsTable.contactName })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.platform, "whatsapp")));

  let matched = 0;
  let updated = 0;

  for (const conv of conversations) {
    if (!conv.providerChatId) continue;
    if (conv.providerChatId.includes("@g.us")) continue; // groups keep their name

    const phone = normalizePhone(conv.providerChatId);
    if (!phone) continue;

    const contact = contactsLookup.get(phone);
    if (contact) {
      // Confirmed saved contact — use the address-book name
      const newName = contact.savedName;
      if (newName !== conv.contactName) {
        await db.update(conversationsTable).set({ contactName: newName }).where(eq(conversationsTable.id, conv.id));
        updated++;
      }
      matched++;
    }
    // Unsaved contacts: leave whatever the most recent syncChats set
    // (chat.name from Unipile, which mirrors WhatsApp Web's phone-number display)
  }

  logger.info(
    { userId, accountId, total: conversations.length, matched, updated },
    "WhatsApp conversations re-resolved from address book",
  );
  return { matched, updated, total: conversations.length };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function syncAccount(
  accountDbId: string,
  userId: string,
): Promise<{ synced: number; platform: string }> {
  const apiKey = process.env.UNIPILE_API_KEY;
  const host = process.env.UNIPILE_DSN ?? "api19.unipile.com:14946";
  if (!apiKey) throw new Error("UNIPILE_API_KEY not set");

  const account = await db
    .select()
    .from(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.id, accountDbId),
        eq(connectedAccountsTable.userId, userId),
      ),
    )
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
      // After WhatsApp chats are synced (contacts were synced inside syncChats),
      // re-resolve ALL existing WhatsApp conversations for this user — replacing
      // any stale push-names or raw phone numbers with saved contact names.
      if (platform === "whatsapp") {
        const lookup = await buildContactsLookup(accountDbId);
        await reResolveWhatsappConversations(userId, accountDbId, lookup);
      }
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
