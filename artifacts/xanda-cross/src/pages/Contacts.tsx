import { useGetContacts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Users } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetContacts({ search: search || undefined });

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-card">
        <h1 className="font-semibold">Smart Contacts</h1>
      </header>

      <div className="p-6 shrink-0 max-w-5xl mx-auto w-full">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search contacts..." 
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : data?.contacts && data.contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.contacts.map((contact) => (
                <Link key={contact.id} href={`/contacts/${contact.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shrink-0 overflow-hidden">
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt={contact.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-lg">{contact.displayName.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{contact.displayName}</h3>
                        <div className="flex gap-1 mt-1">
                          {contact.platforms.map((p) => (
                            <PlatformIcon key={p} platform={p} className="w-3 h-3" />
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        <div className="font-medium text-foreground">{contact.activeConversationCount}</div>
                        <div>Chats</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No contacts found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
