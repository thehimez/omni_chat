-- Seed demo data for Xanda Cross
-- Run with: psql "$DATABASE_URL" -f scripts/seed-demo.sql

DO $$
DECLARE
  demo_user_id TEXT := 'demo_user_xanda';
  demo_clerk_id TEXT := 'demo_clerk_id';
  now TIMESTAMPTZ := NOW();
  yesterday TIMESTAMPTZ := NOW() - INTERVAL '1 day';
  two_days TIMESTAMPTZ := NOW() - INTERVAL '2 days';
  last_week TIMESTAMPTZ := NOW() - INTERVAL '5 days';
  trial_end TIMESTAMPTZ := NOW() + INTERVAL '7 days';
BEGIN

  -- Ensure demo user
  INSERT INTO users (id, clerk_id, email, first_name, last_name, status, trial_ends_at, created_at, updated_at)
  VALUES (demo_user_id, demo_clerk_id, 'demo@xandacross.com', 'Demo', 'User', 'active', trial_end, now, now)
  ON CONFLICT (id) DO NOTHING;

  -- Connected accounts
  INSERT INTO connected_accounts (id, user_id, platform, account_label, email, status, last_sync_at, message_count, created_at, updated_at)
  VALUES
    ('acc_gmail', demo_user_id, 'gmail', 'Personal Gmail', 'demo@gmail.com', 'connected', now, 10, now, now),
    ('acc_whatsapp', demo_user_id, 'whatsapp', 'Personal WhatsApp', NULL, 'connected', now, 10, now, now),
    ('acc_linkedin', demo_user_id, 'linkedin', 'Work LinkedIn', NULL, 'connected', now, 10, now, now),
    ('acc_slack', demo_user_id, 'slack', 'Dev Team Slack', NULL, 'connected', now, 10, now, now),
    ('acc_telegram', demo_user_id, 'telegram', 'Personal Telegram', NULL, 'connected', now, 10, now, now)
  ON CONFLICT (id) DO NOTHING;

  -- Contacts
  INSERT INTO contacts (id, user_id, display_name, email, platforms, conversation_count, last_seen_at, created_at, updated_at)
  VALUES
    ('contact_1', demo_user_id, 'Sarah Chen', 'sarah.chen@designstudio.com', ARRAY['gmail','linkedin'], 2, now, now, now),
    ('contact_2', demo_user_id, 'Marcus Johnson', NULL, ARRAY['whatsapp'], 2, now, now, now),
    ('contact_3', demo_user_id, 'Elena Rodriguez', 'elena.r@techventures.io', ARRAY['slack'], 2, now, now, now),
    ('contact_4', demo_user_id, 'James Okafor', 'james.okafor@gmail.com', ARRAY['gmail','telegram'], 2, now, now, now),
    ('contact_5', demo_user_id, 'Yuki Tanaka', NULL, ARRAY['whatsapp','telegram'], 2, now, now, now),
    ('contact_6', demo_user_id, 'Priya Sharma', 'priya@acme-corp.com', ARRAY['slack','gmail'], 2, now, now, now)
  ON CONFLICT (id) DO NOTHING;

  -- Notification settings
  INSERT INTO notification_settings (id, user_id, email_digest, digest_frequency, push_enabled, priority_only, created_at, updated_at)
  VALUES ('ns_1', demo_user_id, true, 'daily', false, false, now, now)
  ON CONFLICT (id) DO NOTHING;

  -- Conversations
  INSERT INTO conversations (id, user_id, platform, external_id, contact_name, contact_id, topic_label, priority, is_read, unread_count, last_message_at, created_at, updated_at)
  VALUES
    ('conv_1', demo_user_id, 'gmail', 'conv_1_ext', 'Sarah Chen', 'contact_1', 'Q3 Design Review', 'urgent', false, 3, now, now, now),
    ('conv_2', demo_user_id, 'whatsapp', 'conv_2_ext', 'Marcus Johnson', 'contact_2', NULL, 'high', false, 2, two_days, now, now),
    ('conv_3', demo_user_id, 'slack', 'conv_3_ext', 'Elena Rodriguez', 'contact_3', 'API Rate Limits', 'medium', true, 0, last_week, now, now),
    ('conv_4', demo_user_id, 'gmail', 'conv_4_ext', 'James Okafor', 'contact_4', 'Partnership Proposal', 'medium', true, 0, two_days, now, now),
    ('conv_5', demo_user_id, 'telegram', 'conv_5_ext', 'Yuki Tanaka', 'contact_5', NULL, 'low', true, 0, last_week, now, now),
    ('conv_6', demo_user_id, 'slack', 'conv_6_ext', 'Priya Sharma', 'contact_6', 'Sprint Planning', 'high', false, 1, yesterday, now, now)
  ON CONFLICT (id) DO NOTHING;

  -- Messages
  INSERT INTO messages (id, conversation_id, user_id, platform, external_id, direction, body_text, sender_name, sent_at, is_read, created_at)
  VALUES
    ('msg_1', 'conv_1', demo_user_id, 'gmail', 'msg_1_ext', 'inbound', 'Hi! Just checking in - the Q3 design review deck needs to go to leadership by EOD. Can you review the final mockups I sent over?', 'Sarah Chen', yesterday, false, now),
    ('msg_2', 'conv_1', demo_user_id, 'gmail', 'msg_2_ext', 'outbound', 'Sure Sarah, I''ll take a look this morning and get back to you before noon.', 'Demo User', yesterday, false, now),
    ('msg_3', 'conv_1', demo_user_id, 'gmail', 'msg_3_ext', 'inbound', 'Also - the client just dropped a last-minute request for a dark mode variant. Can we squeeze that in?', 'Sarah Chen', now, false, now),
    ('msg_4', 'conv_2', demo_user_id, 'whatsapp', 'msg_4_ext', 'inbound', 'Hey, the investor pitch deck is looking solid. One thing - can we add a slide on unit economics?', 'Marcus Johnson', two_days, false, now),
    ('msg_5', 'conv_2', demo_user_id, 'whatsapp', 'msg_5_ext', 'inbound', 'Also, the meeting got moved to Thursday 2pm. Let me know if that works.', 'Marcus Johnson', yesterday, false, now),
    ('msg_6', 'conv_3', demo_user_id, 'slack', 'msg_6_ext', 'outbound', 'Elena, the new rate limits are live on staging. Can you run your integration tests?', 'Demo User', last_week, true, now),
    ('msg_7', 'conv_3', demo_user_id, 'slack', 'msg_7_ext', 'inbound', 'All green! Deploying to prod now. Great work on the throttling logic.', 'Elena Rodriguez', two_days, true, now),
    ('msg_8', 'conv_4', demo_user_id, 'gmail', 'msg_8_ext', 'inbound', 'Thanks for the partnership proposal. Our team reviewed it and we''d like to move forward with a pilot program.', 'James Okafor', two_days, true, now),
    ('msg_9', 'conv_4', demo_user_id, 'gmail', 'msg_9_ext', 'outbound', 'That''s great news James! I''ll draft the pilot agreement and send it over by Friday.', 'Demo User', yesterday, true, now),
    ('msg_10', 'conv_5', demo_user_id, 'telegram', 'msg_10_ext', 'inbound', 'Lunch next Tuesday? There''s a great ramen spot that just opened near the office.', 'Yuki Tanaka', last_week, true, now),
    ('msg_11', 'conv_5', demo_user_id, 'telegram', 'msg_11_ext', 'outbound', 'Count me in! See you at 12:30.', 'Demo User', two_days, true, now),
    ('msg_12', 'conv_6', demo_user_id, 'slack', 'msg_12_ext', 'inbound', 'Quick update: the analytics dashboard bug is resolved. The fix is on the release branch. Can you verify before we merge?', 'Priya Sharma', yesterday, false, now)
  ON CONFLICT (id) DO NOTHING;

  -- Xan messages
  INSERT INTO xan_messages (id, user_id, role, content, created_at)
  VALUES
    ('xan_1', demo_user_id, 'user', 'What are my top priorities today?', now),
    ('xan_2', demo_user_id, 'assistant', 'You have 3 urgent items: Sarah Chen needs the Q3 design review mockups approved by noon, Marcus Johnson moved the investor pitch to Thursday, and Priya Sharma has a dashboard bug fix waiting for your verification.', now),
    ('xan_3', demo_user_id, 'user', 'Draft a reply to Sarah about the dark mode request', now),
    ('xan_4', demo_user_id, 'assistant', 'Here''s a draft: Hi Sarah, I reviewed the mockups and they look great. Regarding the dark mode variant - we can definitely squeeze it in. I''ll need about half a day, so I can have it ready by tomorrow afternoon. Let me know if that timeline works!', now)
  ON CONFLICT (id) DO NOTHING;

END $$;
