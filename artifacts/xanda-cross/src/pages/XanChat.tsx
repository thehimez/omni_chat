import { useState, useRef, useEffect } from "react";
import { useGetXanHistory, useChatWithXan, getGetXanHistoryQueryKey } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, User, Send } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function XanChat() {
  const { data: history, isLoading } = useGetXanHistory();
  const chatMutation = useChatWithXan();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history?.messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    chatMutation.mutate({
      data: { message: input }
    }, {
      onSuccess: () => {
        setInput("");
        queryClient.invalidateQueries({ queryKey: getGetXanHistoryQueryKey() });
      }
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Bot className="w-5 h-5" />
          <span>Xan Assistant</span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-3/4" />
              <Skeleton className="h-32 w-3/4 ml-auto" />
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {history?.messages.map((msg) => {
                const isXan = msg.role === 'assistant';
                return (
                  <div key={msg.id} className={`flex gap-4 ${isXan ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${isXan ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                      {isXan ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className={`flex flex-col gap-1 max-w-[80%] ${isXan ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                        <span className="font-semibold">{isXan ? 'Xan' : 'You'}</span>
                        <span>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                      </div>
                      <div className={`p-4 rounded-xl text-sm leading-relaxed ${isXan ? 'bg-card border' : 'bg-primary text-primary-foreground'}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              {chatMutation.isPending && (
                <div className="flex gap-4 flex-row">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary shrink-0 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-card border p-4 rounded-xl">
                    <div className="flex gap-1 items-center h-5">
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t bg-card shrink-0">
          <div className="flex items-end gap-2 bg-background border rounded-lg p-2 focus-within:ring-1 focus-within:ring-primary shadow-sm">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Xan anything..."
              className="min-h-[40px] max-h-32 border-0 focus-visible:ring-0 resize-none py-2"
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || chatMutation.isPending} className="shrink-0 mb-1">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Xan has full context of your inbox, contacts, and settings.
          </p>
        </div>
      </div>
    </div>
  );
}
