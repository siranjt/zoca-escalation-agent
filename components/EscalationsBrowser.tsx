"use client";

import { useMemo, useState } from "react";
import CommsActivityChart from "./charts/CommsActivityChart";
import ChannelMixDonut from "./charts/ChannelMixDonut";
import TicketsClassificationDonut from "./charts/TicketsClassificationDonut";
import TicketsOverTimeChart from "./charts/TicketsOverTimeChart";
import ResponseHealthCard from "./charts/ResponseHealthCard";
import {
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
} from "./charts/colors";

// ─── Types ────────────────────────────────────────────────────────────────

type Channel = "app_chat" | "email" | "phone" | "video" | "sms";
type Sender = "client" | "team" | "unknown";

interface Comm {
  channel: Channel;
  createdAt: string;
  sender: Sender;
  body: string;
  durationSec?: number;
}

interface CustomerCard {
  bizName: string;
  entityId: string;
  customerId: string;
  email: string;
  phone: string;
  amName: string;
  spName: string;
  aeName: string;
  status: string;
  churnDate: string;
  monthlyRevenue?: number;
}

interface ChannelStatus {
  fetched: number;
  aborted: boolean;
  error?: string;
}

interface Ticket {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: string;
  classification: string;
  category: string;
  churnPotentialStatus: string;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  cancelledAt: string;
  entityId: string;
  customerName: string;
  customerId: string;
  amName: string;
  aeName: string;
  creatorEmail: string;
  assigneeEmail: string;
}

interface ApiResponse {
  ok: boolean;
  query?: string;
  matches?: CustomerCard[];
  customer?: CustomerCard | null;
  comms?: Comm[];
  stats?: {
    total: number;
    byChannel: Record<string, number>;
    bySender: Record<string, number>;
  };
  perChannelStatus?: Partial<Record<Channel, ChannelStatus>>;
  tickets?: Ticket[];
  skippedComms?: boolean;
  lookupNotes?: string[];
  error?: string;
}

interface TriageResult {
  severity: "P0" | "P1" | "P2" | "P3";
  category: string;
  ownerSuggestion: { role: string; namedPerson?: string; rationale: string };
  summary: string;
  draftReply: { channel: string; subject?: string; body: string };
  autoResolvable: { eligible: boolean; confidence: number; reason: string };
  routing: { actions: any[] };
  signalsUsed: string[];
}

interface TriageState {
  status: "idle" | "loading" | "ready" | "skipped" | "error";
  sourceMessage: Comm | null;
  result: TriageResult | null;
  error?: string;
  reason?: string;
}

type CommsLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

type Tab = "triage" | "tickets" | "history";

// ─── Constants ────────────────────────────────────────────────────────────

const CHANNELS: Channel[] = ["app_chat", "email", "phone", "video", "sms"];

const SEVERITY: Record<string, { bar: string; chip: string }> = {
  P0: { bar: "#ef5b5b", chip: "bg-errSoft text-err border-err/40" },
  P1: { bar: "#ef5b5b", chip: "bg-errSoft text-err border-err/40" },
  P2: { bar: "#5b8cff", chip: "bg-accentSoft text-accent border-accent/40" },
  P3: { bar: "#7e8794", chip: "bg-panel2 text-muted border-border" },
};

