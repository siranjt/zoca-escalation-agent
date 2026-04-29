"use client";

import { useEffect, useMemo, useState } from "react";

type TitlePattern = "churn" | "retention_risk" | "subscription_support" | "paid_offboarding";

interface Ticket {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  priorityLabel: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  startedAt: string | null;
  state: { name: string; type: string };
  team: { id: string; name: string; key: string };
  assignee: { name: string; email: string } | null;
  creator: { name: string } | null;
  labels: string[];
}

interface ApiResponse {
  ok: boolean;
  team?: { id: string; name: string };
  patterns?: TitlePattern[];
  sinceDays?: number;
  tickets?: Ticket[];
  stats?: {
    total: number;
    byStatus: Record<string, number>;
    byPattern: Record<string, number>;
  };
  sortedBy?: string;
  error?: string;
}

const PATTERNS: { key: TitlePattern; label: string; cls: string }[] = [
  { key: "churn", label: "Churn", cls: "bg-err/15 text-err border-err/40" },
  { key: "retention_risk", label: "Retention Risk", cls: "bg-warn/15 text-warn border-warn/40" },
  { key: "subscription_support", label: "Subscription Support", cls: "bg-accent/15 text-accent border-accent/40" },
  { key: "paid_offboarding", label: "Paid Offboarding", cls: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
];

const STATUS_GROUPS: { key: string; label: string; cls: string }[] = [
  { key: "unstarted", label: "Open", cls: "bg-panel2 text-text border-border" },
  { key: "started", label: "In Progress", cls: "bg-accent/15 text-accent border-accent/40" },
  { key: "completed", label: "Done", cls: "bg-ok/15 text-ok border-ok/40" },
  { key: "cancelled", label: "Cancelled", cls: "bg-err/15 text-err border-err/40" },
  { key: "backlog", label: "Backlog", cls: "bg-panel2 text-muted border-border" },
];

const TIME_WINDOWS = [
  { key: "0", label: "All time" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "1 year" },
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

function classifyPattern(title: string): TitlePattern[] {
  const t = (title || "").toLowerCase();
  const hits: TitlePattern[] = [];
  if (t.includes("churn")) hits.push("churn");
  if (t.includes("retention risk")) hits.push("retention_risk");
  if (t.includes("subscription support") || t.includes("subsciption_support"))
    hits.push("subscription_support");
  if (t.includes("paid_user_offboarding") || t.includes("offboarding"))
    hits.push("paid_offboarding");
  return hits;
}

export default function TicketsBrowser() {
  const [patternFilter, setPatternFilter] = useState<Set<TitlePattern>>(
    new Set(PATTERNS.map((p) => p.key))
  );
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(["unstarted", "started"])
  );
  const [sinceDays, setSinceDays] = useState("90");
  const [textFilter, setTextFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = new URL("/api/tickets", window.location.origin);
      if (patternFilter.size && patternFilter.size < PATTERNS.length) {
        url.searchParams.set("patterns", Array.from(patternFilter).join(","));
      }
      if (sinceDays !== "0") url.searchParams.set("sinceDays", sinceDays);
      url.searchParams.set("limit", "150");
      const res = await fetch(url.toString());
      const text = await res.text();
      try {
        setResponse(JSON.parse(text));
      } catch {
        setResponse({ ok: false, error: "Non-JSON response (likely a timeout)" });
      }
    } catch (err: any) {
      setResponse({ ok: false, error: err?.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinceDays]);

  const filtered = useMemo(() => {
    if (!response?.tickets) return [];
    const t = textFilter.trim().toLowerCase();
    return response.tickets.filter((tk) => {
      // Pattern filter — keep only tickets whose title matches at least one
      // currently-selected pattern.
      const tickPats = classifyPattern(tk.title);
      if (!tickPats.some((p) => patternFilter.has(p))) return false;
      if (statusFilter.size && !statusFilter.has(tk.state.type.toLowerCase())) return false;
      if (t) {
        const blob = `${tk.identifier} ${tk.title} ${tk.assignee?.name || ""} ${tk.assignee?.email || ""}`.toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [response, patternFilter, statusFilter, textFilter]);

  function togglePattern(p: TitlePattern) {
    setPatternFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }
  function toggleStatus(s: string) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* CONTROLS */}
      <div className="rounded-2xl border border-border bg-panel p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted text-sm">Title pattern</p>
          <div className="flex items-center gap-3">
            <select
              className="rounded-lg border border-border bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
              value={sinceDays}
              onChange={(e) => setSinceDays(e.target.value)}
              title="Time window (updatedAt)"
            >
              {TIME_WINDOWS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {PATTERNS.map((p) => {
            const on = patternFilter.has(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePattern(p.key)}
                className={`rounded-full border px-3 py-1 ${
                  on ? p.cls : "border-border text-muted bg-panel2"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div>
          <p className="text-muted text-sm mb-2">Status</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {STATUS_GROUPS.map((s) => {
              const on = statusFilter.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleStatus(s.key)}
                  className={`rounded-full border px-3 py-1 ${
                    on ? s.cls : "border-border text-muted bg-panel2"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-muted text-sm mb-2">Search (title / identifier / assignee)</p>
          <input
            className="w-full rounded-lg border border-border bg-panel2 px-3 py-2 outline-none focus:border-accent"
            placeholder="FIN-3901, churn, kanak…"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
          />
        </div>
      </div>

      {/* STATE */}
      {loading && !response && (
        <div className="rounded-2xl border border-border bg-panel p-6 text-muted">
          Loading Finance tickets from Linear…
        </div>
      )}

      {response && response.ok === false && (
        <div className="rounded-2xl border border-err/40 bg-err/10 p-6">
          <p className="text-err font-medium">Error</p>
          <p className="text-sm mt-2 whitespace-pre-wrap">{response.error}</p>
          <p className="text-xs text-muted mt-3">
            Make sure <code>LINEAR_API_KEY</code> is set in Vercel → Project Settings →
            Environment Variables, then redeploy.
          </p>
        </div>
      )}

      {/* RESULTS */}
      {response && response.ok && response.tickets && (
        <>
          {response.stats && (
            <div className="rounded-2xl border border-border bg-panel p-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-muted mr-2">
                  {filtered.length} / {response.stats.total} tickets · sorted latest first
                </span>
                {PATTERNS.map((p) => {
                  const n = response.stats!.byPattern[p.key] || 0;
                  return (
                    <span
                      key={p.key}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${p.cls}`}
                    >
                      {p.label} <span className="font-semibold">{n}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-panel p-2">
            {filtered.length === 0 ? (
              <p className="p-6 text-muted text-sm">
                No tickets match these filters. Try widening the time window, enabling more
                statuses, or clearing the search box.
              </p>
            ) : (
              <ul>
                {filtered.map((t) => {
                  const sMeta = STATUS_GROUPS.find((s) => s.key === t.state.type.toLowerCase());
                  const tickPats = classifyPattern(t.title);
                  return (
                    <li
                      key={t.id}
                      className="border-b border-border last:border-b-0 px-4 py-3 hover:bg-panel2/50"
                    >
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-muted">{t.identifier}</span>
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${sMeta?.cls || "border-border text-muted"}`}
                          title={`status type: ${t.state.type}`}
                        >
                          {sMeta?.label || t.state.name}
                        </span>
                        {t.team?.name && (
                          <span className="text-muted">{t.team.name}</span>
                        )}
                        {t.priorityLabel && t.priorityLabel !== "No priority" && (
                          <span className="inline-flex items-center rounded-md border border-warn/40 bg-warn/10 text-warn px-1.5 py-0.5">
                            {t.priorityLabel}
                          </span>
                        )}
                        {tickPats.map((p) => {
                          const meta = PATTERNS.find((x) => x.key === p);
                          return (
                            <span
                              key={p}
                              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${meta?.cls || ""}`}
                            >
                              {meta?.label}
                            </span>
                          );
                        })}
                        <span className="ml-auto text-muted" title={t.updatedAt}>
                          {relTime(t.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium hover:underline underline-offset-4"
                        >
                          {t.title}
                        </a>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        {t.assignee?.name && (
                          <span>
                            <span className="text-muted">Assigned</span>{" "}
                            <span className="text-text">{t.assignee.name}</span>
                          </span>
                        )}
                        {t.creator?.name && (
                          <span>
                            <span className="text-muted">By</span>{" "}
                            <span className="text-text">{t.creator.name}</span>
                          </span>
                        )}
                        {t.labels.length > 0 && (
                          <span>
                            <span className="text-muted">Labels</span> {t.labels.join(", ")}
                          </span>
                        )}
                        <span>
                          <span className="text-muted">Created</span> {relTime(t.createdAt)}
                        </span>
                      </div>
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
