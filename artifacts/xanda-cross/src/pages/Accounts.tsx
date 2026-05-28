import { useState, useEffect } from "react";
import {
  useGetConnectedAccounts,
  useConnectAccount,
  useDisconnectAccount,
  getGetConnectedAccountsQueryKey,
  getAuthToken,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/platform-icon";
import { RefreshCw, Unlink, Link2, Plus, AlertCircle, Play, Pause } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAppAuth } from "@/lib/auth";

const PLATFORMS = ["gmail", "outlook", "whatsapp", "linkedin", "slack", "telegram", "instagram"];
const LIVE_SYNC_INTERVAL_MS = 30_000;
const ACCOUNTS_REFRESH_MS = 60_000;
const STORAGE_KEY = "xanda_live_sync_paused_v3";

// ── Module-level live state ───────────────────────────────────────────────────
// Avoids useRef so HMR can't corrupt values across hot reloads.
// Updated synchronously on every render so the interval closure always reads fresh data.
const _live = {
  accounts: [] as Array<{ id: string; platform: string }>,
  paused: new Set<string>(),
  syncingIds: new Set<string>(),
};

function getPaused(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}
function savePaused(s: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

async function doSync(accountId: string): Promise<void> {
  try {
    const token = await getAuthToken();
    await fetch(`/api/accounts/${accountId}/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ depth: "incremental" }),
    });
  } catch {
    // silent — background sync
  }
}

export default function Accounts() {
  const { data, isLoading, refetch } = useGetConnectedAccounts();
  const connectMutation = useConnectAccount();
  const disconnectMutation = useDisconnectAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { signOut } = useAppAuth();

  const [pausedIds, setPausedIds] = useState<Set<string>>(getPaused);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set<string>());
  const [, setTick] = useState(0);

  // Keep module-level live state in sync on every render (no useRef needed)
  _live.accounts = (data?.accounts ?? []) as Array<{ id: string; platform: string }>;
  _live.paused = pausedIds;
  _live.syncingIds = syncingIds;

  // ── Single stable interval — created once on mount, never recreated ──────────
  useEffect(() => {
    const triggerAll = () => {
      for (const acc of _live.accounts) {
        if (_live.paused.has(acc.id)) continue;
        if (_live.syncingIds.has(acc.id)) continue; // already in flight
        setSyncingIds((prev) => new Set(prev).add(acc.id));
        doSync(acc.id).finally(() => {
          setSyncingIds((prev) => {
            const next = new Set(prev);
            next.delete(acc.id);
            return next;
          });
        });
      }
    };

    // First fire after 1.5s so accounts data can load
    const boot = setTimeout(triggerAll, 1500);
    const syncTimer = setInterval(triggerAll, LIVE_SYNC_INTERVAL_MS);

    // Slow refresh: just re-fetches account list to update "last synced X ago"
    const refreshTimer = setInterval(() => refetch(), ACCOUNTS_REFRESH_MS);

    // Tick for time-ago display
    const tickTimer = setInterval(() => setTick((n) => n + 1), 15_000);

    return () => {
      clearTimeout(boot);
      clearInterval(syncTimer);
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — reads live state via _live object

  const toggleLive = (id: string) => {
    setPausedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Immediate sync on resume
        setSyncingIds((s) => new Set(s).add(id));
        doSync(id).finally(() =>
          setSyncingIds((s) => { const n = new Set(s); n.delete(id); return n; })
        );
      } else {
        next.add(id);
      }
      savePaused(next);
      return next;
    });
  };

  const manualSync = (id: string) => {
    if (syncingIds.has(id)) return;
    setSyncingIds((s) => new Set(s).add(id));
    doSync(id).then(() => toast({ title: "Synced", description: "Latest messages fetched." }))
      .finally(() =>
        setSyncingIds((s) => { const n = new Set(s); n.delete(id); return n; })
      );
  };

  // ── Handle OAuth redirect-back ───────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("connected");
    const accountId = params.get("account_id");
    const hasError = params.get("error");
    if (hasError) {
      toast({ title: "Connection failed", description: "Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (platform && accountId) {
      getAuthToken().then((tok) =>
      fetch("/api/accounts/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ platform, unipileAccountId: accountId }),
      }))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
          toast({ title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected!`, description: "Syncing your messages now." });
        })
        .catch(() => queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() }));
      window.history.replaceState({}, "", window.location.pathname);
    } else if (platform) {
      queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      toast({ title: "Account connected!", description: "Your account is now syncing." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = (platform: string) => {
    const popup = window.open("", "_blank", "width=620,height=800,scrollbars=yes,resizable=yes");
    if (popup) {
      popup.document.write(
        `<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">
          <div style="width:40px;height:40px;border:3px solid #6366f1;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          <p style="margin:0;font-size:15px">Connecting ${platform}…</p>
        </body></html>`
      );
    }
    connectMutation.mutate(
      { data: { platform, authType: "oauth", redirectBase: window.location.origin } },
      {
        onSuccess: (result) => {
          if (result.authUrl && popup && !popup.closed) popup.location.href = result.authUrl;
          else popup?.close();
        },
        onError: () => {
          popup?.close();
          toast({ title: "Connection failed", description: "Could not start auth.", variant: "destructive" });
        },
      }
    );
  };

  const handleDisconnect = (id: string) => {
    disconnectMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Account disconnected" });
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      },
    });
  };

  const liveCount = (data?.accounts ?? []).filter((a) => !pausedIds.has(a.id)).length;
  const connectedPlatforms = new Set(data?.accounts?.map((a) => a.platform) ?? []);

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card justify-between">
        <h1 className="font-semibold">Connected Accounts</h1>
        {liveCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            {liveCount} account{liveCount !== 1 ? "s" : ""} syncing live · every 30s
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Active Connections</h2>

            {isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : data?.accounts && data.accounts.length > 0 ? (
              <div className="grid gap-3">
                {data.accounts.map((acc) => {
                  const isLive = !pausedIds.has(acc.id);
                  const isSyncing = syncingIds.has(acc.id);

                  return (
                    <Card key={acc.id} className="overflow-hidden">
                      <div className={`h-0.5 w-full transition-all ${
                        isSyncing ? "bg-primary animate-pulse"
                          : isLive ? "bg-emerald-500/30"
                          : acc.status === "error" ? "bg-destructive/50"
                          : "bg-border"
                      }`} />
                      <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                        {/* Left */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                            <PlatformIcon platform={acc.platform} className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{acc.displayName}</span>
                              {isLive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                  </span>
                                  Live
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                  <Pause className="w-2 h-2" /> Paused
                                </span>
                              )}
                              {acc.status === "error" && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                                  <AlertCircle className="w-2.5 h-2.5 mr-1" /> Error
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isSyncing
                                ? "Syncing…"
                                : acc.lastSyncAt
                                ? `Last synced ${formatDistanceToNow(new Date(acc.lastSyncAt), { addSuffix: true })}`
                                : "Never synced"}
                            </p>
                          </div>
                        </div>

                        {/* Right: controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant={isLive ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleLive(acc.id)}
                            className={`gap-1.5 h-8 text-xs px-3 ${isLive ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0" : ""}`}
                          >
                            {isLive
                              ? <><Pause className="w-3 h-3" /> Pause</>
                              : <><Play className="w-3 h-3" /> Resume</>}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => manualSync(acc.id)}
                            disabled={isSyncing}
                            title="Sync now"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDisconnect(acc.id)}
                            disabled={disconnectMutation.isPending}
                            title="Disconnect"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed bg-accent/30">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Link2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium mb-1">No accounts connected yet</p>
                  <p className="text-sm">Connect a platform below to get started.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-xl font-semibold tracking-tight">Available Platforms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {PLATFORMS.filter((p) => !connectedPlatforms.has(p)).map((platform) => (
                <Card key={platform} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                    <PlatformIcon platform={platform} className="w-9 h-9" />
                    <h3 className="font-semibold text-sm capitalize">{platform.replace("_", " ")}</h3>
                    <Button
                      variant="secondary" size="sm" className="w-full"
                      disabled={connectMutation.isPending}
                      onClick={() => handleConnect(platform)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Connect
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {PLATFORMS.every((p) => connectedPlatforms.has(p)) && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-4">All platforms connected!</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
