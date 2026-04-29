"use client";

import { useState } from "react";
import EscalationForm from "@/components/EscalationForm";
import ResultPanel from "@/components/ResultPanel";
import type { AgentResult } from "@/lib/types";

interface ApiResponse {
  ok: boolean;
  context?: any;
  result?: AgentResult;
  error?: string;
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  async function handleSubmit(payload: {
    text: string;
    email: string;
    customerId: string;
    entityId: string;
    bizName: string;
    medium: string;
  }) {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: payload.text,
          customerHint: {
            email: payload.email || undefined,
            customerId: payload.customerId || undefined,
            entityId: payload.entityId || undefined,
            bizName: payload.bizName || undefined,
          },
          source: { medium: payload.medium || "form" },
        }),
      });
      const data = (await res.json()) as ApiResponse;
      setResponse(data);
    } catch (err: any) {
      setResponse({ ok: false, error: err?.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Zoca Escalation Agent</h1>
          <p className="text-muted mt-2">
            Paste an escalation from any channel. The agent will identify the customer, pull
            their Chargebee + comms history, then return triage, a summary, a draft reply, and
            a routing recommendation.
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted whitespace-nowrap">
          <a href="/escalations" className="hover:text-text underline-offset-4 hover:underline font-medium">
            Customer 360 →
          </a>
          <a href="/tickets" className="hover:text-text underline-offset-4 hover:underline">
            All tickets
          </a>
        </nav>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <EscalationForm onSubmit={handleSubmit} disabled={loading} />
        <ResultPanel loading={loading} response={response} />
      </div>

      <footer className="mt-16 text-xs text-muted">
        <p>
          API: <code className="text-text">POST /api/escalation</code> · webhooks at{" "}
          <code className="text-text">POST /api/webhook</code> · customer lookup at{" "}
          <code className="text-text">GET /api/customer/[id]</code>
        </p>
      </footer>
    </main>
  );
}
