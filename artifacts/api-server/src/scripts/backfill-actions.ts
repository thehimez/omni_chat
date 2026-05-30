import { db, conversationsTable } from "@workspace/db";
import { eq, and, isNull, or, lt, desc } from "drizzle-orm";
import { analyzeConversation } from "../lib/action-analyzer";

const USER_ID = "user_1779984340378_0d6us84";

const pending = await db
  .select()
  .from(conversationsTable)
  .where(
    and(
      eq(conversationsTable.userId, USER_ID),
      or(
        isNull(conversationsTable.aiLastAnalyzedAt),
        lt(conversationsTable.aiLastAnalyzedAt, conversationsTable.lastMessageAt),
      ),
    ),
  )
  .orderBy(desc(conversationsTable.lastMessageAt))
  .limit(30);

console.log(`Analyzing ${pending.length} conversations...`);
let analyzed = 0;
let actions = 0;

for (let i = 0; i < pending.length; i += 5) {
  const chunk = pending.slice(i, i + 5);
  await Promise.all(chunk.map(async (conv) => {
    try {
      const result = await analyzeConversation({
        contactName: conv.contactName,
        platform: conv.platform,
        headline: conv.headline,
        topicLabel: conv.topicLabel,
        needsReply: conv.needsReply,
        providerChatId: conv.providerChatId,
        unreadCount: conv.unreadCount,
      });

      const now = new Date();
      const newStatus = result.actionRequired && conv.aiActionStatus === "seen"
        ? "active" : conv.aiActionStatus;

      await db.update(conversationsTable).set({
        aiActionRequired: result.actionRequired,
        aiActionLabel: result.actionLabel,
        aiActionScore: result.actionScore,
        aiActionReason: result.actionReason,
        aiTopicLabel: result.topicLabel ?? conv.aiTopicLabel,
        aiLastAnalyzedAt: now,
        aiActionStatus: newStatus,
      }).where(eq(conversationsTable.id, conv.id));

      analyzed++;
      if (result.actionRequired) actions++;
      console.log(`  [${analyzed}/${pending.length}] ${result.actionRequired ? "ACTION" : "skip "} ${conv.contactName} (${conv.platform}) score=${result.actionScore}`);
    } catch (e: any) {
      console.error(`  ERROR ${conv.id}: ${e.message}`);
      analyzed++;
    }
  }));
}

console.log(`\nDone: ${analyzed} analyzed, ${actions} require action`);
process.exit(0);
