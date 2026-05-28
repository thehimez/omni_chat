import { useState } from "react";
import { useSemanticSearch } from "@workspace/api-client-react";
import { PlatformIcon } from "@/components/platform-icon";
import { Search as SearchIcon, Bot, ArrowRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function Search() {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [, setLocation] = useLocation();
  const searchMutation = useSemanticSearch();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    if (query.startsWith("@Xan ")) {
      setLocation(`/xan?q=${encodeURIComponent(query.replace("@Xan ", ""))}`);
      return;
    }
    setHasSearched(true);
    searchMutation.mutate({ data: { query } });
  };

  const isXanMode = query.startsWith("@Xan");

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-5"
      >
        {/* Search bar */}
        <form onSubmit={handleSearch}>
          <div
            className={`flex items-center gap-3 bg-white/80 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-[0_2px_20px_rgba(0,0,0,0.07)] border transition-all duration-200 ${
              isXanMode
                ? "border-indigo-200/80 ring-2 ring-indigo-100"
                : "border-white/70 focus-within:ring-2 focus-within:ring-blue-100"
            }`}
          >
            {isXanMode ? (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            ) : (
              <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages, contacts, topics… or try @Xan what did John say about pricing?"
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
              autoFocus
            />
            {isXanMode && (
              <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">
                Ask Xan
              </span>
            )}
            <button
              type="submit"
              disabled={!query.trim() || searchMutation.isPending}
              className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-medium hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Loading */}
        {searchMutation.isPending && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {hasSearched && !searchMutation.isPending && searchMutation.data?.results && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <p className="text-xs text-gray-400 font-medium px-1">
                {searchMutation.data.total} results for "{query}"
              </p>

              {searchMutation.data.results.length === 0 ? (
                <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/70 p-12 text-center">
                  <SearchIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">No results found</p>
                  <p className="text-sm text-gray-400 mt-1">Try different keywords or use @Xan for AI search</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(searchMutation.data.results as any[]).map((result, i) => (
                    <Link key={i} href={`/inbox?id=${result.conversationId}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -2 }}
                        className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/70 shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-5 cursor-pointer hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{result.contactName}</span>
                            <PlatformIcon platform={result.platform} className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-medium">
                              {Math.round(result.relevanceScore * 100)}% match
                            </span>
                            <span>{format(new Date(result.sentAt), "MMM d, yyyy")}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {result.snippet}
                        </p>
                        <div className="mt-3 flex items-center text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          View conversation <ArrowRight className="w-3 h-3 ml-1" />
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!hasSearched && !searchMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/70 p-16 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Search everything</p>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Semantic search across all your messages, contacts, and topics. Use{" "}
              <span className="font-medium text-indigo-500">@Xan</span> for AI-powered answers.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
