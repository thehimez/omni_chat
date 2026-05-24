import { db, usersTable, conversationsTable, messagesTable, contactsTable, connectedAccountsTable, notificationSettingsTable, xanMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEMO_USER_ID = "demo_user_xanda";

export async function seedDemoData(): Promise<void> {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
  if (!user[0]) return;

  // Check if data already seeded
  const existingConvos = await db.select().from(conversationsTable).where(eq(conversationsTable.userId, DEMO_USER_ID)).limit(1);
  if (existingConvos.length > 0) return;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 5);

  // Seed connected accounts
  const accounts = [
    { id: "acc_gmail", platform: "gmail", email: "demo@gmail.com", accountLabel: "Personal Gmail", status: "connected" },
    { id: "acc_whatsapp", platform: "whatsapp", accountLabel: "Personal WhatsApp", status: "connected" },
    { id: "acc_linkedin", platform: "linkedin", accountLabel: "Work LinkedIn", status: "connected" },
    { id: "acc_slack", platform: "slack", accountLabel: "Dev Team Slack", status: "connected" },
    { id: "acc_telegram", platform: "telegram", accountLabel: "Personal Telegram", status: "connected" },
  ];

  for (const a of accounts) {
    await db.insert(connectedAccountsTable).values({
      id: a.id,
      userId: DEMO_USER_ID,
      platform: a.platform,
      accountLabel: a.accountLabel,
      email: a.email ?? null,
      status: a.status,
      lastSyncAt: now,
      messageCount: 10,
    });
  }

  // Seed contacts
  const contactsData = [
    { id: "contact_1", displayName: "Sarah Chen", email: "sarah.chen@designstudio.com", platforms: ["gmail", "linkedin"] },
    { id: "contact_2", displayName: "Marcus Johnson", email: null, platforms: ["whatsapp"] },
    { id: "contact_3", displayName: "Elena Rodriguez", email: "elena.r@techventures.io", platforms: ["slack"] },
    { id: "contact_4", displayName: "James Okafor", email: "james.okafor@gmail.com", platforms: ["gmail", "telegram"] },
    { id: "contact_5", displayName: "Yuki Tanaka", email: null, platforms: ["whatsapp", "telegram"] },
    { id: "contact_6", displayName: "Priya Sharma", email: "priya@acme-corp.com", platforms: ["slack", "gmail"] },
  ];

  for (const c of contactsData) {
    await db.insert(contactsTable).values({
      id: c.id,
      userId: DEMO_USER_ID,
      displayName: c.displayName,
      email: c.email ?? null,
      platforms: c.platforms,
      conversationCount: 2,
      lastSeenAt: now,
    });
  }

  // Seed notification settings
  await db.insert(notificationSettingsTable).values({
    id: "ns_1",
    userId: DEMO_USER_ID,
    emailDigest: true,
    digestFrequency: "daily",
    pushEnabled: false,
    priorityOnly: false,
  });

  // Seed conversations with messages
  const convoData = [
    {
      id: "conv_1", contactId: "contact_1", platform: "gmail", contactName: "Sarah Chen",
      topicLabel: "Q3 Design Review", priority: "urgent", isRead: false, unreadCount: 3,
      lastMessageAt: now,
      messages: [
        { id: "msg_1", direction: "inbound", bodyText: "Hi! Just checking in — the Q3 design review deck needs to go to leadership by EOD. Can you review the final mockups I sent over?", senderName: "Sarah Chen", sentAt: yesterday },
        { id: "msg_2", direction: "outbound", bodyText: "Sure Sarah, I’ll take a look this morning and get back to you before noon.", senderName: "Demo User", sentAt: yesterday },
        { id: "msg_3", direction: "inbound", bodyText: "Also — the client just dropped a last-minute request for a dark mode variant. Can we squeeze that in?", senderName: "Sarah Chen", sentAt: now },
      ],
    },
    {
      id: "conv_2", contactId: "contact_2", platform: "whatsapp", contactName: "Marcus Johnson",
      topicLabel: null, priority: "high", isRead: false, unreadCount: 2,
      lastMessageAt: twoDaysAgo,
      messages: [
        { id: "msg_4", direction: "inbound", bodyText: "Hey, the investor pitch deck is looking solid. One thing — can we add a slide on unit economics?", senderName: "Marcus Johnson", sentAt: twoDaysAgo },
        { id: "msg_5", direction: "inbound", bodyText: "Also, the meeting got moved to Thursday 2pm. Let me know if that works.", senderName: "Marcus Johnson", sentAt: yesterday },
      ],
    },
    {
      id: "conv_3", contactId: "contact_3", platform: "slack", contactName: "Elena Rodriguez",
      topicLabel: "API Rate Limits", priority: "medium", isRead: true, unreadCount: 0,
      lastMessageAt: lastWeek,
      messages: [
        { id: "msg_6", direction: "outbound", bodyText: "Elena, the new rate limits are live on staging. Can you run your integration tests?", senderName: "Demo User", sentAt: lastWeek },
        { id: "msg_7", direction: "inbound", bodyText: "All green! Deploying to prod now. Great work on the throttling logic.", senderName: "Elena Rodriguez", sentAt: twoDaysAgo },
      ],
    },
    {
      id: "conv_4", contactId: "contact_4", platform: "gmail", contactName: "James Okafor",
      topicLabel: "Partnership Proposal", priority: "medium", isRead: true, unreadCount: 0,
      lastMessageAt: twoDaysAgo,
      messages: [
        { id: "msg_8", direction: "inbound", bodyText: "Thanks for the partnership proposal. Our team reviewed it and we’d like to move forward with a pilot program.", senderName: "James Okafor", sentAt: twoDaysAgo },
        { id: "msg_9", direction: "outbound", bodyText: "That’s great news James! I’ll draft the pilot agreement and send it over by Friday.", senderName: "Demo User", sentAt: yesterday },
      ],
    },
    {
      id: "conv_5", contactId: "contact_5", platform: "telegram", contactName: "Yuki Tanaka",
      topicLabel: null, priority: "low", isRead: true, unreadCount: 0,
      lastMessageAt: lastWeek,
      messages: [
        { id: "msg_10", direction: "inbound", bodyText: "Lunch next Tuesday? There’s a great ramen spot that just opened near the office.", senderName: "Yuki Tanaka", sentAt: lastWeek },
        { id: "msg_11", direction: "outbound", bodyText: "Count me in! See you at 12:30.", senderName: "Demo User", sentAt: twoDaysAgo },
      ],
    },
    {
      id: "conv_6", contactId: "contact_6", platform: "slack", contactName: "Priya Sharma",
      topicLabel: "Sprint Planning", priority: "high", isRead: false, unreadCount: 1,
      lastMessageAt: yesterday,
      messages: [
        { id: "msg_12", direction: "inbound", bodyText: "Quick update: the analytics dashboard bug is resolved. The fix is on the release branch. Can you verify before we merge?", senderName: "Priya Sharma", sentAt: yesterday },
      ],
    },
  ];

  for (const c of convoData) {
    await db.insert(conversationsTable).values({
      id: c.id,
      userId: DEMO_USER_ID,
      platform: c.platform,
      contactName: c.contactName,
      contactId: c.contactId,
      topicLabel: c.topicLabel,
      priority: c.priority,
      isRead: c.isRead,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt,
    });

    for (const m of c.messages) {
      await db.insert(messagesTable).values({
        id: m.id,
        conversationId: c.id,
        userId: DEMO_USER_ID,
        platform: c.platform,
        direction: m.direction,
        bodyText: m.bodyText,
        senderName: m.senderName,
        sentAt: m.sentAt,
        isRead: c.isRead,
      });
    }
  }

  // Seed Xan chat history
  const xanMessages = [
    { id: "xan_1", role: "user", content: "What are my top priorities today?" },
    { id: "xan_2", role: "assistant", content: "You have 3 urgent items: Sarah Chen needs the Q3 design review mockups approved by noon, Marcus Johnson moved the investor pitch to Thursday, and Priya Sharma has a dashboard bug fix waiting for your verification." },
    { id: "xan_3", role: "user", content: "Draft a reply to Sarah about the dark mode request" },
    { id: "xan_4", role: "assistant", content: "Here’s a draft: Hi Sarah, I reviewed the mockups and they look great. Regarding the dark mode variant — we can definitely squeeze it in. I’ll need about half a day, so I can have it ready by tomorrow afternoon. Let me know if that timeline works!" },
  ];

  for (const xm of xanMessages) {
    await db.insert(xanMessagesTable).values({
      id: xm.id,
      userId: DEMO_USER_ID,
      role: xm.role,
      content: xm.content,
    });
  }
}
