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
    tickets: Check;
  };
}

const SERVICES: { key: keyof HealthResponse["checks"]; label: string; usedFor: string }[] = [
  { key: "anthropic", label: "Anthropic", usedFor: "Triage, summary, draft reply" },
  { key: "chargebee", label: "Chargebee", usedFor: "Subscription, invoices, ACH" },
  { key: "tickets", label: "Tickets", usedFor: "Per-customer tickets, /tickets" },
];

export default function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
      if (!data.ok) setOpen(true);
    } catch (e: any) {
      setError(e?.message || "Network error");
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
    return <span className="text-xs text-muted">Checking…</span>;
  }
  if (error) {
    return <span className="text-xs text-err">Health: {error}</span>;
  }
  if (!health) return null;

  const downCount = SERVICES.filter((s) => !health.checks[s.key]?.ok).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-2.5 py-1 text-xs hover:border-border2"
        aria-label="Integration health"
      >
        {SERVICES.map((s) => {
          const c = health.checks[s.key];
          return (
            <span key={s.key} className="flex items-center gap-1">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${c?.ok ? "bg-ok" : "bg-err"}`}
              />
              <span className={c?.ok ? "text-muted" : "text-err"}>{s.label}</span>
            </span>
          );
        })}
        {downCount > 0 && (
          <span className="ml-1 text-err">⚠</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] rounded-xl border border-border bg-panel p-3 shadow-xl z-20">
          <div className="space-y-2 text-xs">
            {SERVICES.map((s) => {
              const c = health.checks[s.key];
              const okCls = c?.ok ? "text-ok" : "text-err";
              return (
                <div key={s.key} className="rounded-lg border border-border bg-panel2 p-2.5">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${c?.ok ? "bg-ok" : "bg-err"} translate-y-[1px]`}
                    />
                    <strong className="font-medium text-text">{s.label}</strong>
                    <span className="text-muted">· {s.usedFor}</span>
                  </div>
                  <p className={`mt-1 ${okCls}`}>{c?.detail}</p>
                  {c?.hint && <p className="mt-1 text-muted">Hint: {c.hint}</p>}
                </div>
              );
            })}
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted hover:text-text"
              >
                Close
              </button>
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
        </div>
      )}
    </div>
  );
}
