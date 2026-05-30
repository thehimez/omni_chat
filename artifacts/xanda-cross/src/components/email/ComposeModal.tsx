import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Minimize2,
  Maximize2,
  Paperclip,
  Bot,
  Send,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlatformIcon } from "@/components/platform-icon";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName?: string | null;
}

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: ConnectedAccount[];
  defaultPlatform?: string;
}

export function ComposeModal({ isOpen, onClose, accounts, defaultPlatform }: ComposeModalProps) {
  const emailAccounts = accounts.filter(
    (a) => a.platform === "gmail" || a.platform === "outlook",
  );

  const [fromAccountId, setFromAccountId] = useState(
    emailAccounts.find((a) => a.platform === defaultPlatform)?.id ??
    emailAccounts[0]?.id ??
    "",
  );
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const selectedAccount = emailAccounts.find((a) => a.id === fromAccountId);

  async function handleAiDraft() {
    if (!to || !subject) return;
    setIsGenerating(true);
    try {
      const resp = await fetch("/api/xan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Write a professional email to ${to} about "${subject}". Output only the email body text, no subject line or greeting formalities beyond what's natural.`,
        }),
      });
      const data = await resp.json();
      if (data.response) setBody(data.response);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSend() {
    // Backend Phase 3 — new email compose endpoint
    // For now, show a graceful message
    alert("New email sending is being connected in Phase 3. The UI is ready!");
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="compose-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none"
      >
        <motion.div
          key="compose-modal"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`pointer-events-auto bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-200/80 overflow-hidden flex flex-col
            ${minimized ? "w-72 h-12" : "w-[580px] max-h-[80vh]"}`}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 shrink-0">
            <span className="text-sm font-semibold text-white">New Email</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((v) => !v)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Fields */}
              <div className="divide-y divide-gray-100/80 border-b border-gray-100/80 shrink-0">
                {/* From */}
                {emailAccounts.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-medium text-gray-400 w-14 shrink-0">From</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <PlatformIcon platform={selectedAccount?.platform ?? "gmail"} className="w-3.5 h-3.5" />
                      <select
                        value={fromAccountId}
                        onChange={(e) => setFromAccountId(e.target.value)}
                        className="flex-1 text-sm text-gray-700 outline-none bg-transparent cursor-pointer"
                      >
                        {emailAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.accountName || a.platform}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                    </div>
                  </div>
                )}

                {/* To */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-xs font-medium text-gray-400 w-14 shrink-0">To</span>
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@email.com"
                    className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    {!showCc && (
                      <button onClick={() => setShowCc(true)} className="text-[11px] text-gray-400 hover:text-gray-600">CC</button>
                    )}
                    {!showBcc && (
                      <button onClick={() => setShowBcc(true)} className="text-[11px] text-gray-400 hover:text-gray-600">BCC</button>
                    )}
                  </div>
                </div>

                {showCc && (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-medium text-gray-400 w-14 shrink-0">CC</span>
                    <input
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="cc@email.com"
                      className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
                    />
                    <button onClick={() => { setShowCc(false); setCc(""); }} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
                  </div>
                )}

                {showBcc && (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs font-medium text-gray-400 w-14 shrink-0">BCC</span>
                    <input
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="bcc@email.com"
                      className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 outline-none bg-transparent"
                    />
                    <button onClick={() => { setShowBcc(false); setBcc(""); }} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
                  </div>
                )}

                {/* Subject */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-xs font-medium text-gray-400 w-14 shrink-0">Subject</span>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="flex-1 text-sm font-medium text-gray-800 placeholder:text-gray-300 placeholder:font-normal outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message…"
                  className="border-0 focus-visible:ring-0 resize-none h-full p-4 text-sm bg-transparent text-gray-800 placeholder:text-gray-300 min-h-[200px]"
                />
              </div>

              {/* Footer toolbar */}
              <div className="px-4 py-3 flex items-center justify-between bg-gray-50/60 border-t border-gray-100/80 shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    title="Attach file (coming in Phase 3)"
                    className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleAiDraft}
                    disabled={isGenerating || !to || !subject}
                    title="Generate AI draft"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                  >
                    {isGenerating
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Bot className="w-3.5 h-3.5" />
                    }
                    AI Draft
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!to.trim() || !body.trim()}
                  className="rounded-xl gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 border-0 text-white hover:from-indigo-600 hover:to-violet-700 shadow-sm text-xs h-8"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Email
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