const TIME_WINDOWS: { key: string; label: string; days: number }[] = [
  { key: "30", label: "30d", days: 30 },
  { key: "90", label: "90d", days: 90 },
  { key: "365", label: "1y", days: 365 },
  { key: "0", label: "All time", days: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "";
  const sec = Math.floor((Date.now() - d) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function dateBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  )
    return "Yesterday";
  const sameYear = d.getFullYear() === today.getFullYear();
  return sameYear
    ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDuration(sec?: number): string {
  if (!sec || sec < 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────

export default function EscalationsBrowser() {
  const [query, setQuery] = useState("");
  const [sinceDays, setSinceDays] = useState("90");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [commsState, setCommsState] = useState<CommsLoadState>({ status: "idle" });
  const [triage, setTriage] = useState<TriageState>({ status: "idle", sourceMessage: null, result: null });
  const [retrying, setRetrying] = useState<Set<Channel>>(new Set());
  const [tab, setTab] = useState<Tab>("triage");

  // Chart filters (interactive drill-down)
  const [chartChannelFilter, setChartChannelFilter] = useState<string | null>(null);
  const [chartClassFilter, setChartClassFilter] = useState<string | null>(null);

  // History filters
  const [senderFilter, setSenderFilter] = useState<Sender | "all">("client");
  const [textFilter, setTextFilter] = useState("");

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);
    setCommsState({ status: "idle" });
    setTriage({ status: "idle", sourceMessage: null, result: null });
    setChartChannelFilter(null);
    setChartClassFilter(null);
    setTab("triage");

    let phase1: ApiResponse | null = null;
    try {
      const u = new URL("/api/escalations", window.location.origin);
      u.searchParams.set("q", query.trim());
      u.searchParams.set("sinceDays", sinceDays);
      u.searchParams.set("skipComms", "1");
      const res = await fetch(u.toString());
      const text = await res.text();
      try {
        phase1 = JSON.parse(text) as ApiResponse;
        setResponse(phase1);
      } catch {
        setResponse({ ok: false, error: "Phase 1 returned non-JSON. Retry — cache should be primed now." });
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setResponse({ ok: false, error: err?.message || "Network error" });
      setLoading(false);
      return;
    }
    setLoading(false);

    if (!phase1?.ok || !phase1.customer) return;

    setCommsState({ status: "loading" });
    let phase2: ApiResponse | null = null;
    try {
      const u = new URL("/api/escalations", window.location.origin);
      u.searchParams.set("q", query.trim());
      u.searchParams.set("sinceDays", sinceDays);
      const res = await fetch(u.toString());
      const text = await res.text();
      try {
        phase2 = JSON.parse(text) as ApiResponse;
      } catch {
        setCommsState({ status: "error", message: "Comms server returned non-JSON. Retry — cache should be primed." });
        return;
      }
      if (!phase2.ok) {
        setCommsState({ status: "error", message: phase2.error || "Comms fetch failed" });
        return;
      }
      setResponse((prev) =>
        prev
          ? {
              ...prev,
              comms: phase2!.comms,
              stats: phase2!.stats,
              perChannelStatus: phase2!.perChannelStatus,
              skippedComms: false,
              lookupNotes: phase2!.lookupNotes?.length ? phase2!.lookupNotes : prev.lookupNotes,
            }
          : prev
      );
      setCommsState({ status: "ready" });
    } catch (err: any) {
      setCommsState({ status: "error", message: err?.message || "Network error" });
      return;
    }

    const comms = phase2?.comms || [];
    const latestClient = comms.find((m) => m.sender === "client");
    if (!latestClient) {
      setTriage({
        status: "skipped",
        sourceMessage: null,
        result: null,
        reason: "No client-initiated message in this time window — nothing to triage.",
      });
      return;
    }
    setTriage({ status: "loading", sourceMessage: latestClient, result: null });
    try {
      const r = await fetch("/api/escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: latestClient.body || "(empty body)",
          source: { medium: latestClient.channel, receivedAt: latestClient.createdAt },
          customerHint: {
            entityId: phase1.customer.entityId,
            customerId: phase1.customer.customerId,
            email: phase1.customer.email,
            bizName: phase1.customer.bizName,
          },
        }),
      });
      const tdata = await r.json();
      if (tdata.ok && tdata.result) {
        setTriage({ status: "ready", sourceMessage: latestClient, result: tdata.result as TriageResult });
      } else {
        setTriage({
          status: "error",
          sourceMessage: latestClient,
          result: null,
          error: tdata.error || "Agent did not return a result",
        });
      }
    } catch (err: any) {
      setTriage({
        status: "error",
        sourceMessage: latestClient,
        result: null,
        error: err?.message || "Network error during triage",
      });
    }
  }

  async function retryChannel(ch: Channel) {
    if (!response?.customer || !response.query) return;
    setRetrying((prev) => new Set(prev).add(ch));
    try {
      const url = new URL("/api/escalations", window.location.origin);
      url.searchParams.set("q", response.customer.entityId || response.query);
      url.searchParams.set("sinceDays", sinceDays);
      url.searchParams.set("channel", ch);
      const res = await fetch(url.toString());
      const text = await res.text();
      let data: ApiResponse;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: `${ch}: still timing out — give the cache a moment.` };
      }
      setResponse((prev) => {
        if (!prev) return prev;
        const others = (prev.comms || []).filter((m) => m.channel !== ch);
        const next = [...others, ...(data.comms || [])].sort((a, b) =>
          a.createdAt < b.createdAt ? 1 : -1
        );
        const byChannel: Record<string, number> = {};
        const bySender: Record<string, number> = {};
        for (const m of next) {
          byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
          bySender[m.sender] = (bySender[m.sender] || 0) + 1;
        }
        return {
          ...prev,
          comms: next,
          stats: { total: next.length, byChannel, bySender },
          perChannelStatus: {
            ...prev.perChannelStatus,
            [ch]: data.perChannelStatus?.[ch] || {
              fetched: data.comms?.length || 0,
              aborted: false,
              error: data.error,
            },
          },
        };
      });
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(ch);
        return next;
      });
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────

  const filteredComms = useMemo(() => {
    if (!response?.comms) return [];
    const t = textFilter.trim().toLowerCase();
    const out = response.comms.filter((m) => {
      if (chartChannelFilter && m.channel !== chartChannelFilter) return false;
      if (senderFilter !== "all" && m.sender !== senderFilter) return false;
      if (t && !(m.body || "").toLowerCase().includes(t)) return false;
      return true;
    });
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }, [response, chartChannelFilter, senderFilter, textFilter]);

  const groupedComms = useMemo(() => {
    const groups = new Map<string, Comm[]>();
    for (const m of filteredComms) {
      const k = dateBucket(m.createdAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(m);
    }
    return Array.from(groups.entries());
  }, [filteredComms]);

  const filteredTickets = useMemo(() => {
    if (!response?.tickets) return [];
    if (!chartClassFilter) return response.tickets;
    return response.tickets.filter((t) => t.classification === chartClassFilter);
  }, [response, chartClassFilter]);

  const ticketCount = response?.tickets?.length ?? 0;
  const openTicketCount =
    response?.tickets?.filter((t) =>
      ["Todo", "In Progress", "In Review"].includes(t.state)
    ).length ?? 0;

  const last30Comms = useMemo(() => {
    if (!response?.comms) return 0;
    const cut = Date.now() - 30 * 86400000;
    return response.comms.filter((m) => Date.parse(m.createdAt) > cut).length;
  }, [response]);

  const sinceDaysNum = TIME_WINDOWS.find((w) => w.key === sinceDays)?.days ?? 90;

  const abortedChannels: Channel[] = response?.perChannelStatus
    ? (Object.entries(response.perChannelStatus) as [Channel, ChannelStatus][])
        .filter(([, s]) => s?.aborted)
        .map(([ch]) => ch)
    : [];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="text-center pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand/25 bg-panel/60 text-xs text-muted2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_12px_rgba(255,168,205,0.7)]" />
          Customer Success · live from Chargebee + Metabase
        </div>
        <h1 className="mt-4 font-extrabold text-[44px] leading-[1.05] tracking-[-0.035em]">
          Customer <span className="brand-gradient-text relative inline-block">360<span className="absolute -top-3 -right-5 text-[18px] text-brand">✦</span></span>
        </h1>
        <p className="mt-4 max-w-[560px] mx-auto text-sm text-muted2 leading-relaxed">
          Search by business name or entity_id. One search returns triage of their latest message,
          all related Linear tickets, and the full comms timeline across App Chat, Email, Phone,
          Video, and SMS.
        </p>
        <div className="mt-4 flex justify-center gap-5 text-xs text-muted2">
          <span className="flex items-center gap-1"><span className="text-brand">✦</span> Auto-triage</span>
          <span className="flex items-center gap-1"><span className="text-brand">✦</span> Finance + CX tickets</span>
          <span className="flex items-center gap-1"><span className="text-brand">✦</span> 5-channel comms</span>
        </div>
      </div>

      {/* SEARCH PILL */}
      <form onSubmit={lookup} className="flex justify-center">
        <div
          className="flex items-center gap-3 pl-5 pr-2 py-2 rounded-full border border-border2 bg-panel/70 w-full max-w-[640px]"
          style={{ boxShadow: "0 0 0 1px rgba(255,168,205,0.05), 0 0 40px -16px rgba(255,168,205,0.3)" }}
        >
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted">Search</span>
          <input
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted"
            placeholder="Business name, entity_id, email, or Chargebee customer id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            className="bg-transparent text-xs text-muted outline-none cursor-pointer"
            value={sinceDays}
            onChange={(e) => setSinceDays(e.target.value)}
          >
            {TIME_WINDOWS.map((t) => (
              <option key={t.key} value={t.key} className="bg-panel">{t.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-full bg-brand text-[#2a0d1c] font-semibold px-5 py-2 text-sm disabled:opacity-50"
            style={{ boxShadow: "0 0 30px -8px rgba(255,168,205,0.5)" }}
          >
            {loading ? "Looking up…" : "Look up"}
          </button>
        </div>
      </form>

      {/* ERROR */}
      {response && response.ok === false && (
        <div className="rounded-xl border border-err/40 bg-err/10 p-4 text-sm">
          <p className="text-err font-medium">Lookup failed</p>
          <p className="text-muted2 mt-1">{response.error}</p>
        </div>
      )}

      {/* NO MATCH */}
      {response && response.ok && !response.customer && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="text-warn font-medium">No customer match for &quot;{response.query}&quot;</p>
          <p className="text-muted2 mt-1">Try a UUID, exact biz name, an email, or the Chargebee customer id.</p>
        </div>
      )}

      {/* HERO CUSTOMER CARD */}
      {response && response.ok && response.customer && (
        <>
          <div
            className="rounded-2xl p-7 border"
            style={{
              borderColor: "rgba(78,101,255,0.25)",
              background:
                "linear-gradient(135deg, rgba(78,101,255,0.18) 0%, rgba(255,168,205,0.10) 60%, rgba(20,15,30,0.4) 100%)",
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">
                  ● Customer · live
                </div>
                <div className="text-[36px] md:text-[40px] font-extrabold tracking-[-0.025em] leading-[1.05] truncate">
                  {response.customer.bizName || "(no name)"}
                </div>
                <div className="text-sm text-muted2 mt-2 truncate">
                  {response.customer.email || "—"}
                  {response.customer.phone ? ` · ${response.customer.phone}` : ""}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted">
                  {response.customer.amName && (
                    <span>AM <span className="text-text">{response.customer.amName}</span></span>
                  )}
                  {response.customer.spName && (
                    <span>SP <span className="text-text">{response.customer.spName}</span></span>
                  )}
                  {response.customer.aeName && (
                    <span>AE <span className="text-text">{response.customer.aeName}</span></span>
                  )}
                </div>
                <div className="text-[10px] text-muted/70 mt-2 font-mono truncate">
                  {response.customer.entityId || "—"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted">MRR</div>
                <div className="text-[36px] md:text-[40px] font-extrabold tracking-[-0.025em] leading-[1.05]">
                  {typeof response.customer.monthlyRevenue === "number"
                    ? `$${response.customer.monthlyRevenue.toFixed(0)}`
                    : "—"}
                </div>
                {response.customer.status && (
                  <div
                    className={`inline-flex items-center gap-1 mt-2 text-xs font-medium rounded-full border px-2 py-0.5 ${
                      response.customer.status === "ZOCA" || response.customer.status === "active"
                        ? "border-ok/40 bg-okSoft text-ok"
                        : response.customer.status === "CHURNED"
                          ? "border-err/40 bg-errSoft text-err"
                          : "border-border bg-panel2 text-muted2"
                    }`}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                    {response.customer.status}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-3">
            <div className="rounded-xl border border-border bg-panel p-4">
              <CommsActivityChart
                comms={(response.comms || []) as any}
                sinceDays={sinceDaysNum}
              />
            </div>
            <div className="rounded-xl border border-border bg-panel p-4">
              <ChannelMixDonut
                comms={(response.comms || []) as any}
                sinceDays={sinceDaysNum}
                selected={chartChannelFilter}
                onSelect={(ch) => {
                  setChartChannelFilter(ch);
                  if (ch) setTab("history");
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-panel p-4">
              <TicketsClassificationDonut
                tickets={(response.tickets || []) as any}
                selected={chartClassFilter}
                onSelect={(c) => {
                  setChartClassFilter(c);
                  if (c) setTab("tickets");
                }}
              />
            </div>
            <div className="rounded-xl border border-border bg-panel p-4">
              <TicketsOverTimeChart tickets={(response.tickets || []) as any} weeks={12} />
            </div>
            <ResponseHealthCard
              comms={(response.comms || []) as any}
              autoResolveConfidence={triage.result?.autoResolvable.confidence ?? null}
            />
          </div>

          {/* SECTION TABS */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-panel border border-border w-fit">
            <TabBtn active={tab === "triage"} onClick={() => setTab("triage")}>
              Triage
              {triage.status === "ready" && triage.result && (
                <span className={`ml-2 text-[10px] rounded-md border px-1.5 py-0 ${SEVERITY[triage.result.severity]?.chip || ""}`}>
                  {triage.result.severity}
                </span>
              )}
              {triage.status === "loading" && <span className="ml-2 text-[10px] text-muted">…</span>}
            </TabBtn>
            <TabBtn active={tab === "tickets"} onClick={() => setTab("tickets")}>
              Tickets
              {ticketCount > 0 && (
                <span className="ml-1.5 text-[10px] text-muted bg-panel2 px-1.5 rounded-full">
                  {ticketCount}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
              History
              {response.stats?.total ? (
                <span className="ml-1.5 text-[10px] text-muted bg-panel2 px-1.5 rounded-full">
                  {response.stats.total}
                </span>
              ) : null}
            </TabBtn>
          </div>

          {/* ── TRIAGE TAB ─────────────────────────────── */}
          {tab === "triage" && (
            <div>
              {triage.status === "idle" && commsState.status === "loading" && (
                <div className="rounded-xl border border-border bg-panel p-4 text-sm text-muted">
                  Fetching comms history first (5 channels)…
                </div>
              )}
              {triage.status === "skipped" && (
                <div className="rounded-xl border border-border bg-panel p-4 text-sm text-muted">
                  {triage.reason}
                </div>
              )}
              {triage.status === "loading" && (
                <div className="rounded-xl border border-border bg-panel p-4 text-sm text-muted">
                  Running the agent on the latest client message
                  {triage.sourceMessage ? ` (${triage.sourceMessage.channel}, ${relTime(triage.sourceMessage.createdAt)} ago)…` : "…"}
                </div>
              )}
              {triage.status === "error" && (
                <div className="rounded-xl border border-err/40 bg-err/10 p-4 text-sm">
                  <p className="text-err font-medium">Triage failed</p>
                  <p className="text-muted2 mt-1 whitespace-pre-wrap">{triage.error}</p>
                </div>
              )}
              {triage.status === "ready" && triage.result && triage.sourceMessage && (
                <div
                  className="rounded-xl border border-border bg-panel severity-bar pl-5 pr-6 py-5"
                  style={{ ["--bar" as any]: SEVERITY[triage.result.severity]?.bar || "#2c333d" }}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold rounded-md border px-1.5 py-0.5 ${SEVERITY[triage.result.severity]?.chip || ""}`}>
                        {triage.result.severity}
                      </span>
                      <span className="font-semibold text-base capitalize">
                        {triage.result.category.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      {triage.sourceMessage.channel.replace("_", " ")} · {relTime(triage.sourceMessage.createdAt)} ago
                    </span>
                  </div>

                  <div className="rounded-lg border border-border2 bg-panel2 px-3 py-2 text-sm text-muted2 italic mb-4">
                    &quot;{triage.sourceMessage.body}&quot;
                  </div>

                  <div className="text-sm leading-relaxed mb-4">
                    <span className="text-muted">Owner</span>{" "}
                    <strong className="font-semibold">
                      {triage.result.ownerSuggestion.namedPerson || triage.result.ownerSuggestion.role}
                    </strong>
                    {triage.result.ownerSuggestion.namedPerson && (
                      <span className="text-muted"> · {triage.result.ownerSuggestion.role}</span>
                    )}
                    <span className="text-muted2"> — {triage.result.ownerSuggestion.rationale}</span>
                  </div>

                  <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{triage.result.summary}</p>

                  <div className="rounded-lg border border-border2 bg-panel2 mb-3">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs text-muted">
                      <span>
                        Draft reply · {triage.result.draftReply.channel}
                        {triage.result.draftReply.subject ? ` · "${triage.result.draftReply.subject}"` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(triage.result!.draftReply.body)}
                        className="text-muted hover:text-text"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap font-sans">
{triage.result.draftReply.body}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-md border px-2 py-1 ${
                        triage.result.autoResolvable.eligible
                          ? "bg-okSoft text-ok border-ok/40"
                          : "bg-panel2 text-muted border-border"
                      }`}
                    >
                      Auto-resolve {triage.result.autoResolvable.eligible ? "eligible" : "not eligible"} · {(triage.result.autoResolvable.confidence * 100).toFixed(0)}%
                    </span>
                    {triage.result.routing.actions.map((a: any, i: number) => (
                      <span key={i} className="rounded-md border border-border bg-panel2 px-2 py-1 text-muted2">
                        {a.type === "slack_dm" && <>Slack DM <strong className="text-text">{a.to}</strong></>}
                        {a.type === "slack_channel" && <>Slack <strong className="text-text">#{a.channel}</strong></>}
                        {a.type === "linear_issue" && <>Linear · <strong className="text-text">{a.title}</strong></>}
                        {a.type === "email" && <>Email <strong className="text-text">{a.to}</strong></>}
                        {a.type === "noop" && <>{a.reason}</>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TICKETS TAB ──────────────────────────────── */}
          {tab === "tickets" && (
            <div className="rounded-xl border border-border bg-panel overflow-hidden">
              <div className="px-4 py-2 border-b border-border text-xs text-muted flex items-center justify-between">
                <span>
                  {filteredTickets.length} {filteredTickets.length === 1 ? "ticket" : "tickets"}
                  {chartClassFilter && (
                    <span className="ml-2">
                      · filtered to{" "}
                      <strong className="text-text">{CLASSIFICATION_LABELS[chartClassFilter] || chartClassFilter}</strong>
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {chartClassFilter && (
                    <button
                      type="button"
                      onClick={() => setChartClassFilter(null)}
                      className="text-muted hover:text-text"
                    >
                      Clear filter ✕
                    </button>
                  )}
                  <span>Latest first</span>
                </div>
              </div>
              {filteredTickets.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted">
                  {ticketCount === 0
                    ? "No tickets found in the Metabase feed for this customer."
                    : "No tickets match this filter."}
                </div>
              )}
              {filteredTickets.map((t) => {
                const classBar = CLASSIFICATION_COLORS[t.classification] || "#2c333d";
                const classLabel = CLASSIFICATION_LABELS[t.classification] || t.classification;
                const stateCls =
                  t.state === "Done"
                    ? "text-ok"
                    : t.state === "In Progress" || t.state === "In Review"
                      ? "text-accent"
                      : t.state === "Canceled" || t.state === "Duplicate"
                        ? "text-err"
                        : "text-text";
                return (
                  <div
                    key={t.id}
                    className="severity-bar row-divider px-4 py-3 hover:bg-panel2/60"
                    style={{ ["--bar" as any]: classBar }}
                  >
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-mono text-muted">{t.identifier || "—"}</span>
                      <span
                        className="rounded-md border px-1.5 py-0.5"
                        style={{ borderColor: classBar + "66", background: classBar + "15", color: classBar }}
                      >
                        {classLabel}
                      </span>
                      <span className={stateCls}>{t.state}</span>
                      {t.churnPotentialStatus && (
                        <span className="rounded-md border border-warn/40 bg-warnSoft text-warn px-1.5 py-0.5">
                          {t.churnPotentialStatus}
                        </span>
                      )}
                      <span className="ml-auto text-muted">{relTime(t.createdAt)} ago</span>
                    </div>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block mt-1 text-sm font-medium hover:underline underline-offset-4 truncate"
                    >
                      {t.title}
                    </a>
                    <div className="text-xs text-muted mt-0.5">
                      {t.amName && <>AM <span className="text-text">{t.amName}</span></>}
                      {t.assigneeEmail && (
                        <>
                          {t.amName ? " · " : ""}Assignee <span className="text-text">{t.assigneeEmail}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── HISTORY TAB ──────────────────────────────── */}
          {tab === "history" && (
            <div className="space-y-3">
              {commsState.status === "loading" && (
                <div className="rounded-xl border border-border bg-panel p-4 text-sm text-muted">
                  Fetching comms history (5 channels)…
                </div>
              )}
              {commsState.status === "error" && (
                <div className="rounded-xl border border-warn/40 bg-warn/5 p-4">
                  <p className="text-warn font-medium text-sm">Comms history unavailable</p>
                  <p className="text-muted2 text-sm mt-1">{commsState.message}</p>
                </div>
              )}

              {abortedChannels.length > 0 && (
                <div className="rounded-xl border border-warn/40 bg-warn/5 p-3">
                  <p className="text-xs text-warn mb-2">
                    {abortedChannels.length} channel{abortedChannels.length === 1 ? "" : "s"} timed out
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {abortedChannels.map((ch) => {
                      const busy = retrying.has(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => retryChannel(ch)}
                          disabled={busy}
                          className="rounded-full border px-3 py-1 disabled:opacity-50"
                          style={{
                            borderColor: (CHANNEL_COLORS[ch] || "#2c333d") + "66",
                            color: CHANNEL_COLORS[ch] || "#7e8794",
                            background: (CHANNEL_COLORS[ch] || "#2c333d") + "10",
                          }}
                        >
                          {busy ? `Loading ${CHANNEL_LABELS[ch]}…` : `Retry ${CHANNEL_LABELS[ch]}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-panel p-3">
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <span className="text-muted">Channel</span>
                  {CHANNELS.map((c) => {
                    const on = chartChannelFilter === null || chartChannelFilter === c;
                    const color = CHANNEL_COLORS[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChartChannelFilter(chartChannelFilter === c ? null : c)}
                        className="rounded-full border px-2.5 py-0.5"
                        style={{
                          borderColor: on ? color + "66" : "#222831",
                          background: on ? color + "15" : "#161827",
                          color: on ? color : "#7e8794",
                        }}
                      >
                        {CHANNEL_LABELS[c]}
                      </button>
                    );
                  })}
                  <span className="ml-3 text-muted">Sender</span>
                  {(["all", "client", "team"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSenderFilter(s)}
                      className={`rounded-full border px-2.5 py-0.5 ${
                        senderFilter === s ? "border-brand/40 bg-brandSoft text-brand" : "border-border text-muted bg-panel2"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <input
                    className="ml-auto bg-panel2 border border-border rounded-lg px-2 py-1 outline-none focus:border-border2 text-xs w-48"
                    placeholder="Search messages…"
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-panel overflow-hidden">
                {filteredComms.length === 0 ? (
                  <div className="p-6 text-sm text-muted">
                    {commsState.status === "ready" ? "No messages match these filters." : "Comms not loaded yet."}
                  </div>
                ) : (
                  groupedComms.map(([day, items]) => (
                    <div key={day}>
                      <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted bg-panel2 border-y border-border font-bold">
                        {day}
                      </div>
                      {items.map((m, i) => (
                        <div
                          key={`${day}-${i}`}
                          className="severity-bar row-divider px-4 py-2.5"
                          style={{ ["--bar" as any]: CHANNEL_COLORS[m.channel] || "#2c333d" }}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted">{CHANNEL_LABELS[m.channel] || m.channel}</span>
                            <span className="text-muted">·</span>
                            <span
                              className={
                                m.sender === "client"
                                  ? "text-brand"
                                  : m.sender === "team"
                                    ? "text-ok"
                                    : "text-muted"
                              }
                            >
                              {m.sender}
                            </span>
                            {m.durationSec ? (
                              <span className="text-muted">· {fmtDuration(m.durationSec)}</span>
                            ) : null}
                            <span className="ml-auto text-muted" title={m.createdAt}>
                              {relTime(m.createdAt)} ago
                            </span>
                          </div>
                          <p className="text-sm mt-0.5 whitespace-pre-wrap">{m.body || "(no body)"}</p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!response && !loading && (
        <div className="text-center text-xs text-muted pt-4">
          Substring matches work — &quot;lacquer&quot; finds &quot;Lacquer Lounge LLC&quot;.
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
        active
          ? "bg-brandSoft text-brand font-semibold"
          : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
