"use client";

import { useMemo, useState } from "react";

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
  priority: number;
  priorityLabel: string;
  createdAt: string;
  updatedAt: string;
  state: { name: string; type: string };
  team: { id: string; name: string; key: string };
  assignee: { name: string; email: string } | null;
  labels: string[];
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
  reason?: string; // when skipped
}

const CHANNELS: { key: Channel; label: string; cls: string }[] = [
  { key: "app_chat", label: "App Chat", cls: "bg-accent/15 text-accent border-accent/40" },
  { key: "email", label: "Email", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40" },
  { key: "phone", label: "Phone", cls: "bg-ok/15 text-ok border-ok/40" },
  { key: "video", label: "Video", cls: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
  { key: "sms", label: "SMS", cls: "bg-warn/15 text-warn border-warn/40" },
];

const SENDERS: { key: Sender; label: string; cls: string }[] = [
  { key: "client", label: "Client", cls: "bg-pink-500/15 text-pink-300 border-pink-500/40" },
  { key: "team", label: "Team", cls: "bg-teal-500/15 text-teal-300 border-teal-500/40" },
  { key: "unknown", label: "Unknown", cls: "bg-panel2 text-muted border-border" },
];

const TIME_WINDOWS = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "1 year" },
  { key: "0", label: "All time" },
];

