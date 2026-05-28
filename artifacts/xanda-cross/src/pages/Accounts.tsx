import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetConnectedAccounts,
  useConnectAccount,
  useDisconnectAccount,
  useTriggerSync,
  getGetConnectedAccountsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/platform-icon";
import { RefreshCw, Unlink, Link2, Plus, CheckCircle, AlertCircle, Play, Pause, Radio } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { useAppAuth } from "@/lib/auth";

const PLATFORMS = ['gmail', 'outlook', 'whatsapp', 'linkedin', 'slack', 'telegram', 'instagram'];
const LIVE_SYNC_INTERVAL_MS = 30_000; // 30 seconds
const STORAGE_KEY = "xanda_live_sync_paused"; // set of account IDs that are paused

function getPausedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function savePausedSet(s: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

export default function Accounts() {
  const { data, isLoading, refetch } = useGetConnectedAccounts();
  const connectMutation = useConnectAccount();
  const disconnectMutation = useDisconnectAccount();
  const syncMutation = useTriggerSync();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token } = useAppAuth();

  // Per-account live sync: paused set persisted in localStorage (default = live for all)
  const [pausedIds, setPausedIds] = useState<Set<string>>(getPausedSet);
  // Track which accounts are mid-sync cycle right now (for spinner)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  // Tick counter to show "last synced X ago" updating each second
  const [, setTick] = useState(0);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Update "X ago" display every 10 seconds
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const triggerSync = useCallback(
    async (accountId: string) => {
      setSyncingIds((prev) => new Set(prev).add(accountId));
      try {
        await fetch(`/api/accounts/${accountId}/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ depth: "incremental" }),
        });
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      } catch {
        // silent — background sync, don't toast
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      }
    },
    [token, queryClient],
  );

  // Manage per-account intervals whenever accounts list or pausedIds changes
  useEffect(() => {
    const accounts = data?.accounts ?? [];
    const currentIntervalIds = new Set(intervalsRef.current.keys());

    // Remove intervals for accounts that no longer exist or are now paused
    for (const id of currentIntervalIds) {
      if (!accounts.find((a) => a.id === id) || pausedIds.has(id)) {
        clearInterval(intervalsRef.current.get(id));
        intervalsRef.current.delete(id);
      }
    }

    // Add intervals for live accounts that don't have one yet
    for (const acc of accounts) {
      if (!pausedIds.has(acc.id) && !intervalsRef.current.has(acc.id)) {
        // Fire immediately on start, then every 30s
        triggerSync(acc.id);
        const interval = setInterval(() => triggerSync(acc.id), LIVE_SYNC_INTERVAL_MS);
        intervalsRef.current.set(acc.id, interval);
      }
    }

    return () => {
      // Cleanup on unmount
      for (const interval of intervalsRef.current.values()) clearInterval(interval);
      intervalsRef.current.clear();
    };
  }, [data?.accounts, pausedIds, triggerSync]);

  const toggleLiveSync = (accountId: string) => {
    setPausedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId); // resume → will trigger effect to create interval
      } else {
        next.add(accountId); // pause → effect will clear interval
      }
      savePausedSet(next);
      return next;
    });
  };

  const handleManualSync = (id: string) => {
    triggerSync(id);
    toast({ title: "Syncing now…", description: "Fetching latest messages." });
  };

  // ── Handle redirect-back from Unipile/Slack with ?connected=X&account_id=Y ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get("connected");
    const accountId = params.get("account_id");
    const hasError = params.get("error");

    if (hasError) {
      toast({ title: "Connection failed", description: "Something went wrong. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (connectedPlatform && accountId) {
      fetch("/api/accounts/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ platform: connectedPlatform, unipileAccountId: accountId }),
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
          toast({ title: `${connectedPlatform.charAt(0).toUpperCase() + connectedPlatform.slice(1)} connected!`, description: "Your account is now live and syncing." });
        })
        .catch(() => queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() }));
      window.history.replaceState({}, "", window.location.pathname);
    } else if (connectedPlatform) {
      queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      toast({ title: "Account connected!", description: "Your account is now syncing." });
      window.history.replaceState({}, "", window.location.pathname);
    }
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
          if (result.authUrl && popup && !popup.closed) {
            popup.location.href = result.authUrl;
          } else {
            popup?.close();
            toast({ title: "Connecting…", description: "Follow the instructions in the popup." });
          }
        },
        onError: () => {
          popup?.close();
          toast({ title: "Connection failed", description: "Could not start auth. Please try again.", variant: "destructive" });
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
  const connectedPlatformSet = new Set(data?.accounts?.map((a) => a.platform) ?? []);

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card justify-between">
        <h1 className="font-semibold">Connected Accounts</h1>
        {liveCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            {liveCount} account{liveCount > 1 ? "s" : ""} syncing live · every 30s
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Active connections */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Active Connections</h2>
            {isLoading ? (
              <div className="grid gap-4">
                {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : data?.accounts && data.accounts.length > 0 ? (
              <div className="grid gap-4">
                {data.accounts.map((acc) => {
                  const isLive = !pausedIds.has(acc.id);
                  const isSyncing = syncingIds.has(acc.id) || acc.status === "syncing";

                  return (
                    <Card key={acc.id} className="overflow-hidden">
                      {/* Top progress bar */}
                      <div className={`h-0.5 w-full transition-colors ${
                        isSyncing
                          ? "bg-primary animate-pulse"
                          : isLive
                          ? "bg-emerald-500/40"
                          : acc.status === "error"
                          ? "bg-destructive"
                          : "bg-primary/10"
                      }`} />

                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        {/* Left: icon + info */}
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center shrink-0">
                            <PlatformIcon platform={acc.platform} className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{acc.displayName}</h3>
                              {/* Live / Paused badge */}
                              {isLive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                  </span>
                                  Live
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                  <Pause className="w-2 h-2" />
                                  Paused
                                </span>
                              )}
                              {/* Error badge */}
                              {acc.status === "error" && (
                                <Badge variant="destructive" className="text-[10px]">
                                  <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                  Error
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isSyncing
                                ? "Syncing…"
                                : acc.lastSyncAt
                                ? `Last synced ${formatDistanceToNow(new Date(acc.lastSyncAt), { addSuffix: true })}`
                                : "Never synced"}
                            </p>
                          </div>
                        </div>

                        {/* Right: controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Play/Pause toggle */}
                          <Button
                            variant={isLive ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleLiveSync(acc.id)}
                            className={isLive
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1.5"
                              : "gap-1.5"
                            }
                            title={isLive ? "Pause live sync" : "Resume live sync"}
                          >
                            {isLive
                              ? <><Pause className="w-3.5 h-3.5" /> Pause</>
                              : <><Play className="w-3.5 h-3.5" /> Resume</>
                            }
                          </Button>

                          {/* Manual sync */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManualSync(acc.id)}
                            disabled={isSyncing}
                            title="Sync now"
                            className="h-8 w-8"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                          </Button>

                          {/* Disconnect */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                            onClick={() => handleDisconnect(acc.id)}
                            disabled={disconnectMutation.isPending}
                            title="Disconnect"
                          >
                            <Unlink className="w-4 h-4" />
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
                  <Link2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium mb-1">No accounts connected yet</p>
                  <p className="text-sm">Click Connect on any platform below to get started.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Available platforms */}
          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-xl font-semibold tracking-tight">Available Platforms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {PLATFORMS.filter((p) => !connectedPlatformSet.has(p)).map((platform) => (
                <Card key={platform} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <PlatformIcon platform={platform} className="w-10 h-10" />
                    <h3 className="font-semibold capitalize">{platform.replace("_", " ")}</h3>
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
              {PLATFORMS.every((p) => connectedPlatformSet.has(p)) && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                  All platforms connected!
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
