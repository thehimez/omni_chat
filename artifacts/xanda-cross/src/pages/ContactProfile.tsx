import { useState, useEffect, useCallback } from "react";
import { useGetContact } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icon";
import {
  ArrowLeft, MessageSquare, Brain, Sparkles, Clock,
  Pencil, Trash2, Plus, X, ChevronRight, Users,
  Target, AlertCircle, Lightbulb, Zap, Activity,
  CheckCircle2, ListTodo, TrendingUp,
} from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Sub-types ─────────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  conversationId: string;
  platform: string;
  topicLabel: string | null;
  direction: string;
  bodyText: string;
  senderName: string;
  sentAt: string;
}

interface ContactFact {
  id: string;
  factType: string;
  label: string;
  value: string;
  source: string;
  confidence: number | null;
}

interface MemoryCard {
  lastDiscussed: string;
  importantFacts: string[];
  openItems: string[];
  suggestedFollowUp: string;
}

interface MeetingBrief {
  whoIsThisPerson: string;
  relationshipSummary: string;
  lastDiscussions: string[];
  importantFacts: string[];
  openCommitments: string[];
  suggestedTalkingPoints: string[];
  recommendedNextAction: string;
}

// ── Relationship Score Ring ───────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const label = score >= 75 ? "Very Strong" : score >= 50 ? "Strong" : score >= 25 ? "Growing" : "Weak";
  const color = score >= 75 ? "#6366f1" : score >= 50 ? "#8b5cf6" : score >= 25 ? "#a78bfa" : "#c4b5fd";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#e8e5ff" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{score}</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-indigo-500">{label}</span>
    </div>
  );
}

// ── Meeting Prep Modal ────────────────────────────────────────────────────────

function MeetingPrepModal({
  contactId,
  contactName,
  onClose,
}: { contactId: string; contactName: string; onClose: () => void }) {
  const [brief, setBrief] = useState<MeetingBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/contacts/${contactId}/intelligence/meeting-prep`, { method: "POST" })
      .then((d) => setBrief(d.brief))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [contactId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-5 border-b flex items-center gap-3 shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 text-sm">Meeting Prep</h2>
            <p className="text-xs text-gray-500">{contactName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-white/60 flex items-center justify-center text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="space-y-4">
              {[120, 80, 100, 90].map((w, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className={`h-4 w-[${w}%]`} />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-500">Could not generate brief.<br />Try again in a moment.</p>
            </div>
          )}

          {brief && (
            <>
              <Section icon={<Users className="w-4 h-4" />} title="Who is this person?" color="indigo">
                <p className="text-sm text-gray-700 leading-relaxed">{brief.whoIsThisPerson}</p>
              </Section>

              <Section icon={<Activity className="w-4 h-4" />} title="Relationship summary" color="violet">
                <p className="text-sm text-gray-700 leading-relaxed">{brief.relationshipSummary}</p>
              </Section>

              {brief.lastDiscussions.length > 0 && (
                <Section icon={<MessageSquare className="w-4 h-4" />} title="Last discussions" color="blue">
                  <ul className="space-y-1">
                    {brief.lastDiscussions.map((d, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-300 mt-0.5">•</span>{d}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {brief.importantFacts.length > 0 && (
                <Section icon={<Lightbulb className="w-4 h-4" />} title="Important facts" color="amber">
                  <ul className="space-y-1">
                    {brief.importantFacts.map((f, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-amber-300 mt-0.5">•</span>{f}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {brief.openCommitments.length > 0 && (
                <Section icon={<ListTodo className="w-4 h-4" />} title="Open commitments" color="rose">
                  <ul className="space-y-1">
                    {brief.openCommitments.map((c, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-rose-300 shrink-0 mt-0.5" />{c}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {brief.suggestedTalkingPoints.length > 0 && (
                <Section icon={<Target className="w-4 h-4" />} title="Suggested talking points" color="emerald">
                  <ul className="space-y-1">
                    {brief.suggestedTalkingPoints.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />{p}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide mb-1">Recommended next action</p>
                    <p className="text-sm text-gray-700">{brief.recommendedNextAction}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({
  icon, title, color, children,
}: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colors[color] || colors.indigo}`}>
          {icon}
        </div>
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Add Fact form ─────────────────────────────────────────────────────────────

const FACT_TYPES = [
  { value: "company", label: "Company" },
  { value: "role", label: "Role / Job" },
  { value: "location", label: "Location" },
  { value: "interest", label: "Interest" },
  { value: "preference", label: "Preference" },
  { value: "date", label: "Important Date" },
  { value: "other", label: "Other" },
];

