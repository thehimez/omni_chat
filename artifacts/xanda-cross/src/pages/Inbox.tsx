import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useGetConversations,
  useGetConversation,
  useGetConnectedAccounts,
  useSendMessage,
  useRegenerateDraft,
  useMarkConversationRead,
  useTriggerSync,
  getGetConversationsQueryKey,
  getGetConversationQueryKey,
  getGetConnectedAccountsQueryKey,
} from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformIcon } from "@/components/platform-icon";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  RefreshCw,
  Paperclip,
  MoreVertical,
  MessageSquare,
  Inbox as InboxIcon,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatInboxTimestamp } from "@/lib/format-time";
import { usePlatformFilter } from "@/lib/platform-filter-context";

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-11 h-11 rounded-full object-cover shrink-0 shadow-sm"
      />
    );
  }
  const colors = [
    "bg-violet-100 text-violet-600",
    "bg-blue-100 text-blue-600",
    "bg-emerald-100 text-emerald-600",
    "bg-rose-100 text-rose-600",
    "bg-amber-100 text-amber-600",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${colors[idx]}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Inbox() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const selectedId = new URLSearchParams(search).get("id");

  const { data: conversationsData, isLoading: isLoadingList } = useGetConversations();
  const { data: accountsData } = useGetConnectedAccounts();
  const syncMutation = useTriggerSync();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { activePlatform } = usePlatformFilter();

  const handleSelectConversation = useCallback(
    (convId: string) => {
      queryClient.setQueryData(getGetConversationsQueryKey(), (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((c: any) =>
            c.id === convId ? { ...c, isRead: true, unreadCount: 0 } : c,
          ),
        };
      });
      navigate(`/inbox?id=${convId}`);
    },
    [queryClient, navigate],
  );

  const conversations = conversationsData?.conversations || [];
  const connectedAccounts =
    accountsData?.accounts?.filter(
      (a) => a.status === "connected" || a.status === "syncing",
    ) ?? [];

  const filtered = conversations.filter((c) => {
    const matchesPlatform =
      activePlatform === null || c.platform === activePlatform;
    const matchesSearch =
      searchQuery.trim() === "" ||
      c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.preview ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.topicLabel ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const handleSyncAll = async () => {
    if (connectedAccounts.length === 0) return;
    setSyncing(true);
    toast({ title: "Syncing all accounts…", description: "Messages will stream in live." });
    await Promise.allSettled(
      connectedAccounts.map(
        (acc) =>
          new Promise<void>((resolve) => {
            syncMutation.mutate(
              { id: acc.id, data: { depth: "full" } },
              { onSuccess: () => resolve(), onError: () => resolve() },
            );
          }),
      ),
    );
    setSyncing(false);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-3 min-w-0">
      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-white/70">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Start typing to ask or search Xan…"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
          {connectedAccounts.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
          )}
        </div>
      </motion.div>

      {/* Two-pane content */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left: conversation list */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="w-[340px] shrink-0 flex flex-col bg-white/75 backdrop-blur-xl rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-white/70 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100/80 flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-gray-900 text-[15px]">
              {activePlatform ? (
                <span className="flex items-center gap-2">
                  <PlatformIcon platform={activePlatform} className="w-4 h-4" />
                  <span className="capitalize">{activePlatform}</span>
                </span>
              ) : (
                "Inbox"
              )}
            </h2>
            <span className="text-xs text-gray-400 font-medium">{filtered.length}</span>
          </div>

          <ScrollArea className="flex-1">
            {isLoadingList ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[280px]">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <InboxIcon className="w-6 h-6 text-gray-300" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-600 mb-1">
                    {searchQuery ? "No matching messages" : "Your inbox is empty"}
                  </p>
                  {connectedAccounts.length > 0 && !searchQuery ? (
                    <>
                      <p className="text-xs text-gray-400 mb-3">
                        {connectedAccounts.length} account
                        {connectedAccounts.length > 1 ? "s" : ""} connected
                      </p>
                      <Button
                        size="sm"
                        onClick={handleSyncAll}
                        disabled={syncing}
                        className="gap-2 rounded-xl text-xs"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Loading…" : "Load Messages"}
                      </Button>
                    </>
                  ) : !searchQuery ? (
                    <p className="text-xs text-gray-400">
                      Connect an account in{" "}
                      <a href="/accounts" className="text-blue-500 underline">
                        Accounts
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="py-2">
                <AnimatePresence>
                  {filtered.map((conv, i) => (
                    <motion.button
                      key={conv.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all duration-150 group
                        ${selectedId === conv.id
                          ? "bg-blue-50/80"
                          : "hover:bg-gray-50/80"
                        }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar name={conv.contactName} src={conv.contactAvatarUrl} />
                        {!conv.isRead && conv.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className={`text-sm truncate ${!conv.isRead && conv.unreadCount > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}
                          >
                            {conv.contactName}
                          </span>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                            {formatInboxTimestamp(conv.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate leading-snug">
                          {conv.topicLabel || conv.headline || conv.preview || "—"}
                        </p>
                      </div>

                      <div className="shrink-0 opacity-80">
                        <PlatformIcon platform={conv.platform} className="w-4 h-4" />
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </motion.div>

        {/* Right: conversation detail */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="flex-1 min-w-0 bg-white/75 backdrop-blur-xl rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-white/70 overflow-hidden flex flex-col"
        >
          {selectedId ? (
            <ConversationView id={selectedId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
              <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-gray-300" />
              </div>
              <div>
                <p className="font-semibold text-gray-500 text-sm">Select a conversation</p>
                <p className="text-xs text-gray-400 mt-1">Choose a message from the list to view it here</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ConversationView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: conv, isLoading } = useGetConversation(id);
  const sendMessage = useSendMessage();
  const regenerateDraft = useRegenerateDraft();
  const markRead = useMarkConversationRead();

  const [replyText, setReplyText] = useState("");
  const [draftGenerated, setDraftGenerated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRead.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv?.messages]);

  useEffect(() => {
    if (conv?.draftReply && !draftGenerated) {
      setReplyText(conv.draftReply);
      setDraftGenerated(true);
    }
  }, [conv?.draftReply, draftGenerated]);

  useEffect(() => {
    setDraftGenerated(false);
    setReplyText("");
  }, [id]);

  const handleSend = () => {
    if (!replyText.trim() || !conv) return;
    sendMessage.mutate(
      { data: { conversationId: id, platform: conv.platform, body: replyText } },
      {
        onSuccess: () => {
          setReplyText("");
          setDraftGenerated(false);
          queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
        },
      },
    );
  };

  const handleRegenerate = () => {
    regenerateDraft.mutate(
      { conversationId: id },
      { onSuccess: (data) => setReplyText(data.draft) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-24 w-3/4 rounded-2xl" />
          <Skeleton className="h-24 w-3/4 ml-auto rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!conv) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name={conv.contactName} src={conv.contactAvatarUrl} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">{conv.contactName}</h2>
              <PlatformIcon platform={conv.platform} className="w-3.5 h-3.5" />
            </div>
            {conv.topicLabel && (
              <p className="text-xs text-gray-400">{conv.topicLabel}</p>
            )}
          </div>
        </div>
        <button className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-5" ref={scrollRef}>
        <div className="space-y-5 max-w-3xl mx-auto pb-4">
          {conv.messages.map((msg) => {
            const isMe = msg.direction === "outbound";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm
                    ${isMe
                      ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                      : "bg-white/90 border border-gray-100 text-gray-800"
                    }`}
                >
                  {!isMe && msg.senderName !== conv.contactName && (
                    <p className="text-[11px] font-semibold mb-1 opacity-60">
                      {msg.senderName}
                    </p>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.bodyText}
                  </div>
                  <div
                    className={`text-[10px] mt-1.5 text-right ${isMe ? "text-white/60" : "text-gray-400"}`}
                  >
                    {format(new Date(msg.sentAt), "h:mm a")}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply area */}
      <div className="px-5 py-4 border-t border-gray-100/80 shrink-0">
        <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden border border-gray-200/80 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-200 transition-all">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-gray-100">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-indigo-600">Xan Draft</span>
            <div className="flex-1" />
            <button
              onClick={handleRegenerate}
              disabled={regenerateDraft.isPending}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${regenerateDraft.isPending ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>

          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a message or use @Xan for AI help…"
            className="border-0 focus-visible:ring-0 resize-none min-h-[80px] max-h-48 p-4 text-sm bg-transparent"
          />

          <div className="px-4 py-3 flex items-center justify-between bg-gray-50/60">
            <div className="flex gap-1">
              <button className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-xl hover:bg-indigo-50 flex items-center justify-center text-indigo-400 hover:text-indigo-600 transition-colors">
                <Bot className="w-4 h-4" />
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sendMessage.isPending || !replyText.trim()}
              className="rounded-xl gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 border-0 text-white hover:from-indigo-600 hover:to-violet-700 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
