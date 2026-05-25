import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUnipileStatus, fetchWebhookEvents, createEventStream } from "@/lib/api";
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Wifi, WifiOff,
  MessageSquare, Activity, BookOpen, Zap, ExternalLink, Copy, Check,
  Clock, Globe, Users, Radio
} from "lucide-react";

type TabId = "status" | "events" | "guide";

const PLATFORMS = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "📧",
    color: "bg-red-500",
    provider: "GOOGLE",
    authType: "oauth",
    steps: [
      "Click **Connect Gmail** on the Accounts page of the app.",
      "You'll be redirected to a Unipile hosted auth page — click **Google / Gmail**.",
      "Sign in with your Google account and grant the requested permissions.",
      "You'll be redirected back to the app with `?connected=gmail` in the URL.",
      "The app automatically syncs your last 40 emails. New emails arrive via webhook in real-time.",
    ],
    notes: "Requires Google OAuth consent. Works with both personal Gmail and Google Workspace.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    color: "bg-green-500",
    provider: "WHATSAPP",
    authType: "qr",
    steps: [
      "Click **Connect WhatsApp** on the Accounts page.",
      "Unipile will show a **QR code** on the hosted auth page.",
      "Open WhatsApp on your phone → Settings → Linked Devices → Link a Device.",
      "Scan the QR code with your phone camera.",
      "Wait for the green checkmark — the connection is confirmed.",
      "New WhatsApp messages start arriving via webhook immediately.",
    ],
    notes: "Uses WhatsApp Web protocol. Keep your phone connected to the internet.",
  },
  {
    id: "outlook",
    name: "Outlook",
    icon: "📮",
    color: "bg-blue-600",
    provider: "OUTLOOK",
    authType: "oauth",
    steps: [
      "Click **Connect Outlook** on the Accounts page.",
      "You'll be redirected to Microsoft's login page — sign in with your Microsoft account.",
      "Grant the requested permissions (read/send mail).",
      "You'll be redirected back to the app with `?connected=outlook`.",
      "The app syncs your last 40 emails automatically.",
    ],
    notes: "Works with Outlook.com, Hotmail, and Microsoft 365 / Exchange accounts.",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "bg-pink-500",
    provider: "INSTAGRAM",
    authType: "credentials",
    steps: [
      "Click **Connect Instagram** on the Accounts page.",
      "On the Unipile hosted auth page, enter your **Instagram username and password**.",
      "Complete any 2FA or security challenge Instagram sends.",
      "The connection is confirmed — Instagram DMs now route through the app.",
    ],
    notes: "Uses Instagram's private API. Use the account you want to monitor for DMs.",
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    color: "bg-sky-500",
    provider: "TELEGRAM",
    authType: "phone",
    steps: [
      "Click **Connect Telegram** on the Accounts page.",
      "On the Unipile hosted auth page, enter your **phone number** in international format (e.g. +447700900000).",
      "Telegram sends a login code to your Telegram app — enter it on the auth page.",
      "If you have 2FA enabled, enter your Telegram password.",
      "Connection confirmed — all Telegram chats are now accessible.",
    ],
    notes: "Uses Telegram's official MTProto API. Requires access to your Telegram app to receive the login code.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "bg-blue-700",
    provider: "LINKEDIN",
    authType: "credentials",
    steps: [
      "Click **Connect LinkedIn** on the Accounts page.",
      "On the Unipile hosted auth page, enter your **LinkedIn email and password**.",
      "Complete any LinkedIn security verification if prompted.",
      "The connection is confirmed — LinkedIn messages are now synced.",
    ],
    notes: "Uses LinkedIn's private messaging API. Works with personal and Sales Navigator accounts.",
  },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "ok" || status === "connected" || status === "CONNECTED")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Connected
      </span>
    );
  if (status === "error" || status === "ERROR")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Error
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" /> {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatusTab() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["unipile-status"],
    queryFn: fetchUnipileStatus,
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      {/* API Connection Banner */}
      <div className={`rounded-xl border p-5 flex items-start gap-4 ${
        isLoading ? "border-slate-200 bg-slate-50" :
        isError || !data?.ok ? "border-red-200 bg-red-50" :
        "border-emerald-200 bg-emerald-50"
      }`}>
        <div className={`mt-0.5 rounded-full p-2 ${
          isLoading ? "bg-slate-200" :
          isError || !data?.ok ? "bg-red-100" :
          "bg-emerald-100"
        }`}>
          {isLoading ? (
            <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
          ) : isError || !data?.ok ? (
            <WifiOff className="w-5 h-5 text-red-600" />
          ) : (
            <Wifi className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold text-base ${
              isLoading ? "text-slate-700" :
              isError || !data?.ok ? "text-red-800" :
              "text-emerald-800"
            }`}>
              {isLoading ? "Checking Unipile API…" :
               isError ? "API Unreachable" :
               !data?.ok ? "API Error" :
               "Unipile API — Live & Connected"}
            </h3>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          {!isLoading && data && (
            <div className="mt-2 space-y-1.5 text-sm">
              {data.ok && (
                <p className="text-emerald-700">
                  {data.accountCount} account{data.accountCount !== 1 ? "s" : ""} connected
                  {data.accountCount > 0 ? " and visible to the API" : " — ready to connect platforms"}
                </p>
              )}
              {!data.ok && data.error && (
                <p className="text-red-700">{data.error}</p>
              )}
              <div className="flex items-center gap-1 text-slate-500">
                <Globe className="w-3.5 h-3.5" />
                <span className="font-mono text-xs">{data.host}</span>
                <CopyButton text={data.host} />
              </div>
            </div>
          )}
          {isError && (
            <p className="mt-1 text-sm text-red-700">
              {(error as Error)?.message ?? "Could not reach the API server. Make sure the server is running."}
            </p>
          )}
        </div>
      </div>

      {/* Webhook URL */}
      {data?.webhookUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-slate-800">Webhook Endpoint</h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              Registered in Unipile
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 break-all">
            <span className="flex-1">{data.webhookUrl}</span>
            <CopyButton text={data.webhookUrl} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            All Unipile events — new messages, account connections, status changes — POST to this URL in real-time.
          </p>
        </div>
      )}

      {/* Connected Accounts */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-slate-800">Connected Accounts in Unipile</h3>
          {data?.accounts && (
            <span className="ml-auto text-xs text-slate-400">{data.accounts.length} total</span>
          )}
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading accounts…
          </div>
        ) : !data?.accounts?.length ? (
          <div className="px-5 py-8 text-center">
            <p className="text-slate-500 text-sm">No accounts found in Unipile yet.</p>
            <p className="text-slate-400 text-xs mt-1">Connect a platform using the Guide tab to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.accounts.map((acc) => {
              const platform = PLATFORMS.find(
                (p) => p.provider === acc.type.toUpperCase() || p.id === acc.type.toLowerCase()
              );
              return (
                <div key={acc.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="text-xl w-8 text-center">{platform?.icon ?? "🔗"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{acc.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{acc.type} · {acc.id.slice(0, 20)}…</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={acc.status} />
                    {acc.createdAt && (
                      <span className="text-xs text-slate-400 hidden sm:block">
                        {new Date(acc.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Platform Connection Status Grid */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Platform Connection Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PLATFORMS.map((platform) => {
            const connected = data?.accounts?.some(
              (a) => a.type.toUpperCase() === platform.provider || a.type.toLowerCase() === platform.id
            );
            return (
              <div
                key={platform.id}
                className={`rounded-xl border p-4 flex flex-col gap-2 ${
                  connected
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{platform.icon}</span>
                  {connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                  )}
                </div>
                <p className="font-medium text-sm text-slate-800">{platform.name}</p>
                <p className={`text-xs ${connected ? "text-emerald-600" : "text-slate-400"}`}>
                  {connected ? "Connected" : "Not connected"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventsTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const { data: initial } = useQuery({
    queryKey: ["webhook-events-init"],
    queryFn: fetchWebhookEvents,
  });

  useEffect(() => {
    if (initial?.events) setEvents(initial.events);
  }, [initial]);

  useEffect(() => {
    const es = createEventStream((newEvents) => {
      setEvents(newEvents);
      setLiveConnected(true);
    });
    esRef.current = es;
    es.onerror = () => setLiveConnected(false);
    return () => es.close();
  }, []);

  const eventColor = (event: string) => {
    if (event.includes("success") || event.includes("connected") || event.includes("sync_success"))
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (event.includes("error") || event.includes("fail"))
      return "text-red-600 bg-red-50 border-red-200";
    if (event.includes("new_message") || event.includes("received"))
      return "text-blue-600 bg-blue-50 border-blue-200";
    if (event.includes("delete") || event.includes("stopped") || event.includes("disconnected"))
      return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-slate-600 bg-slate-50 border-slate-200";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${liveConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
          <span className="text-sm text-slate-600">
            {liveConnected ? "Live — updating every 2s" : "Connecting to live stream…"}
          </span>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          Last 100 events stored in memory
        </span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
          <Radio className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No webhook events received yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Connect a platform account — events will appear here in real-time once Unipile starts sending them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
              >
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${eventColor(evt.event)}`}>
                  {evt.event}
                </span>
                {evt.provider && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {evt.provider}
                  </span>
                )}
                <span className="text-sm text-slate-600 flex-1 truncate">{evt.summary}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(evt.receivedAt).toLocaleTimeString()}
                </span>
              </button>
              {expanded === evt.id && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Raw Payload</p>
                  <pre className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono max-h-48">
                    {JSON.stringify(evt.raw, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuideTab() {
  const [open, setOpen] = useState<string | null>("gmail");

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 pb-1">
        Step-by-step instructions for connecting each platform. All connections flow through Unipile's hosted auth — no API keys or credentials are stored in the app itself.
      </p>
      {PLATFORMS.map((platform) => (
        <div
          key={platform.id}
          className="rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          <button
            className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
            onClick={() => setOpen(open === platform.id ? null : platform.id)}
          >
            <span className="text-2xl">{platform.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">{platform.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Auth: {platform.authType === "oauth" ? "OAuth (redirect)" :
                       platform.authType === "qr" ? "QR Code scan" :
                       platform.authType === "phone" ? "Phone + verification code" :
                       "Username & password"}
              </p>
            </div>
            <span className={`text-slate-400 transition-transform ${open === platform.id ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {open === platform.id && (
            <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4">
              <ol className="space-y-3">
                {platform.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p
                      className="text-sm text-slate-700 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: step
                          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                          .replace(/`(.+?)`/g, '<code class="font-mono text-xs bg-white border border-slate-200 px-1 py-0.5 rounded">$1</code>'),
                      }}
                    />
                  </li>
                ))}
              </ol>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">{platform.notes}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("status");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "status", label: "Connection Status", icon: <Wifi className="w-4 h-4" /> },
    { id: "events", label: "Webhook Events", icon: <Zap className="w-4 h-4" /> },
    { id: "guide", label: "Platform Guide", icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Unipile Connection Hub</h1>
              <p className="text-sm text-muted-foreground">API diagnostics · Webhook monitor · Platform setup guide</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-white text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "status" && <StatusTab />}
        {tab === "events" && <EventsTab />}
        {tab === "guide" && <GuideTab />}
      </div>
    </div>
  );
}
