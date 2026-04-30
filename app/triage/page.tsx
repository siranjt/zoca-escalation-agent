"use client";

import { useState } from "react";
import EscalationForm from "@/components/EscalationForm";
import ResultPanel from "@/components/ResultPanel";
import HealthBadge from "@/components/HealthBadge";
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
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3 text-text">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/zoca-logo.svg" alt="Zoca" width={81} height={20} className="h-5 w-auto" style={{ color: "currentColor" }} />
          </div>
          <div className="flex items-center gap-6">
            <a href="/queue" className="text-sm text-muted2 hover:text-text transition-colors font-medium">Queue</a>
            <a href="/" className="text-sm text-muted2 hover:text-text transition-colors">Customer 360</a>
            <a href="/tickets" className="text-sm text-muted2 hover:text-text transition-colors">All tickets</a>
            <HealthBadge />
          </div>
        </header>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight">Triage by message</h1>
          <p className="mt-3 max-w-[560px] mx-auto text-sm text-muted2 leading-relaxed">
            Paste an escalation that arrived outside Zoca's recorded channels (forwarded email, Slack
            DM, etc). The agent identifies the customer if any hints match, pulls their context,
            then returns triage + draft reply + routing.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <EscalationForm onSubmit={handleSubmit} disabled={loading} />
          <ResultPanel loading={loading} response={response} />
        </div>
      </div>
    </main>
  );
}
