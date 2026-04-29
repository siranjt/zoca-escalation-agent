"use client";

import { useEffect, useState } from "react";

interface Check {
  ok: boolean;
  detail: string;
  hint?: string;
}

interface HealthResponse {
  ok: boolean;
  checks: {
    anthropic: Check;
    chargebee: Check;
    linear: Check;
  };
}

const SERVICES: { key: keyof HealthResponse["checks"]; label: string; usedFor: string }[] = [
  { key: "anthropic", label: "Anthropic", usedFor: "Triage, summary, draft reply" },
  { key: "chargebee", label: "Chargebee", usedFor: "Subscription, invoices, ACH" },
  { key: "linear", label: "Linear", usedFor: "Per-customer tickets, /tickets page" },
];

export default function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
      // Auto-expand the panel if anything is down so the user sees the hint.
      if (!data.ok) setExpanded(true);
    } catch (e: any) {
      setError(e?.message || "Network error reaching /api/health");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-panel px-4 py-2 text-xs text-muted">
        Checking integrations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-err/40 bg-err/10 px-4 py-2 text-xs text-err">
        Health check failed: {error}
      </div>
    );
  }
  if (!health) return null;

  const anyDown = !health.ok;
  const downCount = SERVICES.filter((s) => !health.checks[s.key]?.ok).length;

  return (
    <div
      className={`rounded-2xl border ${
        anyDown ? "border-err/40 bg-err/5" : "border-border bg-panel"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-muted">Integrations</span>
          {SERVICES.map((s) => {
            const c = health.checks[s.key];
            return (
              <span key={s.key} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    c?.ok ? "bg-ok" : "bg-err"
                  }`}
                  aria-hidden
                />
                <span className={c?.ok ? "text-muted" : "text-err"}>{s.label}</span>
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${anyDown ? "text-err" : "text-muted"}`}>
            {anyDown
              ? `${downCount} ${downCount === 1 ? "issue" : "issues"} — click for fix`
              : "All OK"}
          </span>
          <span className="text-muted text-xs">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2 text-xs">
          {SERVICES.map((s) => {
            const c = health.checks[s.key];
            const okCls = c?.ok ? "text-ok" : "text-err";
            return (
              <div key={s.key} className="rounded-lg border border-border bg-panel2 p-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      c?.ok ? "bg-ok" : "bg-err"
                    } translate-y-[1px]`}
                    aria-hidden
                  />
                  <strong className="text-text">{s.label}</strong>
                  <span className="text-muted">· {s.usedFor}</span>
                </div>
                <p className={`mt-1 ${okCls}`}>{c?.detail}</p>
                {c?.hint && <p className="mt-1 text-muted">Hint: {c.hint}</p>}
              </div>
            );
          })}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                load();
              }}
              className="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-muted hover:text-text disabled:opacity-50"
            >
              {refreshing ? "Re-checking…" : "Re-check"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
