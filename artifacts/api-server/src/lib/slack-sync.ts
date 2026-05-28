import { eq, and } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { logger } from "./logger";
import { broadcastToUser } from "./sse-broadcaster";

// ─── Slack API Types ──────────────────────────────────────────────────────────

interface SlackConversation {
  id: string;
  name?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_archived?: boolean;
  user?: string;
  topic?: { value?: string };
  purpose?: { value?: string };
}

interface SlackMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  text?: string;
  type?: string;
  subtype?: string;
  files?: { url_private?: string; name?: string }[];
}

interface SlackUser {
  id: string;
  real_name?: string;
  name?: string;
  deleted?: boolean;
  profile?: {
    real_name?: string;
    display_name?: string;
    image_72?: string;
    image_192?: string;
    email?: string;
  };
}

// ─── Slack API Helper ─────────────────────────────────────────────────────────

async function slackGet<T>(
  token: string,
  method: string,
  params: Record<string, string> = {},
): Promise<T & { ok: boolean; error?: string }> {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await resp.json()) as T & { ok: boolean; error?: string };
  if (!data.ok) {
    const err = new Error(`Slack API ${method}: ${data.error ?? "unknown error"}`);
    (err as any).slackError = data.error;
    throw err;
  }
  return data;
}

/** Returns true if this error is a Slack rate-limit — caller should back off, not fail */
function isSlackRateLimit(err: unknown): boolean {
  return (
    err instanceof Error &&
    ((err as any).slackError === "ratelimited" || err.message.includes("ratelimited"))
  );
}

// ─── User profile cache (per sync run) ───────────────────────────────────────

async function getSlackUser(
  token: string,
  userId: string,
  cache: Map<string, SlackUser>,
): Promise<SlackUser | null> {
  if (cache.has(userId)) return cache.get(userId)!;
  try {
    const data = await slackGet<{ user: SlackUser }>(token, "users.info", { user: userId });
    cache.set(userId, data.user);
    return data.user;
  } catch {
    return null;
  }
}

// ─── Get workspace bot's own user ID ─────────────────────────────────────────

