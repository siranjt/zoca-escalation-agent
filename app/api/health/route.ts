// GET /api/health
//
// Diagnostic endpoint. Pings each upstream service with the smallest possible
// call and reports per-key health. Use this to verify env vars after editing
// them on Vercel — much faster than waiting for a real search to fail.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, describeKeyProblem } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CheckResult {
  ok: boolean;
  detail: string;
  hint?: string;
}

async function checkAnthropic(): Promise<CheckResult> {
  const { key, sanitized } = getAnthropicApiKey();
  const fmt = describeKeyProblem(key);
  if (fmt) return { ok: false, detail: fmt };

  try {
    const client = new Anthropic({ apiKey: key });
    // Tiny ping — 1 token output is enough to verify auth.
    await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return {
      ok: true,
      detail: sanitized
        ? "Authenticated (sanitized whitespace/quotes from env var)."
        : "Authenticated.",
    };
  } catch (err: any) {
    const status = err?.status || err?.response?.status;
    if (status === 401) {
      return {
        ok: false,
        detail: `401 invalid x-api-key${sanitized ? " (even after stripping whitespace/quotes)" : ""}`,
        hint:
          "Generate a fresh key at https://console.anthropic.com/settings/keys, paste it into Vercel ANTHROPIC_API_KEY without quotes/spaces, then redeploy.",
      };
    }
    if (status === 402) {
      return {
        ok: false,
        detail: "402 — Anthropic account out of credits.",
        hint: "Top up at https://console.anthropic.com/settings/billing.",
      };
    }
    if (status === 429) {
      return { ok: false, detail: "429 rate-limited. Try again in a moment." };
    }
    return { ok: false, detail: err?.message || "Unknown failure" };
  }
}

async function checkChargebee(): Promise<CheckResult> {
  const apiKey = (process.env.CHARGEBEE_API_KEY || "").replace(/^['"\s]+|['"\s]+$/g, "");
  const site = (process.env.CHARGEBEE_SITE || "zoca").trim();
  if (!apiKey) return { ok: false, detail: "CHARGEBEE_API_KEY not set." };

  try {
    const auth = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
    const res = await fetch(`https://${site}.chargebee.com/api/v2/customers?limit=1`, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (res.ok) return { ok: true, detail: `Authenticated (site=${site}).` };
    if (res.status === 401)
      return {
        ok: false,
        detail: "401 — Chargebee rejected the API key.",
        hint: "Re-copy the live API key from Chargebee → Settings → API Keys, paste into Vercel CHARGEBEE_API_KEY.",
      };
    return { ok: false, detail: `Chargebee returned ${res.status}.` };
  } catch (err: any) {
    return { ok: false, detail: err?.message || "Network failure to Chargebee." };
  }
}

async function checkLinear(): Promise<CheckResult> {
  const apiKey = (process.env.LINEAR_API_KEY || "").replace(/^['"\s]+|['"\s]+$/g, "");
  if (!apiKey)
    return {
      ok: false,
      detail: "LINEAR_API_KEY not set — /tickets and the per-customer ticket panel will be empty.",
    };

  try {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ query: "query { viewer { id name } }" }),
    });
    if (!res.ok) {
      if (res.status === 401)
        return {
          ok: false,
          detail: "401 — Linear rejected the API key.",
          hint: "Generate a new personal API key at https://linear.app/settings/api (starts with lin_api_…), paste into Vercel LINEAR_API_KEY.",
        };
      return { ok: false, detail: `Linear returned ${res.status}.` };
    }
    const data = await res.json();
    if (data.errors?.length) {
      return { ok: false, detail: `Linear GraphQL: ${data.errors[0].message}` };
    }
    const name = data.data?.viewer?.name || "(unknown)";
    return { ok: true, detail: `Authenticated as ${name}.` };
  } catch (err: any) {
    return { ok: false, detail: err?.message || "Network failure to Linear." };
  }
}

export async function GET() {
  const [anthropic, chargebee, linear] = await Promise.all([
    checkAnthropic(),
    checkChargebee(),
    checkLinear(),
  ]);
  const checks = { anthropic, chargebee, linear };
  const ok = anthropic.ok && chargebee.ok && linear.ok;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
