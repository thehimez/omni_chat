import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignIn, useAuth } from "@clerk/clerk-react";
import Layout from "@/components/layout";
import Briefing from "@/pages/Briefing";
import Inbox from "@/pages/Inbox";
import XanChat from "@/pages/XanChat";
import Search from "@/pages/Search";
import Contacts from "@/pages/Contacts";
import ContactProfile from "@/pages/ContactProfile";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Briefing} />
        <Route path="/inbox" component={Inbox} />
        <Route path="/xan" component={XanChat} />
        <Route path="/search" component={Search} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contacts/:id" component={ContactProfile} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/settings" component={Settings} />
        <Route path="/billing" component={Billing} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">X</div>
            <span className="font-bold text-2xl tracking-tight uppercase">XANDA</span>
          </div>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
