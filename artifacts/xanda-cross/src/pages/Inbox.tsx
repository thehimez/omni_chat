import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetConversations, 
  useGetConversation, 
  useSendMessage,
  useRegenerateDraft,
  useMarkConversationRead,
  getGetConversationsQueryKey,
  getGetConversationQueryKey
} from "@workspace/api-client-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Bot, Send, RefreshCw, Paperclip, MoreVertical, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function Inbox() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const selectedId = searchParams.get("id");

  const { data: conversationsData, isLoading: isLoadingList } = useGetConversations();
  const conversations = conversationsData?.conversations || [];

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-4 shrink-0 bg-card">
        <h1 className="font-semibold">Unified Inbox</h1>
      </header>
      
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25} maxSize={45} className="border-r flex flex-col bg-card">
          <ScrollArea className="flex-1">
            {isLoadingList ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => window.history.pushState({}, '', `/inbox?id=${conv.id}`)}
                    className={`w-full text-left p-4 hover:bg-accent/50 transition-colors ${selectedId === conv.id ? 'bg-accent' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold line-clamp-1">{conv.contactName}</span>
                        {!conv.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(conv.lastMessageAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformIcon platform={conv.platform} />
                      <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                        {conv.headline || conv.preview}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {conv.priority === 'urgent' && <Badge variant="destructive" className="text-[10px] h-4">URGENT</Badge>}
                      {conv.priority === 'high' && <Badge variant="default" className="text-[10px] h-4 bg-orange-500 hover:bg-orange-600">HIGH</Badge>}
                      {conv.topicLabel && <Badge variant="secondary" className="text-[10px] h-4">{conv.topicLabel}</Badge>}
                    </div>
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
              <p>Select a conversation to view</p>
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
    if (conv && !conv.messages[conv.messages.length - 1]?.isRead) {
      markRead.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
        }
      });
    }
  }, [conv, id, markRead, queryClient]);

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
