import { useState, useRef, useEffect } from "react";
import { useGetXanHistory, useChatWithXan, getGetXanHistoryQueryKey } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, User, Send, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

export default function XanChat() {
  const { data: history, isLoading } = useGetXanHistory();
  const chatMutation = useChatWithXan();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history?.messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    chatMutation.mutate(
      { data: { message: input } },
      {
        onSuccess: () => {
          setInput("");
          queryClient.invalidateQueries({ queryKey: getGetXanHistoryQueryKey() });
        },
      },
    );
  };

  const messages = history?.messages ?? [];

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/75 backdrop-blur-xl rounded-2xl px-5 py-3.5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-white/70 flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shadow-sm">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-gray-900 text-sm">Xan Assistant</h1>
          <p className="text-[11px] text-gray-400">Has full context of your inbox</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Online
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 bg-white/75 backdrop-blur-xl rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-white/70 overflow-hidden flex flex-col min-h-0">
        <ScrollArea className="flex-1 px-6 py-5" ref={scrollRef}>
          {isLoading ? (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <Skeleton className="h-20 w-3/4 rounded-2xl" />
              </div>
            </div>
          ) : (
            <div className="space-y-5 max-w-3xl mx-auto pb-4">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center gap-4 py-16"
                >
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-700 mb-1">Ask Xan anything</p>
                    <p className="text-sm text-gray-400 max-w-xs">
                      Summarise threads, draft replies, find contacts, or ask about your inbox.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {[
                      "Summarise my unread messages",
                      "Who messaged me today?",
                      "Draft a reply for my top priority",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setInput(prompt)}
                        className="text-xs px-3 py-2 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((msg, i) => {
                  const isXan = msg.role === "assistant";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i < 3 ? i * 0.05 : 0 }}
                      className={`flex gap-3 ${isXan ? "flex-row" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm
                          ${isXan
                            ? "bg-gradient-to-br from-indigo-400 to-violet-500"
                            : "bg-gradient-to-br from-gray-100 to-gray-200"
                          }`}
                      >
                        {isXan ? (
                          <Bot className="w-4 h-4 text-white" />
                        ) : (
                          <User className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div
                        className={`flex flex-col gap-1 max-w-[80%] ${isXan ? "items-start" : "items-end"}`}
                      >
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
                          <span className="font-semibold">{isXan ? "Xan" : "You"}</span>
                          <span>{format(new Date(msg.createdAt), "h:mm a")}</span>
                        </div>
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                            ${isXan
                              ? "bg-white/90 border border-gray-100 text-gray-800"
                              : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                            }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {chatMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 flex-row"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 shrink-0 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/90 border border-gray-100 px-4 py-3 rounded-2xl shadow-sm">
                    <div className="flex gap-1 items-center h-5">
                      <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" />
                      <span
                        className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="px-5 py-4 border-t border-gray-100/80 shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-2 bg-gray-50/80 rounded-2xl px-4 py-3 border border-gray-200/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-200 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Xan anything…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none resize-none min-h-[24px] max-h-32 leading-relaxed"
              style={{ overflowY: "auto" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-2">
            Xan has full context of your inbox, contacts, and settings.
          </p>
        </div>
      </div>
    </div>
  );
}
