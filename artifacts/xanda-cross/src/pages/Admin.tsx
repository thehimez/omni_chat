import { useState, useEffect, useRef } from "react";
import { useAdminLogin, useAdminGetStats, useAdminGetUsers, useAdminActivateUser, getAdminGetUsersQueryKey, getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Users, Zap, Search, LogOut, Radio, Circle } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type WebhookEvent = {
  id: string;
  receivedAt: string;
  event: string;
  accountId: string | null;
  provider: string | null;
  summary: string;
  raw: unknown;
};

// ─── Webhook Event Log ────────────────────────────────────────────────────────

function eventBadgeVariant(event: string): string {
  if (event.startsWith("account_creation_success") || event === "account_connected" || event === "account_sync_success") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (event.startsWith("account_error") || event === "account_creation_fail" || event === "account_credentials") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (event === "new_message" || event === "message_received") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (event.startsWith("message_")) return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  if (event.startsWith("account_")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

function WebhookEventLog({ adminToken }: { adminToken: string }) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [lastCount, setLastCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/webhook-events", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json() as { events: WebhookEvent[] };
        setEvents(data.events);
        setLastCount(data.events.length);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchEvents();
    if (live) {
      intervalRef.current = setInterval(fetchEvents, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <CardTitle className="text-lg">Live Webhook Events</CardTitle>
          {live && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Circle className="w-2 h-2 fill-emerald-400" /> Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""} received</span>
          <Button
            size="sm"
            variant={live ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setLive((v) => !v)}
          >
            {live ? "Pause" : "Resume"} Live
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetchEvents}>
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {events.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <Radio className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="font-medium mb-1">Waiting for webhook events...</p>
            <p className="text-xs">Connect a platform in the Accounts page — events will appear here in real time.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((evt) => (
              <div key={evt.id} className="hover:bg-muted/30 transition-colors">
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
                >
                  <span className={`mt-0.5 shrink-0 text-[11px] font-mono px-2 py-0.5 rounded border ${eventBadgeVariant(evt.event)}`}>
                    {evt.event}
                  </span>
                  <span className="flex-1 text-sm text-left text-muted-foreground truncate">
                    {evt.summary}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground/60">
                    {format(new Date(evt.receivedAt), "HH:mm:ss")}
                  </span>
                </button>

                {expanded === evt.id && (
                  <div className="px-4 pb-3">
                    <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-48 text-muted-foreground">
                      {JSON.stringify(evt.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

// In dev/demo mode (no Clerk configured) skip the login gate entirely
const IS_DEV_MODE = import.meta.env.DEV && !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");

  if (IS_DEV_MODE) {
    return <AdminDashboard token="dev-token" onLogout={() => {}} />;
  }

  if (!token) {
    return <AdminLogin setToken={(t) => {
      localStorage.setItem("adminToken", t);
      setToken(t);
    }} />;
  }

  return <AdminDashboard token={token} onLogout={() => {
    localStorage.removeItem("adminToken");
    setToken("");
  }} />;
}

// ─── Login ────────────────────────────────────────────────────────────────────

function AdminLogin({ setToken }: { setToken: (t: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useAdminLogin();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (res) => setToken(res.token),
      onError: () => {
        toast({ title: "Login failed", description: "Invalid admin credentials", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center pb-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Xanda Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              Enter Command Center
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { data: stats } = useAdminGetStats();
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = useAdminGetUsers({ search: search || undefined });
  const activateMutation = useAdminActivateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleActivate = (id: string) => {
    activateMutation.mutate({ id, data: { status: "active" } }, {
      onSuccess: () => {
        toast({ title: "User activated" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-card">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <ShieldAlert className="w-5 h-5" />
          <span>Admin Console</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Total Users</p>
                  <p className="text-3xl font-bold">{stats.totalUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Active</p>
                  <p className="text-3xl font-bold text-primary">{stats.activeUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">MRR</p>
                  <p className="text-3xl font-bold">${stats.mrr}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Trial / Pending</p>
                  <p className="text-3xl font-bold">{stats.pendingUsers + stats.trialUsers}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Live webhook event log */}
          <WebhookEventLog adminToken={token} />

          {/* User table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="text-lg">User Management</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search email..."
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Accounts</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : usersData?.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "secondary"} className="capitalize">
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.connectedAccountCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.status !== "active" && (
                          <Button size="sm" variant="outline" onClick={() => handleActivate(user.id)} disabled={activateMutation.isPending}>
                            Activate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && (!usersData?.users || usersData.users.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
