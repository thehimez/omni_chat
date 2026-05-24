import { useState } from "react";
import { useSemanticSearch } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icon";
import { Search as SearchIcon, Bot, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";

export default function Search() {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [, setLocation] = useLocation();

  // Assuming useSemanticSearch is a mutation based on the input type
  const searchMutation = useSemanticSearch();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (query.startsWith("@Xan ")) {
      // Redirect to Xan chat with the query
      setLocation(`/xan?q=${encodeURIComponent(query.replace("@Xan ", ""))}`);
      return;
    }

    setHasSearched(true);
    searchMutation.mutate({
      data: { query }
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
        <h1 className="font-semibold">Semantic Search</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <form onSubmit={handleSearch} className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all platforms... Try '@Xan what did John say about pricing?'"
              className="pl-12 pr-24 h-14 text-lg bg-card shadow-sm border-2 focus-visible:ring-primary/20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {query.startsWith("@Xan") && (
                <div className="text-xs font-medium text-primary flex items-center gap-1 mr-2 animate-in fade-in">
                  <Bot className="w-4 h-4" /> Ask Xan
                </div>
              )}
              <Button type="submit" size="sm" disabled={!query.trim() || searchMutation.isPending}>
                Search
              </Button>
            </div>
          </form>

          {searchMutation.isPending && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {hasSearched && !searchMutation.isPending && searchMutation.data?.results && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span>Found {searchMutation.data.total} results</span>
              </div>
              
              {searchMutation.data.results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="grid gap-4">
                  {searchMutation.data.results.map((result, i) => (
                    <Link key={i} href={`/inbox?id=${result.conversationId}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{result.contactName}</span>
                              <PlatformIcon platform={result.platform} />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Score: {Math.round(result.relevanceScore * 100)}%</span>
                              <span>{format(new Date(result.sentAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 line-clamp-2">
                            {result.snippet}
                          </p>
                          <div className="mt-3 flex items-center text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            View conversation <ArrowRight className="w-3 h-3 ml-1" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasSearched && (
            <div className="text-center py-20 text-muted-foreground">
              <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Search messages, contacts, and topics</p>
              <p className="text-sm mt-2 opacity-70">Semantic search understands the meaning behind your query.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
