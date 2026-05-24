import { useGetContact } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Activity, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function ContactProfile() {
  const { id } = useParams();
  const { data: profile, isLoading } = useGetContact(id || "");

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-24 mb-8" />
        <div className="flex items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) return <div className="p-8 text-center">Contact not found</div>;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="font-semibold">Contact Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Profile Header */}
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center overflow-hidden shrink-0 border-4 border-card shadow-sm">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-4xl">{profile.displayName.charAt(0)}</span>
              )}
            </div>
            <div className="space-y-3 pt-2">
              <h2 className="text-3xl font-bold tracking-tight">{profile.displayName}</h2>
              <div className="flex flex-wrap gap-2">
                {profile.identities.map((id, i) => (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                    <PlatformIcon platform={id.platform} />
                    <span className="font-mono text-xs">{id.externalId}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relationship Score</p>
                  <p className="text-2xl font-bold">{profile.relationshipScore || 0}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Interaction</p>
                  <p className="font-medium">
                    {profile.lastInteractionAt ? format(new Date(profile.lastInteractionAt), 'MMM d, yyyy') : 'Never'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Topics</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.activeTopics.length > 0 ? profile.activeTopics.map(t => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    )) : <span className="text-sm">None</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold border-b pb-2">Recent Conversations</h3>
            {profile.recentConversations.length === 0 ? (
              <p className="text-muted-foreground">No recent conversations.</p>
            ) : (
              <div className="grid gap-3">
                {profile.recentConversations.map((conv) => (
                  <Link key={conv.id} href={`/inbox?id=${conv.id}`}>
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <PlatformIcon platform={conv.platform} className="w-6 h-6" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{conv.headline || 'Conversation'}</span>
                              {conv.topicLabel && <Badge variant="secondary" className="text-[10px]">{conv.topicLabel}</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{conv.preview}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(conv.lastMessageAt), 'MMM d')}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