function relTime(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "";
  const sec = Math.floor((Date.now() - d) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function fmtDuration(sec?: number): string {
  if (!sec || sec < 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export default function EscalationsBrowser() {
  const [query, setQuery] = useState("");
  const [sinceDays, setSinceDays] = useState("365");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  // Triage state — runs as phase-2 after the customer/comms/tickets phase 1.
  const [triage, setTriage] = useState<TriageState>({ status: "idle", sourceMessage: null, result: null });

  // Per-channel "retry" busy state
  const [retrying, setRetrying] = useState<Set<Channel>>(new Set());

  // Filters (client-side)
  const [channelFilter, setChannelFilter] = useState<Set<Channel>>(new Set(CHANNELS.map((c) => c.key)));
  const [senderFilter, setSenderFilter] = useState<Sender | "all">("client");
  const [textFilter, setTextFilter] = useState("");

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);
    setTriage({ status: "idle", sourceMessage: null, result: null });

    let phase1: ApiResponse | null = null;
    try {
      const url = new URL("/api/escalations", window.location.origin);
      url.searchParams.set("q", query.trim());
      url.searchParams.set("sinceDays", sinceDays);
      const res = await fetch(url.toString());
      const text = await res.text();
      try {
        phase1 = JSON.parse(text) as ApiResponse;
        setResponse(phase1);
      } catch {
        setResponse({
          ok: false,
          error:
            "The server returned a non-JSON response (likely a Vercel function timeout). Try again — the CSV cache should be primed now and the next call will be much faster. Or load each channel individually via the retry buttons.",
        });
      }
    } catch (err: any) {
      setResponse({ ok: false, error: err?.message || "Network error" });
    } finally {
      setLoading(false);
    }

    // PHASE 2 — auto-triage the latest customer-initiated message.
    if (phase1?.ok && phase1.customer && phase1.comms) {
      const latestClient = phase1.comms.find((m) => m.sender === "client");
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
      // Merge: replace this channel's messages in the existing response.
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

  const filtered = useMemo(() => {
    if (!response?.comms) return [];
    const t = textFilter.trim().toLowerCase();
    const out = response.comms.filter((m) => {
      if (!channelFilter.has(m.channel)) return false;
      if (senderFilter !== "all" && m.sender !== senderFilter) return false;
      if (t && !(m.body || "").toLowerCase().includes(t)) return false;
      return true;
    });
    // Defensive re-sort so the timeline is always latest-first regardless of
    // server-side ordering quirks.
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }, [response, channelFilter, senderFilter, textFilter]);

  function toggleChannel(c: Channel) {
    setChannelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const abortedChannels: Channel[] = response?.perChannelStatus
    ? (Object.entries(response.perChannelStatus) as [Channel, ChannelStatus][])
        .filter(([, s]) => s?.aborted)
        .map(([ch]) => ch)
    : [];

  return (
    <div className="space-y-6">
      {/* SEARCH */}
      <form onSubmit={lookup} className="rounded-2xl border border-border bg-panel p-6">
        <label className="block text-sm text-muted mb-2">Search</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-panel2 px-3 py-2 outline-none focus:border-accent"
            placeholder="Lacquer Lounge   ·   8e3f…   ·   owner@bizname.com   ·   AbCdEf123"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            className="rounded-lg border border-border bg-panel2 px-3 py-2 outline-none focus:border-accent"
            value={sinceDays}
            onChange={(e) => setSinceDays(e.target.value)}
            title="Time window"
          >
            {TIME_WINDOWS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-accent text-white px-4 font-medium disabled:opacity-50"
          >
            {loading ? "Looking up…" : "Look up"}
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          Heads-up: the comms feeds are large (~130 MB each). The first lookup after a redeploy
          may time out as Vercel warms its edge cache — just retry. Subsequent lookups are fast
          for 24 hours.
        </p>
      </form>

      {!response && !loading && (
        <div className="rounded-2xl border border-border bg-panel p-6 text-muted">
          Results will appear here. Tip: substring matches work for biz names, so "lacquer"
          finds "Lacquer Lounge LLC".
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-border bg-panel p-6 text-muted">
          Streaming the 5 comms feeds for that entity. First call after a redeploy can take
          30–60 seconds; second call is instant.
        </div>
      )}

      {response && response.ok === false && (
        <div className="rounded-2xl border border-err/40 bg-err/10 p-6">
          <p className="text-err font-medium">Error</p>
          <p className="text-sm mt-2 whitespace-pre-wrap">{response.error}</p>
        </div>
      )}

      {response && response.ok && !response.customer && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 p-6">
          <p className="font-medium text-warn">No customer match</p>
          <p className="text-sm text-muted mt-2">
            Couldn't find anyone in BaseSheet for "{response.query}". Try a different spelling,
            an email, or paste the entity UUID.
          </p>
        </div>
      )}

      {response && response.ok && response.customer && (
        <>
          {/* CUSTOMER CARD */}
          <div className="rounded-2xl border border-border bg-panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium">{response.customer.bizName || "(no name)"}</h2>
                <p className="text-sm text-muted mt-1">
                  {response.customer.email && (
                    <span>
                      <span className="text-text">{response.customer.email}</span>
                      {response.customer.phone ? <span> · {response.customer.phone}</span> : null}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted mt-2">
                  entity_id <code className="text-text">{response.customer.entityId || "—"}</code>
                  {response.customer.customerId ? (
                    <>
                      {" · "}cb_id <code className="text-text">{response.customer.customerId}</code>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="text-right text-sm">
                {response.customer.amName && (
                  <p>
                    <span className="text-muted">AM</span> {response.customer.amName}
                  </p>
                )}
                {response.customer.spName && (
                  <p>
                    <span className="text-muted">SP</span> {response.customer.spName}
                  </p>
                )}
                {response.customer.aeName && (
                  <p>
                    <span className="text-muted">AE</span> {response.customer.aeName}
                  </p>
                )}
                {response.customer.status && (
                  <p className="mt-1 text-xs text-muted">status: {response.customer.status}</p>
                )}
                {typeof response.customer.monthlyRevenue === "number" && (
                  <p className="text-xs text-muted">
                    MRR ${response.customer.monthlyRevenue.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {response.matches && response.matches.length > 1 && (
              <div className="mt-4 text-xs text-muted">
                <p className="mb-1">{response.matches.length} matches found. Showing first; others:</p>
                <ul className="list-disc list-inside">
                  {response.matches.slice(1).map((m) => (
                    <li key={m.entityId}>
                      <span className="text-text">{m.bizName}</span> — {m.email || "(no email)"} ·{" "}
                      <code>{m.entityId.slice(0, 8)}…</code>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-muted">
                  To pin to one, paste their full <code>entity_id</code> in the search box.
                </p>
              </div>
            )}

            {response.lookupNotes && response.lookupNotes.length > 0 && (
              <div className="mt-3 text-xs text-muted">
                {response.lookupNotes.map((n, i) => (
                  <p key={i}>· {n}</p>
                ))}
              </div>
            )}
          </div>

          {/* PARTIAL-RESULTS / RETRY PER CHANNEL */}
          {abortedChannels.length > 0 && (
            <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4">
              <p className="text-sm text-warn font-medium mb-2">
                {abortedChannels.length} channel{abortedChannels.length === 1 ? "" : "s"} timed out
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {abortedChannels.map((ch) => {
                  const meta = CHANNELS.find((c) => c.key === ch);
                  const busy = retrying.has(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => retryChannel(ch)}
                      disabled={busy}
                      className={`rounded-full border px-3 py-1 ${meta?.cls || ""} disabled:opacity-50`}
                    >
                      {busy ? `Loading ${meta?.label}…` : `Retry ${meta?.label}`}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-2">
                Each retry runs that channel solo with a 50s budget — usually fast once the cache
                is warm.
              </p>
            </div>
          )}

          {/* AUTO-TRIAGE of the latest client message */}
          {triage.status !== "idle" && (
            <div className="rounded-2xl border border-border bg-panel p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-base font-medium">Triage of latest client message</h3>
                {triage.result && (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                      triage.result.severity === "P0"
                        ? "bg-err/20 text-err border-err/40"
                        : triage.result.severity === "P1"
                          ? "bg-warn/20 text-warn border-warn/40"
                          : triage.result.severity === "P2"
                            ? "bg-accent/20 text-accent border-accent/40"
                            : "bg-panel2 text-muted border-border"
                    }`}
                  >
                    {triage.result.severity}
                  </span>
                )}
              </div>

              {triage.status === "loading" && (
                <p className="text-sm text-muted">
                  Running the agent on this customer's most recent message
                  {triage.sourceMessage ? ` (${triage.sourceMessage.channel}, ${relTime(triage.sourceMessage.createdAt)})…` : "…"}
                </p>
              )}

              {triage.status === "skipped" && (
                <p className="text-sm text-muted">{triage.reason || "No client message available."}</p>
              )}

              {triage.status === "error" && (
                <p className="text-sm text-err">
                  Triage failed: {triage.error}
                </p>
              )}

              {triage.status === "ready" && triage.result && triage.sourceMessage && (
                <div className="space-y-4 text-sm">
                  {/* Source message */}
                  <div className="rounded-lg border border-border bg-panel2 p-3">
                    <div className="flex items-baseline gap-2 text-xs">
                      <span className="text-muted">Source message ·</span>
                      <span className="text-text capitalize">{triage.sourceMessage.channel.replace("_", " ")}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted" title={triage.sourceMessage.createdAt}>
                        {relTime(triage.sourceMessage.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-text">
                      {triage.sourceMessage.body || "(empty body)"}
                    </p>
                  </div>

                  {/* Category + owner */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-muted text-xs mb-1">Category</p>
                      <p className="capitalize">{triage.result.category.replace(/_/g, " ")}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Suggested owner</p>
                      <p>
                        <span className="font-medium">
                          {triage.result.ownerSuggestion.namedPerson || triage.result.ownerSuggestion.role}
                        </span>
                        {triage.result.ownerSuggestion.namedPerson ? (
                          <span className="text-muted"> · {triage.result.ownerSuggestion.role}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted mt-1">{triage.result.ownerSuggestion.rationale}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <p className="text-muted text-xs mb-1">Summary</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{triage.result.summary}</p>
                  </div>

                  {/* Draft reply */}
                  <div>
                    <p className="text-muted text-xs mb-1">
                      Draft reply ({triage.result.draftReply.channel}
                      {triage.result.draftReply.subject ? ` · "${triage.result.draftReply.subject}"` : ""})
                    </p>
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg border border-border bg-panel2 p-3">
{triage.result.draftReply.body}
                    </pre>
                  </div>

                  {/* Auto-resolve */}
                  <div className="text-xs">
                    <p className="text-muted mb-1">Auto-resolve</p>
                    <p>
                      <span
                        className={triage.result.autoResolvable.eligible ? "text-ok font-medium" : "text-muted font-medium"}
                      >
                        {triage.result.autoResolvable.eligible ? "Eligible" : "Not eligible"}
                      </span>{" "}
                      <span className="text-muted">
                        ({(triage.result.autoResolvable.confidence * 100).toFixed(0)}% confidence)
                      </span>
                    </p>
                    <p className="text-muted mt-1">{triage.result.autoResolvable.reason}</p>
                  </div>

                  {/* Routing */}
                  {triage.result.routing.actions.length > 0 && (
                    <div>
                      <p className="text-muted text-xs mb-1">Routing actions</p>
                      <ul className="text-sm space-y-2">
                        {triage.result.routing.actions.map((a: any, i: number) => (
                          <li key={i} className="rounded-lg border border-border bg-panel2 p-3">
                            <p className="text-xs uppercase text-muted">{a.type}</p>
                            {a.type === "slack_dm" && (
                              <p>
                                <strong>{a.to}</strong>: {a.message}
                              </p>
                            )}
                            {a.type === "slack_channel" && (
                              <p>
                                <strong>#{a.channel}</strong>: {a.message}
                              </p>
                            )}
                            {a.type === "linear_issue" && (
                              <>
                                <p>
                                  <strong>
                                    {a.team ? `${a.team} · ` : ""}
                                    {a.title}
                                  </strong>
                                </p>
                                <p className="text-muted whitespace-pre-wrap mt-1">{a.body}</p>
                                {a.labels?.length ? (
                                  <p className="text-xs text-muted mt-1">labels: {a.labels.join(", ")}</p>
                                ) : null}
                              </>
                            )}
                            {a.type === "email" && (
                              <>
                                <p>
                                  <strong>{a.to}</strong> — {a.subject}
                                </p>
                                <p className="text-muted whitespace-pre-wrap mt-1">{a.body}</p>
                              </>
                            )}
                            {a.type === "noop" && <p className="text-muted">{a.reason}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* LINEAR TICKETS for this customer */}
          {response.tickets && response.tickets.length > 0 && (
            <div className="rounded-2xl border border-border bg-panel p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-base font-medium">Linear tickets for this customer</h3>
                <span className="text-xs text-muted">
                  {response.tickets.length} match{response.tickets.length === 1 ? "" : "es"} · sorted latest first
                </span>
              </div>
              <ul className="space-y-2">
                {response.tickets.map((t) => {
                  const statusCls =
                    t.state.type === "completed"
                      ? "bg-ok/15 text-ok border-ok/40"
                      : t.state.type === "started"
                        ? "bg-accent/15 text-accent border-accent/40"
                        : t.state.type === "cancelled"
                          ? "bg-err/15 text-err border-err/40"
                          : "bg-panel2 text-text border-border";
                  return (
                    <li
                      key={t.id}
                      className="rounded-lg border border-border bg-panel2 px-3 py-2"
                    >
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-muted">{t.identifier}</span>
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${statusCls}`}
                        >
                          {t.state.name}
                        </span>
                        <span className="text-muted">{t.team.name}</span>
                        {t.priorityLabel && t.priorityLabel !== "No priority" && (
                          <span className="inline-flex items-center rounded-md border border-warn/40 bg-warn/10 text-warn px-1.5 py-0.5">
                            {t.priorityLabel}
                          </span>
                        )}
                        <span className="ml-auto text-muted" title={t.updatedAt}>
                          {relTime(t.updatedAt)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium hover:underline underline-offset-4"
                        >
                          {t.title}
                        </a>
                      </div>
                      {t.assignee?.name && (
                        <p className="mt-1 text-xs text-muted">
                          <span className="text-muted">Assigned</span>{" "}
                          <span className="text-text">{t.assignee.name}</span>
                          {t.labels.length > 0 && (
                            <>
                              {" · "}
                              <span className="text-muted">Labels</span> {t.labels.join(", ")}
                            </>
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted mt-3">
                Matches by entity_id in description or business name in title — across Finance + CX
                teams, all four escalation patterns.
              </p>
            </div>
          )}

          {response.tickets && response.tickets.length === 0 && response.customer.entityId && (
            <div className="rounded-2xl border border-border bg-panel p-4 text-xs text-muted">
              No Linear escalation tickets found for this customer (Finance + CX teams, all four
              patterns).
            </div>
          )}

          {/* STATS */}
          {response.stats && (
            <div className="rounded-2xl border border-border bg-panel p-6">
              <p className="text-muted text-sm mb-3">
                {response.stats.total} message{response.stats.total === 1 ? "" : "s"} in window
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {CHANNELS.map((c) => {
                  const n = response.stats!.byChannel[c.key] || 0;
                  const aborted = response.perChannelStatus?.[c.key]?.aborted;
                  return (
                    <span
                      key={c.key}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${c.cls} ${aborted ? "opacity-50" : ""}`}
                      title={aborted ? "Channel timed out — retry above" : ""}
                    >
                      {c.label} <span className="font-semibold">{n}</span>
                      {aborted ? <span className="text-warn">·timed out</span> : null}
                    </span>
                  );
                })}
                <span className="mx-2 text-muted">·</span>
                {SENDERS.map((s) => {
                  const n = response.stats!.bySender[s.key] || 0;
                  return (
                    <span
                      key={s.key}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${s.cls}`}
                    >
                      {s.label} <span className="font-semibold">{n}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* FILTERS */}
          <div className="rounded-2xl border border-border bg-panel p-6 space-y-4">
            <div>
              <p className="text-muted text-sm mb-2">Channels</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {CHANNELS.map((c) => {
                  const on = channelFilter.has(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleChannel(c.key)}
                      className={`rounded-full border px-3 py-1 ${
                        on ? c.cls : "border-border text-muted bg-panel2"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-muted text-sm mb-2">Sender</p>
              <div className="flex gap-2 text-xs">
                {(["all", "client", "team", "unknown"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSenderFilter(s)}
                    className={`rounded-full border px-3 py-1 ${
                      senderFilter === s
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-muted bg-panel2"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-muted text-sm mb-2">Search inside messages</p>
              <input
                className="w-full rounded-lg border border-border bg-panel2 px-3 py-2 outline-none focus:border-accent"
                placeholder="e.g. refund, cancel, charge…"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
              />
            </div>
          </div>

          {/* TIMELINE */}
          <div className="rounded-2xl border border-border bg-panel">
            <div className="px-4 py-2 border-b border-border text-xs text-muted flex items-center justify-between">
              <span>Sorted latest first (newest at top)</span>
              <span>{filtered.length} of {response.comms?.length ?? 0} shown</span>
            </div>
            {filtered.length === 0 ? (
              <p className="p-6 text-muted text-sm">
                No messages match these filters. Loosen the filters or expand the time window above.
              </p>
            ) : (
              <ul>
                {filtered.map((m, i) => {
                  const cMeta = CHANNELS.find((c) => c.key === m.channel);
                  const sMeta = SENDERS.find((s) => s.key === m.sender);
                  return (
                    <li
                      key={`${m.createdAt}-${i}`}
                      className="border-b border-border last:border-b-0 px-4 py-3"
                    >
                      <div className="flex items-baseline gap-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${cMeta?.cls || ""}`}
                        >
                          {cMeta?.label || m.channel}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${sMeta?.cls || ""}`}
                        >
                          {sMeta?.label || m.sender}
                        </span>
                        {m.durationSec ? (
                          <span className="text-muted">{fmtDuration(m.durationSec)}</span>
                        ) : null}
                        <span className="ml-auto text-muted" title={m.createdAt}>
                          {relTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1.5 whitespace-pre-wrap">{m.body || "(no body)"}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
