import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MoreVertical,
  Reply,
  ReplyAll,
  Forward,
  PenSquare,
  Users,
  Clock,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/platform-icon";
import { EmailCard, type EmailMessage } from "./EmailCard";
import { AIWorkspace } from "./AIWorkspace";
import { EmailComposer } from "./EmailComposer";
import { ComposeModal } from "./ComposeModal";
import {
  useGetConversation,
  useSendMessage,
  useRegenerateDraft,
  useMarkConversationRead,
  getGetConversationQueryKey,
  getGetConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName?: string | null;
  status?: string;
}

interface EmailViewProps {
  id: string;
  connectedAccounts: ConnectedAccount[];
}

function getPlatformLabel(platform: string) {
  const labels: Record<string, string> = {
    gmail: "Gmail",
    outlook: "Outlook",
  };
  return labels[platform] ?? platform;
}

function ParticipantChip({ name }: { name: string }) {
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[idx]}`}>
      {name}
    </span>
  );
}

export function EmailView({ id, connectedAccounts }: EmailViewProps) {
  const queryClient = useQueryClient();
  const { data: conv, isLoading } = useGetConversation(id);
  const sendMessage = useSendMessage();
  const regenerateDraft = useRegenerateDraft();
  const markRead = useMarkConversationRead();

  const [replyText, setReplyText] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark read on open
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

  // Reset state when conversation changes
  useEffect(() => {
    setReplyText("");
    setDraftLoaded(false);
    setExpandedIds(new Set());
    setShowCompose(false);
  }, [id]);

  // Auto-expand latest message
  useEffect(() => {
    if (conv?.messages?.length) {
      const latest = conv.messages[conv.messages.length - 1];
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(latest.id);
        return next;
      });
    }
  }, [conv?.messages]);

  // Load draft
  useEffect(() => {
    if (conv?.draftReply && !draftLoaded) {
      setReplyText(conv.draftReply);
      setDraftLoaded(true);
    }
  }, [conv?.draftReply, draftLoaded]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv?.messages?.length]);

  const toggleCard = useCallback((msgId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleSend = useCallback(() => {
    if (!replyText.trim() || !conv) return;
    sendMessage.mutate(
      { data: { conversationId: id, platform: conv.platform, body: replyText } },
      {
        onSuccess: () => {
          setReplyText("");
          setDraftLoaded(false);
          queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
        },
      },
    );
  }, [replyText, conv, id, sendMessage, queryClient]);

  const handleRegenerate = useCallback(() => {
    regenerateDraft.mutate(
      { conversationId: id },
      { onSuccess: (data: { draft: string }) => setReplyText(data.draft) },
    );
  }, [id, regenerateDraft]);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 flex flex-col gap-5">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-4/5 rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!conv) return null;

  const messages = conv.messages ?? [];
  const latestMsg = messages[messages.length - 1];
  const latestDate = latestMsg ? new Date(latestMsg.sentAt) : null;
  const participantNames: string[] = Array.from(
    new Set((messages as Array<{ direction: string; senderName: string }>).map(
      (m) => (m.direction === "outbound" ? "Me" : m.senderName)
    ))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Email Thread Header ────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-100/80 bg-white/60 shrink-0">
        {/* Subject */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-lg font-bold text-gray-900 leading-snug flex-1">
            {conv.topicLabel || "(no subject)"}
          </h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100/80 border border-gray-200/60">
              <PlatformIcon platform={conv.platform} className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold text-gray-600">
                {getPlatformLabel(conv.platform)}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium text-gray-700">{conv.contactName}</span>
          </div>

          {participantNames.length > 1 && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
              <Users className="w-3.5 h-3.5" />
              <div className="flex flex-wrap gap-1">
                {participantNames.slice(0, 4).map((name) => (
                  <ParticipantChip key={name} name={name} />
                ))}
                {participantNames.length > 4 && (
                  <span className="text-[11px] text-gray-400">+{participantNames.length - 4} more</span>
                )}
              </div>
            </div>
          )}

          {latestDate && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {format(latestDate, "MMM d, yyyy 'at' h:mm a")}
            </div>
          )}

          <span className="text-[11px] text-gray-400">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            title="Reply"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200/80 transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
            Reply
          </button>
          <button
            title="Reply All (CC/BCC in Phase 3)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:bg-gray-50 border border-gray-200/80 transition-colors"
          >
            <ReplyAll className="w-3.5 h-3.5" />
            Reply All
          </button>
          <button
            title="Forward (Phase 3)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:bg-gray-50 border border-gray-200/80 transition-colors"
          >
            <Forward className="w-3.5 h-3.5" />
            Forward
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-sm transition-all"
          >
            <PenSquare className="w-3.5 h-3.5" />
            New Email
          </button>
          <button className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── Thread Cards ──────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="px-6 py-5 space-y-3 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Mail className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No messages in this thread yet</p>
            </div>
          ) : (
            <>
              {(messages as EmailMessage[]).map((msg, i) => (
                <EmailCard
                  key={msg.id}
                  message={msg}
                  isExpanded={expandedIds.has(msg.id)}
                  onToggle={() => toggleCard(msg.id)}
                  isLatest={i === messages.length - 1}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* ── AI Workspace ─────────────────────────────────────────────────── */}
      <AIWorkspace
        conversationId={id}
        contactName={conv.contactName}
        subject={conv.topicLabel}
        messages={messages}
        onUseDraft={(text) => setReplyText(text)}
      />

      {/* ── Email Composer ───────────────────────────────────────────────── */}
      <EmailComposer
        conversationId={id}
        platform={conv.platform}
        subject={conv.topicLabel}
        contactName={conv.contactName}
        replyText={replyText}
        onReplyTextChange={setReplyText}
        onSend={handleSend}
        onRegenerate={handleRegenerate}
        isSending={sendMessage.isPending}
        isRegenerating={regenerateDraft.isPending}
      />

      {/* ── New Email Compose Modal ───────────────────────────────────────── */}
      <ComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        accounts={connectedAccounts}
        defaultPlatform={conv.platform}
      />
    </div>
  );
}
