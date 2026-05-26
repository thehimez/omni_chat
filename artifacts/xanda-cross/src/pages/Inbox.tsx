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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, RefreshCw, Paperclip, MoreVertical, MessageSquare, Inbox as InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatInboxTimestamp } from "@/lib/format-time";

export default function Inbox() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const selectedId = new URLSearchParams(search).get("id");

  const { data: conversationsData, isLoading: isLoadingList, refetch } = useGetConversations();
  const { data: accountsData } = useGetConnectedAccounts();
  const syncMutation = useTriggerSync();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleSelectConversation = useCallback((convId: string) => {
    queryClient.setQueryData(
      getGetConversationsQueryKey(),
      (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((c: any) =>
            c.id === convId ? { ...c, isRead: true, unreadCount: 0 } : c,
          ),
        };
      },
    );
    navigate(`/inbox?id=${convId}`);
  }, [queryClient, navigate]);

  const conversations = conversationsData?.conversations || [];
  const connectedAccounts = accountsData?.accounts?.filter((a) => a.status === "connected" || a.status === "syncing") ?? [];

  const handleSyncAll = async () => {
    if (connectedAccounts.length === 0) return;
    setSyncing(true);
    toast({ title: "Syncing all accounts…", description: "Your messages will appear shortly." });

    await Promise.allSettled(
      connectedAccounts.map((acc) =>
        new Promise<void>((resolve) => {
          syncMutation.mutate({ id: acc.id, data: { depth: "full" } }, {
            onSuccess: () => resolve(),
            onError: () => resolve(),
          });
        })
      )
    );

    // Poll for conversations appearing — retry up to 6 times with 2s delay
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      await queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
      const result = await queryClient.fetchQuery({ queryKey: getGetConversationsQueryKey() });
      const count = (result as any)?.conversations?.length ?? 0;
      if (count > 0 || attempts >= 6) {
        clearInterval(poll);
        setSyncing(false);
        if (count > 0) {
          toast({ title: `${count} conversations loaded`, description: "Your inbox is ready." });
        } else {
          toast({ title: "Sync complete", description: "No conversations found yet — they may take a moment to appear." });
        }
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      }
    }, 2000);
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-card">
        <h1 className="font-semibold">Unified Inbox</h1>
        {connectedAccounts.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-2"
            onClick={handleSyncAll}
            disabled={syncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync All"}
          </Button>
        )}
      </header>
      
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25} maxSize={45} className="border-r flex flex-col bg-card">
          <ScrollArea className="flex-1">
            {isLoadingList ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px] gap-4">
                <InboxIcon className="w-10 h-10 opacity-20" />
                <div>
                  <p className="font-medium text-sm mb-1">Your inbox is empty</p>
                  {connectedAccounts.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-4">
                        {connectedAccounts.length} account{connectedAccounts.length > 1 ? "s" : ""} connected — click to load your history
                      </p>
                      <Button size="sm" onClick={handleSyncAll} disabled={syncing} className="gap-2">
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing…" : "Load Messages"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Connect an account in <a href="/accounts" className="underline text-primary">Accounts</a> first
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left p-4 hover:bg-accent/50 transition-colors ${selectedId === conv.id ? 'bg-accent' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm line-clamp-1 ${!conv.isRead && conv.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>{conv.contactName}</span>
                        {!conv.isRead && conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1 shrink-0 font-bold">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] whitespace-nowrap shrink-0 ml-2 ${!conv.isRead && conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {formatInboxTimestamp(conv.lastMessageAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <PlatformIcon platform={conv.platform} className="w-3 h-3 shrink-0" />
                      <span className="text-xs text-muted-foreground line-clamp-1 flex-1">
                        {conv.topicLabel || conv.headline || conv.preview || "No preview"}
                      </span>
                    </div>

                    {(conv.priority === 'urgent' || conv.priority === 'high') && (
                      <div className="flex items-center gap-1">
                        {conv.priority === 'urgent' && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">URGENT</Badge>}
                        {conv.priority === 'high' && <Badge className="text-[10px] h-4 px-1.5 bg-orange-500 hover:bg-orange-600">HIGH</Badge>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={70} className="flex flex-col bg-background relative">
          {selectedId ? (
            <ConversationView id={selectedId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Select a conversation to view</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
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
    markRead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
      },
    });
  // markRead is stable; only re-fire when conversation changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv?.messages]);

  // Initialize draft when conversation loads
  useEffect(() => {
    if (conv?.draftReply && !draftGenerated) {
      setReplyText(conv.draftReply);
      setDraftGenerated(true);
    }
  }, [conv?.draftReply, draftGenerated]);

  // Reset draft state when ID changes
  useEffect(() => {
    setDraftGenerated(false);
    setReplyText("");
  }, [id]);

  const handleSend = () => {
    if (!replyText.trim() || !conv) return;
    
    sendMessage.mutate({
      data: {
        conversationId: id,
        platform: conv.platform,
        body: replyText
      }
    }, {
      onSuccess: () => {
        setReplyText("");
        setDraftGenerated(false);
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
      }
    });
  };

  const handleRegenerate = () => {
    regenerateDraft.mutate({ conversationId: id }, {
      onSuccess: (data) => {
        setReplyText(data.draft);
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 flex-1 flex items-center justify-center"><Skeleton className="h-[400px] w-full max-w-2xl" /></div>;
  }

  if (!conv) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center overflow-hidden shrink-0">
            {conv.contactAvatarUrl ? (
              <img src={conv.contactAvatarUrl} alt={conv.contactName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold">{conv.contactName.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold truncate">{conv.contactName}</h2>
              <PlatformIcon platform={conv.platform} />
            </div>
            {conv.topicLabel && <span className="text-xs text-muted-foreground">{conv.topicLabel}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5" /></Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-6 max-w-3xl mx-auto pb-4">
          {conv.messages.map((msg) => {
            const isMe = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl p-4 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  {!isMe && msg.senderName !== conv.contactName && (
                    <p className="text-xs font-semibold mb-1 opacity-70">{msg.senderName}</p>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.bodyText}</div>
                  <div className={`text-[10px] mt-2 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {format(new Date(msg.sentAt), 'h:mm a')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Draft/Reply Area */}
      <div className="p-4 border-t bg-card shrink-0">
        <div className="max-w-3xl mx-auto bg-background border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary shadow-sm">
          
          {/* Xan Bar */}
          <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Bot className="w-4 h-4" />
              Xan Draft
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 hover:bg-primary/10 hover:text-primary" onClick={handleRegenerate} disabled={regenerateDraft.isPending}>
              <RefreshCw className={`w-3 h-3 mr-1 ${regenerateDraft.isPending ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>

          <Textarea 
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a message or use @Xan for AI help..."
            className="border-0 focus-visible:ring-0 resize-none min-h-[80px] max-h-48 p-4 text-sm"
          />

          <div className="px-4 py-3 flex items-center justify-between bg-accent/30">
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Paperclip className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"><Bot className="w-4 h-4" /></Button>
            </div>
            <Button size="sm" onClick={handleSend} disabled={sendMessage.isPending || !replyText.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
