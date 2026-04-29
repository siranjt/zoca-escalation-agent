// GET /api/tickets
//   ?patterns=churn,retention_risk,subscription_support,paid_offboarding   (comma-separated, optional)
//   ?status=open|started|completed|cancelled                                (comma-separated, optional)
//   ?sinceDays=30                                                           (default 0 = no cutoff)
//   ?limit=100                                                              (default 100, max 250)
//
// Returns Finance-team Linear tickets whose title matches the requested
// patterns, sorted latest-first (by updatedAt desc).

import { NextRequest, NextResponse } from "next/server";
import {
  fetchEscalationTickets,
  classifyPattern,
  type LinearTicket,
  type TitlePattern,
} from "@/lib/linear";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALL_PATTERNS: TitlePattern[] = [
  "churn",
  "retention_risk",
  "subscription_support",
  "paid_offboarding",
];

const STATUS_TYPES = new Set([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
  "triage",
]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const patternsParam = (url.searchParams.get("patterns") || "").trim();
  const statusParam = (url.searchParams.get("status") || "").trim();
  const sinceDays = Number(url.searchParams.get("sinceDays") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "100");

  const patterns: TitlePattern[] = patternsParam
    ? patternsParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is TitlePattern => (ALL_PATTERNS as string[]).includes(s))
    : ALL_PATTERNS;

  const statuses = statusParam
    ? new Set(
        statusParam
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => STATUS_TYPES.has(s))
      )
    : null;

  try {
    const all = await fetchEscalationTickets({
      patterns,
      sinceDays,
      limit: Math.max(limit, 100), // pull more, then status-filter client-side
    });

    const filtered = statuses
      ? all.filter((t) => statuses.has(t.state.type.toLowerCase()))
      : all;

    const limited = filtered.slice(0, limit);

    const stats = computeStats(limited);

    return NextResponse.json({
      ok: true,
      teams: ["Finance", "Customer Success"],
      patterns,
      sinceDays,
      tickets: limited,
      stats,
      sortedBy: "updatedAt desc (latest first)",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

function computeStats(tickets: LinearTicket[]) {
  const byStatus: Record<string, number> = {};
  const byPattern: Record<string, number> = {
    churn: 0,
    retention_risk: 0,
    subscription_support: 0,
    paid_offboarding: 0,
  };
  for (const t of tickets) {
    const k = t.state.type || "unknown";
    byStatus[k] = (byStatus[k] || 0) + 1;
    for (const p of classifyPattern(t.title)) byPattern[p]++;
  }
  return { total: tickets.length, byStatus, byPattern };
}
