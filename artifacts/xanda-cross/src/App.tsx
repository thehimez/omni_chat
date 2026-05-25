import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function AppRoutes() {
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

function DevBanner() {
  return (
    <div
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
      className="bg-amber-500 text-black text-xs text-center py-1.5 font-semibold tracking-wide"
    >
      DEV MODE — Clerk not configured. Signed in as demo@xandacross.com
    </div>
  );
}

function App({ devMode }: { devMode: boolean }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
        {devMode && <DevBanner />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