export async function getSlackBotUserId(token: string): Promise<string | null> {
  try {
    const data = await slackGet<{ user_id: string }>(token, "auth.test");
    return data.user_id;
  } catch {
    return null;
  }
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncSlack(
  userId: string,
  accountDbId: string,
  token: string,
): Promise<number> {
  const userCache = new Map<string, SlackUser>();
  let synced = 0;

  const botUserId = await getSlackBotUserId(token);

  // Fetch all conversations the bot has access to
  let allConversations: SlackConversation[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = {
      types: "public_channel,private_channel,im,mpim",
      exclude_archived: "true",
      limit: "200",
    };
    if (cursor) params.cursor = cursor;
    const data = await slackGet<{
      channels: SlackConversation[];
      response_metadata?: { next_cursor?: string };
    }>(token, "conversations.list", params);
    allConversations = allConversations.concat(data.channels ?? []);
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  logger.info({ accountDbId, total: allConversations.length }, "Slack: fetched conversation list");

  for (const conv of allConversations) {
    try {
      let contactName = conv.id;
      let avatarUrl: string | null = null;

      if (conv.is_im && conv.user) {
        const u = await getSlackUser(token, conv.user, userCache);
        contactName =
          u?.profile?.real_name ?? u?.real_name ?? u?.name ?? conv.user;
        avatarUrl = u?.profile?.image_192 ?? u?.profile?.image_72 ?? null;
      } else if (conv.is_mpim) {
        contactName = conv.name?.replace(/-\d+$/, "").replace(/-/g, ", ") ?? conv.id;
      } else {
        contactName = `#${conv.name ?? conv.id}`;
      }

      const convId = `conv_${accountDbId}_${conv.id}`;

      // Fetch recent messages
      let messages: SlackMessage[] = [];
      try {
        const histData = await slackGet<{ messages: SlackMessage[] }>(
          token,
          "conversations.history",
          { channel: conv.id, limit: "50" },
        );
        messages = (histData.messages ?? []).filter(
          (m) => m.type === "message" && !m.subtype,
        );
      } catch {
        // Channel may not be joinable — skip messages but still create the conversation
      }

      if (messages.length === 0 && !conv.is_im && !conv.is_mpim) continue;

      const latestMsg = messages[0];
      const lastAt = latestMsg
        ? new Date(parseFloat(latestMsg.ts) * 1000)
        : new Date();
      const snippet = latestMsg?.text?.slice(0, 200) ?? null;

      await db
        .insert(conversationsTable)
        .values({
          id: convId,
          userId,
          platform: "slack",
          externalId: conv.id,
          providerChatId: conv.id,
          contactName,
          contactAvatarUrl: avatarUrl,
          priority: "medium",
          isArchived: false,
          isRead: true,
          unreadCount: 0,
          lastMessageAt: lastAt,
          lastMessageSnippet: snippet,
          accountId: accountDbId,
        })
        .onConflictDoUpdate({
          target: [conversationsTable.id],
          set: {
            contactName,
            contactAvatarUrl: avatarUrl,
            lastMessageAt: lastAt,
            lastMessageSnippet: snippet,
          },
        });

      for (const msg of messages) {
        const msgTs = new Date(parseFloat(msg.ts) * 1000);
        const isSelf = msg.user === botUserId;
        const msgUser = msg.user
          ? await getSlackUser(token, msg.user, userCache)
          : null;
        const senderName = isSelf
          ? "Me"
          : (msgUser?.profile?.real_name ??
            msgUser?.real_name ??
            msg.user ??
            "Unknown");

        const msgId = `msg_slack_${msg.ts.replace(".", "_")}`;
        await db
          .insert(messagesTable)
          .values({
            id: msgId,
            conversationId: convId,
            userId,
            platform: "slack",
            externalId: msg.ts,
            direction: isSelf ? "outbound" : "inbound",
            bodyText: msg.text ?? "",
            senderName,
            isRead: true,
            sentAt: msgTs,
          })
          .onConflictDoNothing();
      }

      synced++;
    } catch (err) {
      logger.warn({ err, channelId: conv.id }, "Slack: failed to sync channel");
    }
  }

  logger.info({ accountDbId, synced }, "Slack: sync complete");
  return synced;
}

// ─── Handle a single real-time Slack event ───────────────────────────────────

export async function handleSlackEvent(
  userId: string,
  accountDbId: string,
  token: string,
  event: Record<string, unknown>,
): Promise<void> {
  const eventType = event.type as string;

  // Only handle message events (new messages in channels / DMs)
  if (
    eventType !== "message" ||
    event.subtype // edits, deletions, bot messages etc — ignore for now
  ) {
    return;
  }

  const channelId = event.channel as string;
  const ts = event.ts as string;
  const text = (event.text as string) ?? "";
  const senderId = event.user as string;

  if (!channelId || !ts) return;

  // Find the conversation in our DB
  const existing = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.accountId, accountDbId),
        eq(conversationsTable.externalId, channelId),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    // Unknown channel — run a targeted sync to create it
    logger.info({ channelId }, "Slack event: unknown channel, syncing");
    await syncSlack(userId, accountDbId, token);
    return;
  }

  const convId = existing[0].id;

  // Look up sender
  const userCache = new Map<string, SlackUser>();
  const botUserId = await getSlackBotUserId(token);
  const isSelf = senderId === botUserId;
  const msgUser = senderId
    ? await getSlackUser(token, senderId, userCache)
    : null;
  const senderName = isSelf
    ? "Me"
    : (msgUser?.profile?.real_name ?? msgUser?.real_name ?? senderId ?? "Unknown");

  const sentAt = new Date(parseFloat(ts) * 1000);
  const msgId = `msg_slack_${ts.replace(".", "_")}`;

  const inserted = await db
    .insert(messagesTable)
    .values({
      id: msgId,
      conversationId: convId,
      userId,
      platform: "slack",
      externalId: ts,
      direction: isSelf ? "outbound" : "inbound",
      bodyText: text,
      senderName,
      isRead: false,
      sentAt,
    })
    .onConflictDoNothing()
    .returning({ id: messagesTable.id });

  if (inserted.length > 0) {
    await db
      .update(conversationsTable)
      .set({
        lastMessageAt: sentAt,
        lastMessageSnippet: text.slice(0, 200),
        isRead: false,
        unreadCount: (existing[0].unreadCount ?? 0) + 1,
      })
      .where(eq(conversationsTable.id, convId));

    broadcastToUser(userId, "new_message", {
      conversationId: convId,
      messageId: msgId,
      platform: "slack",
      senderName,
      snippet: text.slice(0, 100),
    });

    logger.info({ convId, msgId, senderName }, "Slack real-time: message saved & broadcast");
  }
}
