import pg from "pg";

const { Client } = pg;

const DEMO_USER_ID = "demo_user_xanda";

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 5);

  const iso = (d) => d.toISOString();

  // Ensure demo user exists
  await client.query(`
    INSERT INTO users (id, clerk_id, email, first_name, last_name, status, trial_ends_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [DEMO_USER_ID, "demo_clerk_id", "demo@xandacross.com", "Demo", "User", "active", iso(new Date(Date.now() + 7 * 86400000))]);

  // Seed connected accounts
  const accounts = [
    ["acc_gmail", "gmail", "Personal Gmail", "demo@gmail.com"],
    ["acc_whatsapp", "whatsapp", "Personal WhatsApp", null],
    ["acc_linkedin", "linkedin", "Work LinkedIn", null],
    ["acc_slack", "slack", "Dev Team Slack", null],
    ["acc_telegram", "telegram", "Personal Telegram", null],
  ];
  for (const [id, platform, label, email] of accounts) {
    await client.query(`
      INSERT INTO connected_accounts (id, user_id, platform, account_label, email, status, last_sync_at, message_count, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'connected', NOW(), 10, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [id, DEMO_USER_ID, platform, label, email]);
  }

  // Seed contacts
  const contacts = [
    ["contact_1", "Sarah Chen", "sarah.chen@designstudio.com", "{gmail,linkedin}"],
    ["contact_2", "Marcus Johnson", null, "{whatsapp}"],
    ["contact_3", "Elena Rodriguez", "elena.r@techventures.io", "{slack}"],
    ["contact_4", "James Okafor", "james.okafor@gmail.com", "{gmail,telegram}"],
    ["contact_5", "Yuki Tanaka", null, "{whatsapp,telegram}"],
    ["contact_6", "Priya Sharma", "priya@acme-corp.com", "{slack,gmail}"],
  ];
  for (const [id, name, email, platforms] of contacts) {
    await client.query(`
      INSERT INTO contacts (id, user_id, display_name, email, platforms, conversation_count, last_seen_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 2, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [id, DEMO_USER_ID, name, email, platforms]);
  }

  // Seed notification settings
  await client.query(`
    INSERT INTO notification_settings (id, user_id, email_digest, digest_frequency, push_enabled, priority_only, created_at, updated_at)
    VALUES ('ns_1', $1, true, 'daily', false, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [DEMO_USER_ID]);

  // Seed conversations
  const convos = [
    ["conv_1", "contact_1", "gmail", "Sarah Chen", "Q3 Design Review", "urgent", false, 3, iso(now)],
    ["conv_2", "contact_2", "whatsapp", "Marcus Johnson", null, "high", false, 2, iso(twoDaysAgo)],
    ["conv_3", "contact_3", "slack", "Elena Rodriguez", "API Rate Limits", "medium", true, 0, iso(lastWeek)],
    ["conv_4", "contact_4", "gmail", "James Okafor", "Partnership Proposal", "medium", true, 0, iso(twoDaysAgo)],
    ["conv_5", "contact_5", "telegram", "Yuki Tanaka", null, "low", true, 0, iso(lastWeek)],
    ["conv_6", "contact_6", "slack", "Priya Sharma", "Sprint Planning", "high", false, 1, iso(yesterday)],
  ];

  for (const [id, cid, plat, name, topic, priority, read, unread, ts] of convos) {
    await client.query(`
      INSERT INTO conversations (id, user_id, platform, external_id, contact_name, contact_id, topic_label, priority, is_read, unread_count, last_message_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [id, DEMO_USER_ID, plat, id + "_ext", name, cid, topic, priority, read, unread, ts]);
  }

  // Seed messages
  const msgs = [
    ["msg_1", "conv_1", "inbound", "Hi! Just checking in - the Q3 design review deck needs to go to leadership by EOD. Can you review the final mockups I sent over?", "Sarah Chen", iso(yesterday), false, "gmail"],
    ["msg_2", "conv_1", "outbound", "Sure Sarah, I'll take a look this morning and get back to you before noon.", "Demo User", iso(yesterday), false, "gmail"],
    ["msg_3", "conv_1", "inbound", "Also - the client just dropped a last-minute request for a dark mode variant. Can we squeeze that in?", "Sarah Chen", iso(now), false, "gmail"],
    ["msg_4", "conv_2", "inbound", "Hey, the investor pitch deck is looking solid. One thing - can we add a slide on unit economics?", "Marcus Johnson", iso(twoDaysAgo), false, "whatsapp"],
    ["msg_5", "conv_2", "inbound", "Also, the meeting got moved to Thursday 2pm. Let me know if that works.", "Marcus Johnson", iso(yesterday), false, "whatsapp"],
    ["msg_6", "conv_3", "outbound", "Elena, the new rate limits are live on staging. Can you run your integration tests?", "Demo User", iso(lastWeek), true, "slack"],
    ["msg_7", "conv_3", "inbound", "All green! Deploying to prod now. Great work on the throttling logic.", "Elena Rodriguez", iso(twoDaysAgo), true, "slack"],
    ["msg_8", "conv_4", "inbound", "Thanks for the partnership proposal. Our team reviewed it and we'd like to move forward with a pilot program.", "James Okafor", iso(twoDaysAgo), true, "gmail"],
    ["msg_9", "conv_4", "outbound", "That's great news James! I'll draft the pilot agreement and send it over by Friday.", "Demo User", iso(yesterday), true, "gmail"],
    ["msg_10", "conv_5", "inbound", "Lunch next Tuesday? There's a great ramen spot that just opened near the office.", "Yuki Tanaka", iso(lastWeek), true, "telegram"],
    ["msg_11", "conv_5", "outbound", "Count me in! See you at 12:30.", "Demo User", iso(twoDaysAgo), true, "telegram"],
    ["msg_12", "conv_6", "inbound", "Quick update: the analytics dashboard bug is resolved. The fix is on the release branch. Can you verify before we merge?", "Priya Sharma", iso(yesterday), false, "slack"],
  ];

  for (const [id, cid, dir, body, sender, ts, read, plat] of msgs) {
    await client.query(`
      INSERT INTO messages (id, conversation_id, user_id, platform, external_id, direction, body_text, sender_name, sent_at, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [id, cid, DEMO_USER_ID, plat, id + "_ext", dir, body, sender, ts, read]);
  }

  // Seed Xan messages
  const xan = [
    ["xan_1", "user", "What are my top priorities today?"],
    ["xan_2", "assistant", "You have 3 urgent items: Sarah Chen needs the Q3 design review mockups approved by noon, Marcus Johnson moved the investor pitch to Thursday, and Priya Sharma has a dashboard bug fix waiting for your verification."],
    ["xan_3", "user", "Draft a reply to Sarah about the dark mode request"],
    ["xan_4", "assistant", "Here's a draft: Hi Sarah, I reviewed the mockups and they look great. Regarding the dark mode variant - we can definitely squeeze it in. I'll need about half a day, so I can have it ready by tomorrow afternoon. Let me know if that timeline works!"],
  ];

  for (const [id, role, content] of xan) {
    await client.query(`
      INSERT INTO xan_messages (id, user_id, role, content, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [id, DEMO_USER_ID, role, content]);
  }

  console.log("Demo data seeded successfully");
  await client.end();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
