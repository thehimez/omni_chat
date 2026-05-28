import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Inbox,
  Bot,
  Search,
  Users,
  Link2,
  Settings,
} from "lucide-react";
import { useGetConnectedAccounts } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { useRealtime } from "@/hooks/use-realtime";
import { PlatformFilterProvider, usePlatformFilter } from "@/lib/platform-filter-context";
import { PlatformIcon, getPlatformLabel } from "@/components/platform-icon";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { SettingsModal } from "./settings-modal";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function RealtimeSync() {
  useRealtime();
  return null;
}

const NAV_ITEMS = [
  { href: "/briefing", icon: LayoutDashboard, label: "Briefing" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/xan", icon: Bot, label: "Xan AI" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/accounts", icon: Link2, label: "Accounts" },
];

function SidebarDock() {
  const [location, navigate] = useLocation();
  const { activePlatform, setActivePlatform } = usePlatformFilter();
  const { data: accountsData } = useGetConnectedAccounts();
  const { data: me } = useGetMe();
  const [settingsOpen, setSettingsOpen] = useState(false);

  type AccountEntry = { id: string; platform: string; status: string; displayName: string };
  const connectedAccounts: AccountEntry[] =
    ((accountsData?.accounts ?? []) as AccountEntry[]).filter(
      (a) => a.status === "connected" || a.status === "syncing",
    );

  const uniquePlatforms: AccountEntry[] = Array.from(
    new Map(connectedAccounts.map((a) => [a.platform, a] as [string, AccountEntry])).values(),
  );

  const displayName = me?.firstName
    ? `${me.firstName} ${me.lastName ?? ""}`.trim()
    : me?.email ?? "User";

  const isInbox = location.startsWith("/inbox");

  const handlePlatformClick = (platform: string) => {
    if (!isInbox) navigate("/inbox");
    setActivePlatform(activePlatform === platform ? null : platform);
  };

  const handleInboxAllClick = () => {
    if (!isInbox) navigate("/inbox");
    setActivePlatform(null);
  };

  return (
    <>
      <aside className="w-[72px] h-screen flex flex-col items-center py-4 gap-2 bg-white/70 backdrop-blur-xl border-r border-white/60 shadow-[1px_0_20px_rgba(0,0,0,0.04)] shrink-0 z-10">
        {/* Logo */}
        <Link href="/inbox">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md cursor-pointer mb-3"
          >
            X
          </motion.div>
        </Link>

        {/* Unified inbox */}
        <SidebarIcon
          label="Unified Inbox"
          active={isInbox && activePlatform === null}
          onClick={handleInboxAllClick}
        >
          <Inbox className="w-5 h-5" />
        </SidebarIcon>

        {/* Connected platform icons */}
        {uniquePlatforms.map((acc) => (
          <SidebarIcon
            key={acc.platform}
            label={getPlatformLabel(acc.platform)}
            active={isInbox && activePlatform === acc.platform}
            onClick={() => handlePlatformClick(acc.platform)}
          >
            <PlatformIcon platform={acc.platform} className="w-6 h-6" />
          </SidebarIcon>
        ))}

        {/* Divider */}
        <div className="w-8 h-px bg-gray-200/80 my-1" />

        {/* Nav items */}
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            location === href || (href !== "/" && location.startsWith(href));
          return (
            <SidebarIcon key={href} label={label} active={active} onClick={() => navigate(href)}>
              <Icon className="w-5 h-5" />
            </SidebarIcon>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* User avatar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-gray-200 hover:ring-blue-300 transition-all"
            >
              <Avatar className="w-full h-full">
                <AvatarImage src={me?.avatarUrl || ""} />
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="right" className="rounded-xl text-xs">
            {displayName}
          </TooltipContent>
        </Tooltip>

        {/* Settings */}
        <SidebarIcon label="Settings" active={false} onClick={() => setSettingsOpen(true)}>
          <Settings className="w-5 h-5" />
        </SidebarIcon>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function SidebarIcon({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onClick}
          className={`
            relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200
            ${active
              ? "bg-blue-50 text-blue-600 shadow-[0_2px_12px_rgba(99,102,241,0.18)]"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-50/80"
            }
          `}
        >
          {active && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-2xl bg-blue-50 ring-1 ring-blue-200/60"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{children}</span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="right" className="rounded-xl text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  if (isAdmin) {
    return <div className="h-screen bg-gray-950 text-white">{children}</div>;
  }

  return (
    <PlatformFilterProvider>
      <RealtimeSync />
      <div
        className="flex h-screen overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #EEF5FF 0%, #F5F8FB 40%, #EFF3FA 100%)",
        }}
      >
        <SidebarDock />
        <main className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </PlatformFilterProvider>
  );
}
