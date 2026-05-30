import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  RefreshCw,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Reply,
  ReplyAll,
  Forward,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface EmailComposerProps {
  conversationId: string;
  platform: string;
  subject?: string | null;
  contactName: string;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onSend: () => void;
  onRegenerate: () => void;
  isSending: boolean;
  isRegenerating: boolean;
}

type ComposerMode = "quick" | "full";

export function EmailComposer({
  replyText,
  onReplyTextChange,
  onSend,
  onRegenerate,
  isSending,
  isRegenerating,
  subject,
  contactName,
}: EmailComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("quick");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === "full" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-gray-100/80 bg-white/80 shrink-0">
      <div className="px-5 py-3.5 max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden border border-gray-200/80 bg-white shadow-sm focus-within:shadow-md focus-within:border-indigo-200/80 transition-all duration-200">

          {/* Xan Draft bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 border-b border-gray-100/80">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-indigo-600">Xan Draft</span>
            <div className="flex-1" />
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin" : ""}`} />
              Regenerate
            </button>
            <div className="w-px h-3 bg-indigo-200/60" />
            {/* Mode toggle */}
            <button
              onClick={() => setMode(mode === "quick" ? "full" : "quick")}
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-600 transition-colors"
              title={mode === "quick" ? "Expand to full composer" : "Collapse to quick reply"}
            >
              {mode === "quick"
                ? <><Maximize2 className="w-3 h-3" /> Full</>
                : <><Minimize2 className="w-3 h-3" /> Quick</>
              }
            </button>
          </div>

          {/* Full composer header fields */}
          <AnimatePresence initial={false}>
            {mode === "full" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-b border-gray-100/80 divide-y divide-gray-100/60">
                  {/* To field */}
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-medium text-gray-400 w-12 shrink-0">To</span>
                    <span className="text-sm text-gray-700 flex-1 truncate">{contactName}</span>
                    <div className="flex items-center gap-2">
                      {!showCc && (
                        <button
                          onClick={() => setShowCc(true)}
                          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          CC
                        </button>
                      )}
                      {!showBcc && (
                        <button
                          onClick={() => setShowBcc(true)}
                          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          BCC
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CC field */}
                  <AnimatePresence>
                    {showCc && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-3 px-4 py-2 overflow-hidden"
                      >
                        <span className="text-xs font-medium text-gray-400 w-12 shrink-0">CC</span>
                        <input
                          value={cc}
                          onChange={(e) => setCc(e.target.value)}
                          placeholder="Add CC recipients…"
                          className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
                        />
                        <button
                          onClick={() => { setShowCc(false); setCc(""); }}
                          className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          ✕
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* BCC field */}
                  <AnimatePresence>
                    {showBcc && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-3 px-4 py-2 overflow-hidden"
                      >
                        <span className="text-xs font-medium text-gray-400 w-12 shrink-0">BCC</span>
                        <input
                          value={bcc}
                          onChange={(e) => setBcc(e.target.value)}
                          placeholder="Add BCC recipients…"
                          className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
                        />
                        <button
                          onClick={() => { setShowBcc(false); setBcc(""); }}
                          className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          ✕
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Subject field */}
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-medium text-gray-400 w-12 shrink-0">Subject</span>
                    <span className="text-sm text-gray-500 flex-1 truncate">
                      {subject ? `Re: ${subject}` : "(no subject)"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message body */}
          <Textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "quick" ? "Quick reply… (⌘↵ to send)" : "Write your message…"}
            className={`border-0 focus-visible:ring-0 resize-none p-4 text-sm bg-transparent text-gray-800 placeholder:text-gray-300
              ${mode === "quick" ? "min-h-[72px] max-h-40" : "min-h-[120px] max-h-64"}`}
          />

          {/* Toolbar */}
          <div className="px-4 py-2.5 flex items-center justify-between bg-gray-50/60 border-t border-gray-100/60">
            <div className="flex items-center gap-1">
              <button
                title="Attach file (coming in Phase 3)"
                className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-500 transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {mode === "full" && (
                <>
                  <button
                    title="Reply All (CC/BCC wiring in Phase 3)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors border border-gray-200/60"
                  >
                    <ReplyAll className="w-3.5 h-3.5" />
                    Reply All
                  </button>
                  <button
                    title="Forward (coming in Phase 3)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors border border-gray-200/60"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    Forward
                  </button>
                </>
              )}
              <Button
                size="sm"
                onClick={onSend}
                disabled={isSending || !replyText.trim()}
                className="rounded-xl gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 border-0 text-white hover:from-indigo-600 hover:to-violet-700 shadow-sm text-xs h-8"
              >
                {isSending
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
                {mode === "quick" ? "Reply" : "Send"}
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-1.5">
          ⌘↵ to send · Reply All, Forward &amp; Attachments connecting in Phase 3
        </p>
      </div>
    </div>
  );
}
