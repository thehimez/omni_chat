import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { HtmlRenderer } from "./HtmlRenderer";

export interface EmailMessage {
  id: string;
  direction: string;
  bodyText: string;
  bodyHtml?: string | null;
  senderName: string;
  senderAvatarUrl?: string | null;
  sentAt: string;
  isRead: boolean;
}

interface EmailCardProps {
  message: EmailMessage;
  isExpanded: boolean;
  onToggle: () => void;
  isLatest: boolean;
}

const INITIALS_COLORS = [
  "bg-violet-100 text-violet-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-rose-100 text-rose-600",
  "bg-amber-100 text-amber-600",
  "bg-indigo-100 text-indigo-600",
];

function SenderBubble({ name, isMe }: { name: string; isMe: boolean }) {
  if (isMe) {
    return (
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
        M
      </div>
    );
  }
  const idx = name.charCodeAt(0) % INITIALS_COLORS.length;
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${INITIALS_COLORS[idx]}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function hasLikelyAttachment(text: string): boolean {
  const lower = (text || "").toLowerCase();
  return lower.includes("(media)") || lower.includes("[attachment]");
}

export function EmailCard({ message, isExpanded, onToggle, isLatest }: EmailCardProps) {
  const isMe = message.direction === "outbound";
  const displayName = isMe ? "Me" : message.senderName;
  const sentAt = new Date(message.sentAt);
  const formattedDate = format(sentAt, "MMM d, yyyy 'at' h:mm a");
  const preview = (message.bodyText || "").replace(/\s+/g, " ").trim().slice(0, 140);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border overflow-hidden transition-all duration-200
        ${isLatest
          ? "border-gray-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          : "border-gray-100/80 bg-gray-50/50"
        }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-black/[0.02] transition-colors"
      >
        <SenderBubble name={displayName} isMe={isMe} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${isLatest ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
              {displayName}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {hasLikelyAttachment(message.bodyText) && (
                <Paperclip className="w-3 h-3 text-gray-400" />
              )}
              <span className="text-[11px] text-gray-400 whitespace-nowrap">{formattedDate}</span>
              {isExpanded
                ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              }
            </div>
          </div>
          {!isExpanded && (
            <p className="text-xs text-gray-400 truncate mt-0.5 leading-snug">
              {preview || "…"}
            </p>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-gray-100/80">
              <HtmlRenderer html={message.bodyHtml} text={message.bodyText} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
