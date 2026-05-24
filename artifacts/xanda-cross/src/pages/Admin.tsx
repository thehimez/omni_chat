import { useState, useEffect } from "react";
import { useAdminLogin, useAdminGetStats, useAdminGetUsers, useAdminActivateUser, getAdminGetUsersQueryKey, getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Users, Zap, Search, LogOut } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");

  if (!token) {
    return <AdminLogin setToken={(t) => {
      localStorage.setItem("adminToken", t);
      setToken(t);
    }} />;
  }

  return <AdminDashboard onLogout={() => {
    localStorage.removeItem("adminToken");
    setToken("");
  }} />;
}

function AdminLogin({ setToken }: { setToken: (t: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useAdminLogin();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (res) => {
        setToken(res.token);
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid admin credentials", variant: "destructive" });
      }
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
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="Admin Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              Enter Command Center
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { data: stats } = useAdminGetStats();
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = useAdminGetUsers({ search: search || undefined });
  const activateMutation = useAdminActivateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleActivate = (id: string) => {
    activateMutation.mutate({ id, data: { status: 'active' } }, {
      onSuccess: () => {
        toast({ title: "User activated" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
      }
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
        <div className="max-w-6xl mx-auto space-y-8">
          
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Total Users</p>
                      <p className="text-3xl font-bold">{stats.totalUsers}</p>
                    </div>
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Active</p>
                      <p className="text-3xl font-bold text-primary">{stats.activeUsers}</p>
                    </div>
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">MRR</p>
                      <p className="text-3xl font-bold">${stats.mrr}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Pending/Trial</p>
                      <p className="text-3xl font-bold">{stats.pendingUsers + stats.trialUsers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : usersData?.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.connectedAccountCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.status !== 'active' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleActivate(user.id)}
                            disabled={activateMutation.isPending}
                          >
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
