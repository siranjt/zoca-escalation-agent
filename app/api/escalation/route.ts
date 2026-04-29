import { NextRequest, NextResponse } from "next/server";
import { buildContext } from "@/lib/enrichment";
import { runAgent } from "@/lib/agent";
import type { EscalationInput } from "@/lib/types";

export const runtime = "nodejs";
// Allow up to 60s — the comms-history pull can be heavy on cold starts.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: EscalationInput;
  try {
    body = (await req.json()) as EscalationInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string" || body.text.trim().length < 5) {
    return NextResponse.json(
      { error: "Field `text` is required and must be at least 5 characters." },
      { status: 400 }
    );
  }

  try {
    const ctx = await buildContext(body);
    const result = await runAgent(body, ctx);
    return NextResponse.json({
      ok: true,
      context: {
        // Only echo a small subset back for the UI (avoid leaking everything).
        customer: ctx.customer,
        subscription: ctx.subscription,
        unpaidInvoices: ctx.unpaidInvoices,
        signals: ctx.signals,
        commsCount: ctx.recentComms.length,
        lookupNotes: ctx.lookupNotes,
      },
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    description: "POST { text, customerHint?, source? } to triage an escalation.",
  });
}
