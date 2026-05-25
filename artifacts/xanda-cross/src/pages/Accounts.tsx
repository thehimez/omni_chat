import { 
  useGetConnectedAccounts, 
  useConnectAccount, 
  useDisconnectAccount, 
  useTriggerSync,
  getGetConnectedAccountsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/platform-icon";
import { RefreshCw, Unlink, Link2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const PLATFORMS = ['gmail', 'outlook', 'whatsapp', 'linkedin', 'slack', 'telegram', 'instagram'];

export default function Accounts() {
  const { data, isLoading } = useGetConnectedAccounts();
  const connectMutation = useConnectAccount();
  const disconnectMutation = useDisconnectAccount();
  const syncMutation = useTriggerSync();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleConnect = (platform: string) => {
    // Open the popup synchronously inside the click handler — browsers block
    // window.open() calls that happen inside async callbacks (onSuccess etc.)
    const popup = window.open('', '_blank', 'width=620,height=800,scrollbars=yes,resizable=yes');
    if (popup) {
      popup.document.write('<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Connecting to ' + platform + '…</p></body></html>');
    }

    connectMutation.mutate({
      data: { platform, authType: 'oauth' }
    }, {
      onSuccess: (result) => {
        if (result.authUrl && popup && !popup.closed) {
          popup.location.href = result.authUrl;
        } else if (!result.authUrl) {
          popup?.close();
          toast({ title: "Connecting account…", description: "Please follow the instructions." });
        }
      },
      onError: () => {
        popup?.close();
        toast({ title: "Connection failed", description: "Could not start the auth flow. Please try again.", variant: "destructive" });
      }
    });
  };

  const handleDisconnect = (id: string) => {
    disconnectMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Account disconnected" });
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      }
    });
  };

  const handleSync = (id: string) => {
    syncMutation.mutate({
      id,
      data: { depth: 'full' }
    }, {
      onSuccess: () => {
        toast({ title: "Sync triggered", description: "Your account is syncing in the background." });
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
        <h1 className="font-semibold">Connected Accounts</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Active Connections</h2>
            {isLoading ? (
              <div className="grid gap-4">
                {[1,2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : data?.accounts && data.accounts.length > 0 ? (
              <div className="grid gap-4">
                {data.accounts.map((acc) => (
                  <Card key={acc.id} className="overflow-hidden">
                    <div className={`h-1 w-full ${acc.status === 'syncing' ? 'bg-primary animate-pulse' : acc.status === 'error' ? 'bg-destructive' : 'bg-primary/20'}`} />
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <PlatformIcon platform={acc.platform} className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{acc.displayName}</h3>
                            <Badge variant={acc.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
                              {acc.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {acc.lastSyncAt ? `Last synced: ${format(new Date(acc.lastSyncAt), 'MMM d, h:mm a')}` : 'Never synced'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleSync(acc.id)}
                          disabled={syncMutation.isPending || acc.status === 'syncing'}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${acc.status === 'syncing' ? 'animate-spin' : ''}`} />
                          Sync
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDisconnect(acc.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          <Unlink className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed bg-accent/30">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Link2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No accounts connected yet.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-xl font-semibold tracking-tight">Available Platforms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {PLATFORMS.filter(p => !data?.accounts?.some(a => a.platform === p)).map(platform => (
                <Card key={platform} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <PlatformIcon platform={platform} className="w-10 h-10" />
                    <h3 className="font-semibold capitalize">{platform.replace('_', ' ')}</h3>
                    <Button 
                      variant="secondary" 
                      className="w-full mt-2" 
                      onClick={() => handleConnect(platform)}
                      disabled={connectMutation.isPending}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
