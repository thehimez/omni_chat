import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Copy,
  CheckCheck,
  ListTodo,
  Calendar,
  MessageSquareText,
  PenLine,
  Smile,
  AlignLeft,
} from "lucide-react";
import type { EmailMessage } from "./EmailCard";

interface AIWorkspaceProps {
  conversationId: string;
  contactName: string;
  subject?: string | null;
  messages: EmailMessage[];
  onUseDraft: (text: string) => void;
}

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: (context: string) => string;
  color: string;
}

const ACTIONS: Action[] = [
  {
    id: "summarize",
    label: "Summarize Thread",
    icon: <AlignLeft className="w-3.5 h-3.5" />,
    prompt: (ctx) => `Summarize this email thread in 3-5 bullet points. Be concise and highlight the key decisions, requests, and action items.\n\n${ctx}`,
    color: "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100",
  },
  {
    id: "suggest",
    label: "Suggested Reply",
    icon: <MessageSquareText className="w-3.5 h-3.5" />,
    prompt: (ctx) => `Write a professional, concise reply to this email thread. Output only the reply text — no subject line, no "Dear...", just the body.\n\n${ctx}`,
    color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100",
  },
  {
    id: "professional",
    label: "Rewrite Professional",
    icon: <PenLine className="w-3.5 h-3.5" />,
    prompt: (ctx) => `Rewrite the last message in this thread in a polished, professional tone. Keep the meaning but improve clarity and formality. Output only the rewritten message body.\n\n${ctx}`,
    color: "bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-100",
  },
  {
    id: "friendly",
    label: "Rewrite Friendly",
    icon: <Smile className="w-3.5 h-3.5" />,
    prompt: (ctx) => `Rewrite the last message in this thread in a warm, friendly, approachable tone. Keep it professional but human. Output only the rewritten message body.\n\n${ctx}`,
    color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100",
  },
  {
    id: "actions",
    label: "Extract Action Items",
    icon: <ListTodo className="w-3.5 h-3.5" />,
    prompt: (ctx) => `List all action items, tasks, and follow-ups from this email thread. Format as a numbered list. Be specific about who is responsible for each item.\n\n${ctx}`,
    color: "bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100",
  },
  {
    id: "meetings",
    label: "Detect Meetings",
    icon: <Calendar className="w-3.5 h-3.5" />,
    prompt: (ctx) => `Identify any meeting requests, scheduling discussions, or calendar-related items in this email thread. Extract: proposed dates/times, duration, participants, and purpose. If no meeting content exists, say so clearly.\n\n${ctx}`,
    color: "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100",
  },
];

export function AIWorkspace({ conversationId, contactName, subject, messages, onUseDraft }: AIWorkspaceProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ actionId: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function buildContext(): string {
    const lines = messages.slice(-8).map(
      (m) => `${m.direction === "outbound" ? "Me" : m.senderName}: ${(m.bodyText || "").slice(0, 600)}`
    );
    return `Subject: ${subject || "(no subject)"}\nContact: ${contactName}\n\n${lines.join("\n\n")}`;
  }

  async function runAction(action: Action) {
    if (loading) return;
    setLoading(true);
    setActiveAction(action.id);
    setResult(null);

    try {
      const context = buildContext();
      const resp = await fetch("/api/xan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: action.prompt(context),
          conversationId,
        }),
      });
      const data = await resp.json();
      setResult({ actionId: action.id, text: data.response ?? "No result." });
    } catch {
      setResult({ actionId: action.id, text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const currentAction = ACTIONS.find((a) => a.id === activeAction);

  return (
    <div className="border-t border-gray-100/80 bg-gradient-to-r from-indigo-50/40 to-violet-50/40">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-5 py-3 flex items-center justify-between group hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-indigo-700">Xan AI Workspace</span>
        </div>
        {isOpen
          ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
        }
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => runAction(action)}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                      ${activeAction === action.id && loading
                        ? "opacity-60 cursor-wait"
                        : ""
                      } ${action.color}`}
                  >
                    {activeAction === action.id && loading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : action.icon
                    }
                    {action.label}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {result && (
                  <motion.div
                    key={result.actionId}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 bg-gray-50/60">
                      <div className="flex items-center gap-1.5">
                        {currentAction?.icon && (
                          <span className="text-indigo-500">{currentAction.icon}</span>
                        )}
                        <span className="text-[11px] font-semibold text-gray-600">
                          {currentAction?.label ?? "Result"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {result.actionId === "suggest" || result.actionId === "professional" || result.actionId === "friendly" ? (
                          <button
                            onClick={() => onUseDraft(result.text)}
                            className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            Use as reply
                          </button>
                        ) : null}
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
                        >
                          {copied
                            ? <><CheckCheck className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
                            : <><Copy className="w-3 h-3" />Copy</>
                          }
                        </button>
                      </div>
                    </div>
                    <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                      {result.text}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
