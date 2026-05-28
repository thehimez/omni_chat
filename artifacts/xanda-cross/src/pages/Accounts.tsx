import { useState, useEffect } from "react";
import {
  useGetConnectedAccounts,
  useConnectAccount,
  useDisconnectAccount,
  getGetConnectedAccountsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon, getPlatformLabel } from "@/components/platform-icon";
import { RefreshCw, Unlink, Plus, AlertCircle, Play, Pause, Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const PLATFORMS = ["gmail", "outlook", "whatsapp", "linkedin", "telegram", "instagram"];
const LIVE_SYNC_INTERVAL_MS = 30_000;
const ACCOUNTS_REFRESH_MS = 60_000;
const STORAGE_KEY = "xanda_live_sync_paused_v3";

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
    await fetch(`/api/accounts/${accountId}/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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

  const [pausedIds, setPausedIds] = useState<Set<string>>(getPaused);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set<string>());
  const [, setTick] = useState(0);

  _live.accounts = (data?.accounts ?? []) as Array<{ id: string; platform: string }>;
  _live.paused = pausedIds;
  _live.syncingIds = syncingIds;

  useEffect(() => {
    const triggerAll = () => {
      for (const acc of _live.accounts) {
        if (_live.paused.has(acc.id)) continue;
        if (_live.syncingIds.has(acc.id)) continue;
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
    const boot = setTimeout(triggerAll, 1500);
    const syncTimer = setInterval(triggerAll, LIVE_SYNC_INTERVAL_MS);
    const refreshTimer = setInterval(() => refetch(), ACCOUNTS_REFRESH_MS);
    const tickTimer = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => {
      clearTimeout(boot);
      clearInterval(syncTimer);
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLive = (id: string) => {
    setPausedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSyncingIds((s) => new Set(s).add(id));
        doSync(id).finally(() =>
          setSyncingIds((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          }),
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
    doSync(id)
      .then(() => toast({ title: "Synced", description: "Latest messages fetched." }))
      .finally(() =>
        setSyncingIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
      );
  };

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
      fetch("/api/accounts/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, unipileAccountId: accountId }),
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
          toast({
            title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected!`,
            description: "Syncing your messages now.",
          });
        })
        .catch(() =>
          queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() }),
        );
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
        `<html><body style="background:#F5F8FB;color:#1D1D1F;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">
          <div style="width:40px;height:40px;border:3px solid #6366f1;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          <p style="margin:0;font-size:15px;color:#6E6E73">Connecting ${platform}…</p>
        </body></html>`,
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
      },
    );
  };

  const handleDisconnect = (id: string) => {
    disconnectMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Account disconnected" });
          queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
        },
      },
    );
  };

  const liveCount = (data?.accounts ?? []).filter((a) => !pausedIds.has(a.id)).length;
  const connectedPlatforms = new Set(data?.accounts?.map((a) => a.platform) ?? []);

  const stagger = {
    container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
    item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } },
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-3xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div variants={stagger.item} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connected Accounts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your messaging integrations</p>
          </div>
          {liveCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-full border border-emerald-200/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {liveCount} live · every 30s
            </div>
          )}
        </motion.div>

        {/* Active connections */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-3xl" />
            ))}
          </div>
        ) : data?.accounts && data.accounts.length > 0 ? (
          <motion.div variants={stagger.item} className="space-y-3">
            {data.accounts.map((acc) => {
              const isLive = !pausedIds.has(acc.id);
              const isSyncing = syncingIds.has(acc.id);

              return (
                <motion.div
                  key={acc.id}
                  whileHover={{ y: -1 }}
                  className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/70 shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-hidden"
                >
                  <div
                    className={`h-0.5 w-full transition-all ${
                      isSyncing
                        ? "bg-indigo-400 animate-pulse"
                        : isLive
                          ? "bg-emerald-400/50"
                          : acc.status === "error"
                            ? "bg-red-400/50"
                            : "bg-gray-100"
                    }`}
                  />
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50/80 flex items-center justify-center shrink-0 border border-gray-100">
                        <PlatformIcon platform={acc.platform} className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">
                            {acc.displayName}
                          </span>
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200/60">
                              <Pause className="w-2 h-2" /> Paused
                            </span>
                          )}
                          {acc.status === "error" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200/60">
                              <AlertCircle className="w-2.5 h-2.5" /> Error
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {isSyncing
                            ? "Syncing…"
                            : acc.lastSyncAt
                              ? `Last synced ${formatDistanceToNow(new Date(acc.lastSyncAt), { addSuffix: true })}`
                              : "Never synced"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleLive(acc.id)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${
                          isLive
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/60"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200/60"
                        }`}
                      >
                        {isLive ? (
                          <><Pause className="w-3 h-3" /> Pause</>
                        ) : (
                          <><Play className="w-3 h-3" /> Resume</>
                        )}
                      </button>
                      <button
                        onClick={() => manualSync(acc.id)}
                        disabled={isSyncing}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors border border-gray-200/60"
                        title="Sync now"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={() => handleDisconnect(acc.id)}
                        disabled={disconnectMutation.isPending}
                        className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-500 transition-colors border border-red-200/60"
                        title="Disconnect"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            variants={stagger.item}
            className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/70 border-dashed p-10 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Link2 className="w-6 h-6 text-gray-300" />
            </div>
            <p className="font-medium text-gray-500 text-sm mb-1">No accounts connected yet</p>
            <p className="text-xs text-gray-400">Connect a platform below to get started.</p>
          </motion.div>
        )}

        {/* Available platforms */}
        {PLATFORMS.some((p) => !connectedPlatforms.has(p)) && (
          <motion.div variants={stagger.item} className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">
              Available Platforms
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {PLATFORMS.filter((p) => !connectedPlatforms.has(p)).map((platform) => (
                <motion.div
                  key={platform}
                  whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.1)" }}
                  className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/70 shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-6 flex flex-col items-center gap-3 cursor-pointer transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-50/80 flex items-center justify-center border border-gray-100/80">
                    <PlatformIcon platform={platform} className="w-9 h-9" />
                  </div>
                  <span className="font-semibold text-gray-800 text-sm">
                    {getPlatformLabel(platform)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleConnect(platform)}
                    disabled={connectMutation.isPending}
                    className="w-full rounded-xl text-xs gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 border-0 text-white hover:from-indigo-600 hover:to-violet-700 shadow-sm"
                  >
                    <Plus className="w-3 h-3" /> Connect
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
