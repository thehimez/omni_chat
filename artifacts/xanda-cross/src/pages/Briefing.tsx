import { useGetBriefing } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/platform-icon";
import { Link } from "wouter";
import { Bot, Clock, MessageSquare, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Briefing() {
  const { data: briefing, isLoading } = useGetBriefing();

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <Skeleton className="h-10 w-52 rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const stagger = {
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.07 } },
    },
    item: {
      hidden: { opacity: 0, y: 14 },
      show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    },
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-3xl mx-auto space-y-5"
      >
        {/* Header */}
        <motion.div variants={stagger.item}>
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(), "EEEE, MMMM do · h:mm a")}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {briefing.greeting}
          </h1>
        </motion.div>

        {/* Xan summary */}
        {briefing.xanSummary && (
          <motion.div
            variants={stagger.item}
            className="bg-gradient-to-br from-indigo-50/80 to-violet-50/80 backdrop-blur-xl rounded-3xl p-5 border border-indigo-100/60 shadow-sm"
          >
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-indigo-700 text-sm">Xan Briefing</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-500 font-medium">
                    AI Generated
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{briefing.xanSummary}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div variants={stagger.item} className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<Zap className="w-4 h-4 text-amber-500" />}
            label="Inbox State"
            value={briefing.inboxState}
            color="amber"
          />
          <StatCard
            icon={<MessageSquare className="w-4 h-4 text-blue-500" />}
            label="New Messages"
            value={String(briefing.newMessageCount)}
            color="blue"
          />
          <StatCard
            icon={<Zap className="w-4 h-4 text-violet-500" />}
            label="Action Items"
            value={String(briefing.unansweredCount)}
            color="violet"
          />
        </motion.div>

        {/* AI Action Items */}
        {briefing.topPriorityConversations &&
          briefing.topPriorityConversations.length > 0 ? (
            <motion.div variants={stagger.item} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Action Items
              </h2>
              {briefing.topPriorityConversations.map((conv) => {
                const score = (conv as any).aiActionScore ?? 0;
                const actionLabel = (conv as any).aiActionLabel;
                const aiTopicLabel = (conv as any).aiTopicLabel ?? conv.topicLabel;
                const badgeText = score >= 90 ? "CRITICAL" : score >= 70 ? "HIGH" : "MEDIUM";
                const badgeCls = score >= 90
                  ? "bg-rose-600 text-white"
                  : score >= 70
                    ? "bg-orange-500 text-white"
                    : "bg-amber-400 text-white";
                const accentCls = score >= 90
                  ? "from-rose-400 to-rose-600"
                  : score >= 70
                    ? "from-orange-400 to-orange-600"
                    : "from-amber-400 to-amber-500";

                return (
                  <Link key={conv.id} href={`/inbox?id=${conv.id}`}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="bg-white/80 backdrop-blur-xl rounded-3xl p-4 border border-white/70 shadow-[0_2px_16px_rgba(0,0,0,0.05)] cursor-pointer hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-all duration-200 flex items-center gap-4"
                    >
                      <div className={`w-4 h-10 rounded-full bg-gradient-to-b ${accentCls} shrink-0`} />

                      <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 font-semibold text-gray-600">
                        {conv.contactAvatarUrl ? (
                          <img
                            src={conv.contactAvatarUrl}
                            alt={conv.contactName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          conv.contactName.charAt(0)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">
                            {conv.contactName}
                          </span>
                          <PlatformIcon platform={conv.platform} className="w-3.5 h-3.5" />
                          {aiTopicLabel && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                              {aiTopicLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {actionLabel || conv.headline || conv.preview}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${badgeCls}`}>
                          {badgeText}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {format(new Date(conv.lastMessageAt), "h:mm a")}
                        </span>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </motion.div>
          ) : (
            <motion.div variants={stagger.item} className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/70 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">No action items</p>
              <p className="text-xs text-gray-400">You're all caught up. Xan will alert you when something needs attention.</p>
            </motion.div>
          )}
      </motion.div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "amber" | "blue" | "violet";
}) {
  const bg = {
    amber: "from-amber-50/80 to-orange-50/60 border-amber-100/60",
    blue: "from-blue-50/80 to-sky-50/60 border-blue-100/60",
    violet: "from-violet-50/80 to-purple-50/60 border-violet-100/60",
  }[color];

  return (
    <div
      className={`bg-gradient-to-br ${bg} backdrop-blur-xl rounded-3xl p-5 border shadow-sm`}
    >
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 font-medium">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 capitalize">{value}</p>
    </div>
  );
}
