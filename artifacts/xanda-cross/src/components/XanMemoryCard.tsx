import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronUp, RefreshCw, Lightbulb, ListTodo, Zap } from "lucide-react";

interface MemoryCard {
  lastDiscussed: string;
  importantFacts: string[];
  openItems: string[];
  suggestedFollowUp: string;
}

interface XanMemoryCardProps {
  conversationId: string;
  contactId?: string | null;
  apiBase?: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "";

async function fetchMemoryCard(contactId: string, conversationId: string): Promise<MemoryCard> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/intelligence/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch memory card");
  const data = await res.json();
  return data.card as MemoryCard;
}

export function XanMemoryCard({ conversationId, contactId }: XanMemoryCardProps) {
  const [card, setCard] = useState<MemoryCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!contactId) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setCard(null);
    setError(false);
    setLoading(true);
    setCollapsed(false);

    fetchMemoryCard(contactId, conversationId)
      .then((c) => {
        const empty = !c.lastDiscussed && c.importantFacts.length === 0 && c.openItems.length === 0;
        if (!empty) setCard(c);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
  }, [conversationId, contactId]);

  const handleRefresh = () => {
    if (!contactId) return;
    setLoading(true);
    setError(false);
    fetchMemoryCard(contactId, conversationId)
      .then((c) => setCard(c))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  if (!contactId || (!loading && !card && !error)) return null;

  const hasContent = card && (
    card.importantFacts.length > 0 ||
    card.openItems.length > 0 ||
    card.suggestedFollowUp ||
    card.lastDiscussed
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className="mx-5 mb-2"
      >
        <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/50 backdrop-blur-sm overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0">
              <Brain className="w-3 h-3 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 tracking-wide uppercase">Xan Memory</span>
            <div className="flex-1" />
            {card && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-1 rounded-lg hover:bg-indigo-100/60 text-indigo-400 hover:text-indigo-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            {hasContent && (
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="p-1 rounded-lg hover:bg-indigo-100/60 text-indigo-400 hover:text-indigo-600 transition-colors"
              >
                {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Body */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-4 pb-3 space-y-2.5">
                  {loading && !card && (
                    <div className="flex items-center gap-2 text-indigo-400 py-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Analyzing context…</span>
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-gray-400">Could not load context.</p>
                  )}

                  {card && (
                    <>
                      {card.lastDiscussed && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400 mb-1">Last discussed</p>
                          <p className="text-xs text-gray-700">{card.lastDiscussed}</p>
                        </div>
                      )}

                      {card.importantFacts.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <Lightbulb className="w-3 h-3 text-amber-400" />
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Important facts</p>
                          </div>
                          <ul className="space-y-0.5">
                            {card.importantFacts.map((f, i) => (
                              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                <span className="text-indigo-300 mt-0.5">•</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {card.openItems.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <ListTodo className="w-3 h-3 text-rose-400" />
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">Open items</p>
                          </div>
                          <ul className="space-y-0.5">
                            {card.openItems.map((item, i) => (
                              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                <span className="text-rose-300 mt-0.5">◦</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {card.suggestedFollowUp && (
                        <div className="flex items-start gap-2 bg-violet-50/80 rounded-xl px-3 py-2">
                          <Zap className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-violet-700">{card.suggestedFollowUp}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