function AddFactForm({
  contactId,
  onAdded,
  onCancel,
}: { contactId: string; onAdded: (fact: ContactFact) => void; onCancel: () => void }) {
  const [factType, setFactType] = useState("other");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const typeObj = FACT_TYPES.find((t) => t.value === factType);

  const handleSave = async () => {
    if (!label.trim() || !value.trim()) return;
    setSaving(true);
    try {
      const data = await apiFetch(`/api/contacts/${contactId}/facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factType, label: label.trim(), value: value.trim() }),
      });
      onAdded(data.fact);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FACT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setFactType(t.value); setLabel(t.label); }}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${factType === t.value ? "bg-indigo-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <input
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white transition-colors">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving || !label.trim() || !value.trim()}
          className="text-xs bg-indigo-500 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Main ContactProfile ───────────────────────────────────────────────────────

type Tab = "overview" | "timeline" | "facts";

export default function ContactProfile() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { data: profile, isLoading } = useGetContact(id || "");

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showMeetingPrep, setShowMeetingPrep] = useState(false);

  // Overview AI summary
  const [aiSummary, setAiSummary] = useState<MemoryCard | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLoaded, setTimelineLoaded] = useState(false);

  // Facts
  const [facts, setFacts] = useState<ContactFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [factsLoaded, setFactsLoaded] = useState(false);
  const [showAddFact, setShowAddFact] = useState(false);

  // Load AI summary on mount (Overview tab)
  useEffect(() => {
    if (!id || aiSummary || aiLoading) return;
    setAiLoading(true);
    apiFetch(`/api/contacts/${id}/intelligence/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then((d) => setAiSummary(d.card))
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [id]);

  // Load timeline when tab switches
  useEffect(() => {
    if (activeTab !== "timeline" || timelineLoaded || !id) return;
    setTimelineLoading(true);
    apiFetch(`/api/contacts/${id}/timeline`)
      .then((d) => { setTimeline(d.events); setTimelineLoaded(true); })
      .catch(() => setTimelineLoaded(true))
      .finally(() => setTimelineLoading(false));
  }, [activeTab, id, timelineLoaded]);

  // Load facts when tab switches
  useEffect(() => {
    if (activeTab !== "facts" || factsLoaded || !id) return;
    setFactsLoading(true);
    apiFetch(`/api/contacts/${id}/facts`)
      .then((d) => { setFacts(d.facts); setFactsLoaded(true); })
      .catch(() => setFactsLoaded(true))
      .finally(() => setFactsLoading(false));
  }, [activeTab, id, factsLoaded]);

  const handleDeleteFact = useCallback(async (factId: string) => {
    await apiFetch(`/api/contacts/${id}/facts/${factId}`, { method: "DELETE" });
    setFacts((prev) => prev.filter((f) => f.id !== factId));
  }, [id]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card gap-4">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-5 w-32" />
        </header>
        <div className="p-8 space-y-6 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-6">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!profile) return <div className="p-8 text-center text-gray-500">Contact not found</div>;

  const score = profile.relationshipScore ?? 0;

  return (
    <>
      <div className="h-full flex flex-col bg-[#f7f7fa]">
        {/* Header */}
        <header className="h-14 border-b bg-white/90 backdrop-blur-sm flex items-center px-5 shrink-0 gap-3">
          <Link href="/contacts">
            <button className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden shrink-0">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{profile.displayName[0]}</div>
              }
            </div>
            <span className="font-semibold text-gray-900 text-sm">{profile.displayName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-xl h-8 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              onClick={() => setShowMeetingPrep(true)}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Prepare Me
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs rounded-xl h-8 bg-gradient-to-r from-indigo-500 to-violet-600 border-0"
              onClick={() => {
                const first = profile.recentConversations[0];
                if (first) navigate(`/inbox?id=${first.id}`);
              }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </Button>
          </div>
        </header>

        {/* Hero */}
        <div className="bg-white/80 border-b px-6 py-5 shrink-0">
          <div className="max-w-4xl mx-auto flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 overflow-hidden shrink-0 shadow-sm border border-white">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-400">{profile.displayName[0]}</div>
              }
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{profile.displayName}</h1>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.identities.map((id, i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                    <PlatformIcon platform={id.platform} className="w-3.5 h-3.5" />
                    <span className="text-[11px] text-gray-600 capitalize">{id.platform}</span>
                  </div>
                ))}
              </div>
              {profile.activeTopics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.activeTopics.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100 rounded-lg">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0 pt-1">
              <ScoreRing score={score} />
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last seen</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {profile.lastInteractionAt
                    ? formatDistanceToNow(new Date(profile.lastInteractionAt), { addSuffix: true })
                    : "Never"}
                </p>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {profile.recentConversations.length} thread{profile.recentConversations.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/80 border-b px-6 shrink-0">
          <div className="max-w-4xl mx-auto flex gap-0">
            {(["overview", "timeline", "facts"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-5">

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                {/* Xan AI Summary */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60 border border-indigo-100 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Xan Summary</span>
                    <span className="text-[10px] text-gray-400 ml-auto">AI-generated</span>
                  </div>

                  {aiLoading && (
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-5/6" />
                      <Skeleton className="h-3.5 w-4/5" />
                    </div>
                  )}

                  {!aiLoading && aiSummary && (
                    <div className="space-y-3">
                      {aiSummary.lastDiscussed && (
                        <p className="text-sm text-gray-700 leading-relaxed">{aiSummary.lastDiscussed}</p>
                      )}
                      {aiSummary.importantFacts.length > 0 && (
                        <ul className="space-y-1">
                          {aiSummary.importantFacts.map((f, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-indigo-300 mt-0.5">•</span>{f}
                            </li>
                          ))}
                        </ul>
                      )}
                      {aiSummary.suggestedFollowUp && (
                        <div className="flex items-start gap-2 bg-violet-50 rounded-xl px-3 py-2.5 mt-1">
                          <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-violet-700">{aiSummary.suggestedFollowUp}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!aiLoading && !aiSummary && (
                    <p className="text-sm text-gray-400">No AI summary available yet. Start messaging to build context.</p>
                  )}
                </div>

                {/* Recent conversations */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent conversations</h3>
                  {profile.recentConversations.length === 0 ? (
                    <p className="text-sm text-gray-400">No conversations yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {profile.recentConversations.map((conv) => (
                        <Link key={conv.id} href={`/inbox?id=${conv.id}`}>
                          <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer group">
                            <PlatformIcon platform={conv.platform} className="w-5 h-5 shrink-0 opacity-70" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800 truncate">{conv.headline || conv.topicLabel || "Conversation"}</span>
                                {conv.topicLabel && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">{conv.topicLabel}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-400">{format(new Date(conv.lastMessageAt), "MMM d")}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── TIMELINE ── */}
            {activeTab === "timeline" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {timelineLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2 pt-1">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!timelineLoading && timeline.length === 0 && (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No message history yet.</p>
                  </div>
                )}

                {!timelineLoading && timeline.length > 0 && (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
                    <div className="space-y-4">
                      {timeline.map((event) => (
                        <div key={event.id} className="flex gap-4 relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm border-2 border-white ${event.direction === "outbound" ? "bg-indigo-100" : "bg-white"}`}>
                            <PlatformIcon platform={event.platform} className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-gray-200 transition-colors">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[11px] font-semibold text-gray-500 capitalize">{event.platform}</span>
                              {event.topicLabel && (
                                <Badge variant="outline" className="text-[10px]">{event.topicLabel}</Badge>
                              )}
                              <span className="ml-auto text-[11px] text-gray-400">{format(new Date(event.sentAt), "MMM d, h:mm a")}</span>
                            </div>
                            <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{event.bodyText}</p>
                            {event.direction === "outbound" && (
                              <p className="text-[10px] text-indigo-400 mt-1">You sent this</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── FACTS ── */}
            {activeTab === "facts" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Facts about {profile.displayName}. AI-extracted facts are labelled. You can add your own.</p>
                  <button
                    onClick={() => setShowAddFact(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add fact
                  </button>
                </div>

                <AnimatePresence>
                  {showAddFact && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      <AddFactForm
                        contactId={id!}
                        onAdded={(f) => { setFacts((prev) => [f, ...prev]); setShowAddFact(false); }}
                        onCancel={() => setShowAddFact(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {factsLoading && (
                  <div className="grid gap-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
                  </div>
                )}

                {!factsLoading && facts.length === 0 && !showAddFact && (
                  <div className="text-center py-12 rounded-2xl border-2 border-dashed border-gray-200">
                    <Lightbulb className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-2">No facts recorded yet.</p>
                    <button onClick={() => setShowAddFact(true)} className="text-xs text-indigo-500 hover:text-indigo-700">Add the first fact</button>
                  </div>
                )}

                {!factsLoading && facts.length > 0 && (
                  <div className="grid gap-2">
                    <AnimatePresence>
                      {facts.map((fact) => (
                        <motion.div
                          key={fact.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className="flex items-start gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{fact.label}</span>
                              {fact.source === "ai_extracted" && (
                                <span className="text-[9px] font-medium text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-md">AI</span>
                              )}
                              {fact.confidence !== null && fact.confidence < 0.7 && (
                                <span className="text-[9px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">Unconfirmed</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 mt-0.5">{fact.value}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteFact(fact.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 text-gray-300 hover:text-rose-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

          </div>
        </div>
      </div>

      {/* Meeting Prep Modal */}
      <AnimatePresence>
        {showMeetingPrep && (
          <MeetingPrepModal
            contactId={id!}
            contactName={profile.displayName}
            onClose={() => setShowMeetingPrep(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
