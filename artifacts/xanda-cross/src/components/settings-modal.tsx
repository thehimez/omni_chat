import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGetMe } from "@workspace/api-client-react";
import { useAppAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  User,
  CreditCard,
  ShieldAlert,
  LogOut,
  Bell,
  ChevronRight,
} from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { data: user } = useGetMe();
  const { signOut } = useAppAuth();
  const [section, setSection] = useState<"menu" | "profile" | "notifications">("menu");

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.email ?? "User";
  const isAdmin = (user as any)?.role === "admin";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSection("menu"); } }}>
      <DialogContent className="max-w-sm rounded-3xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-base font-semibold text-gray-900">Settings</DialogTitle>
        </DialogHeader>

        {section === "menu" && (
          <div className="py-3">
            {/* User profile row */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-3 mb-1">
                <Avatar className="h-10 w-10 shrink-0 ring-2 ring-blue-100">
                  <AvatarImage src={user.avatarUrl || ""} />
                  <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            )}

            <div className="h-px bg-gray-100 mx-5 my-2" />

            <MenuItem icon={<User className="w-4 h-4 text-blue-500" />} label="Profile" onClick={() => setSection("profile")} />
            <MenuItem icon={<Bell className="w-4 h-4 text-purple-500" />} label="Notifications" onClick={() => setSection("notifications")} />

            <div className="h-px bg-gray-100 mx-5 my-2" />

            <Link href="/billing" onClick={onClose}>
              <MenuItem icon={<CreditCard className="w-4 h-4 text-green-500" />} label="Billing & Plan" />
            </Link>

            {isAdmin && (
              <Link href="/admin" onClick={onClose}>
                <MenuItem icon={<ShieldAlert className="w-4 h-4 text-orange-500" />} label="Admin Console" />
              </Link>
            )}

            <div className="h-px bg-gray-100 mx-5 my-2" />

            <button
              onClick={() => { signOut(); onClose(); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign Out
            </button>
          </div>
        )}

        {section === "profile" && (
          <div className="py-3">
            <button
              onClick={() => setSection("menu")}
              className="flex items-center gap-2 px-5 py-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              ← Back
            </button>
            <div className="px-5 space-y-4 pb-4">
              {user && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Avatar className="h-16 w-16 ring-4 ring-blue-100">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback className="bg-blue-50 text-blue-600 text-xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{displayName}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {section === "notifications" && (
          <div className="py-3">
            <button
              onClick={() => setSection("menu")}
              className="flex items-center gap-2 px-5 py-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              ← Back
            </button>
            <div className="px-5 pb-4 space-y-3">
              <NotifRow label="Priority alerts" />
              <NotifRow label="Daily digest" />
              <NotifRow label="Trial reminders" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}

function NotifRow({ label }: { label: string }) {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        onClick={() => setOn((v) => !v)}
        className={`w-10 h-6 rounded-full transition-colors relative ${on ? "bg-blue-500" : "bg-gray-200"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
