import { useGetBriefing } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/platform-icon";
import { Link } from "wouter";
import { Bot, Clock, MessageSquare, Zap } from "lucide-react";

export default function Briefing() {
  const { data: briefing, isLoading } = useGetBriefing();

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="h-full overflow-y-auto p-8 bg-background">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <p className="text-muted-foreground text-sm font-mono mb-2 flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            {format(new Date(), 'EEEE, MMMM do · h:mm a')}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">{briefing.greeting}</h1>
        </div>

        {/* Xan's Summary */}
        {briefing.xanSummary && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  Xan Briefing
                  <Badge variant="outline" className="text-xs bg-background">AI Generated</Badge>
                </h3>
                <p className="text-foreground leading-relaxed">
                  {briefing.xanSummary}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="font-medium">Inbox State</span>
              </div>
              <p className="text-3xl font-bold capitalize">{briefing.inboxState}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium">New Messages</span>
              </div>
              <p className="text-3xl font-bold">{briefing.newMessageCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="w-4 h-4" />
                <span className="font-medium">Unanswered</span>
              </div>
              <p className="text-3xl font-bold">{briefing.unansweredCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Priority Conversations */}
        {briefing.topPriorityConversations && briefing.topPriorityConversations.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight border-b pb-2">Top Priority</h2>
            <div className="grid gap-4">
              {briefing.topPriorityConversations.map((conv) => (
                <Link key={conv.id} href={`/inbox?id=${conv.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-l-4 border-l-destructive">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center overflow-hidden">
                          {conv.contactAvatarUrl ? (
                            <img src={conv.contactAvatarUrl} alt={conv.contactName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-lg">{conv.contactName.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{conv.contactName}</span>
                            <PlatformIcon platform={conv.platform} />
                            {conv.topicLabel && (
                              <Badge variant="secondary" className="text-[10px] h-5">{conv.topicLabel}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{conv.headline || conv.preview}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="destructive" className="uppercase text-[10px] tracking-wider">Urgent</Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(conv.lastMessageAt), 'h:mm a')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
