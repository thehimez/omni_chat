import { useLocation } from "wouter";
import { Link } from "wouter";
import { ThemeProvider, useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { 
  LayoutDashboard, 
  Inbox, 
  Bot, 
  Search, 
  Users, 
  Link2, 
  Settings, 
  CreditCard,
  ShieldAlert,
  Moon,
  Sun,
  LogOut,
  Activity
} from "lucide-react";
import { useGetMe, useHealthCheck } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const navItems = [
  { href: "/", label: "Briefing", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/xan", label: "Xan AI", icon: Bot },
  { href: "/search", label: "Search", icon: Search },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/accounts", label: "Accounts", icon: Link2 },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/admin", label: "Admin", icon: ShieldAlert },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      title="Toggle theme"
      className="w-full justify-start px-2 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {theme === "light" ? <Moon className="h-5 w-5 mr-3 shrink-0" /> : <Sun className="h-5 w-5 mr-3 shrink-0" />}
      <span className="hidden md:inline">Theme</span>
    </Button>
  );
}

function UserProfile() {
  const { data: user, isLoading } = useGetMe();

  if (isLoading || !user || !user.email) return null;

  return (
    <div className="flex items-center gap-3 px-2 py-3 mt-4 border-t border-border">
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.avatarUrl || ''} />
        <AvatarFallback>{(user.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="hidden md:block flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.firstName ? `${user.firstName} ${user.lastName}` : user.email}</p>
        <p className="text-xs text-muted-foreground truncate">{user.status}</p>
      </div>
    </div>
  );
}

function SystemStatus() {
  const { data: health } = useHealthCheck();

  return (
    <div className="px-2 py-2 flex items-center gap-2 text-xs text-muted-foreground">
      <Activity className="h-3 w-3" />
      <span className="hidden md:inline">
        System: {health?.status === 'ok' ? <span className="text-primary">Online</span> : <span className="text-destructive">Degraded</span>}
      </span>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  if (isAdmin) {
    return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
  }

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <aside className="w-16 md:w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col justify-between transition-all duration-300">
          <div className="p-4 space-y-6">
            <div className="flex items-center space-x-2 px-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">X</div>
              <span className="hidden md:inline font-bold text-lg tracking-tight uppercase text-sidebar-foreground">XANDA</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className={`flex items-center px-2 py-2.5 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                    <Icon className="h-5 w-5 shrink-0 md:mr-3" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="p-4 flex flex-col gap-1 border-t border-border">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`flex items-center px-2 py-2 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                  <Icon className="h-5 w-5 shrink-0 md:mr-3" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
            <ThemeToggle />
            <SystemStatus />
            <UserProfile />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
