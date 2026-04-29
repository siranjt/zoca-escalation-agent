# Zoca Escalation Agent

A small Next.js app that takes any incoming customer message ("an escalation"), figures out who the customer is, pulls their Chargebee + Metabase + comms history, and returns:

- **Triage** — severity (P0–P3) and category
- **Owner suggestion** — named AM if available, otherwise role
- **Customer summary** — 4–6 sentence brief for the owner
- **Draft reply** — channel-aware, plain-text, ready for review
- **Auto-resolve flag** — eligibility + confidence (only auto-send above 0.85)
- **Routing actions** — Slack DM / channel post / Linear issue / email

There's a web UI at `/` for pasting an escalation manually, plus three API endpoints:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/escalation` | POST | Main entrypoint: `{ text, customerHint?, source? }` |
| `/api/customer/[id]` | GET | Quick lookup by Chargebee customer id, entity UUID, or email |
| `/api/webhook` | POST | Generic webhook receiver (Slack handshake supported) |

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS for styling
- `@anthropic-ai/sdk` — single tool-use call returns the structured report
- Chargebee REST v2 (basic auth)
- Metabase public CSV endpoints (BaseSheet + 5 comms feeds)

No database. State is reconstructed from Chargebee + Metabase on each call. Comms CSVs are cached for 2 minutes at the edge so a flurry of escalations doesn't re-download the full feed.

## Local development

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env.local
#   - ANTHROPIC_API_KEY      (required)
#   - CHARGEBEE_API_KEY      (required for live data)
#   - METABASE_SESSION_TOKEN (only if you query non-public Metabase cards)

# 3. Run
npm run dev
# open http://localhost:3000
```

## Deploying — GitHub + Vercel

You'll do this part yourself. Here's the path I'd take.

### Push to GitHub

```bash
cd zoca-escalation-agent
git init
git add .
git commit -m "Initial commit: Zoca escalation agent"
git branch -M main

# Create the repo on GitHub first (call it `zoca-escalation-agent`),
# then add it as remote and push:
git remote add origin https://github.com/<YOUR_USERNAME>/zoca-escalation-agent.git
git push -u origin main
```

### Import to Vercel

1. Go to <https://vercel.com/new> and select your `zoca-escalation-agent` repo.
2. Framework preset: **Next.js** (auto-detected). Root directory: `./`. Build command: default.
3. Click **Environment Variables** and add (Production + Preview both):
   - `ANTHROPIC_API_KEY`
   - `CHARGEBEE_API_KEY`
   - `CHARGEBEE_SITE` = `zoca`
   - `METABASE_BASE_URL` = `https://metabase.zoca.ai`
   - `METABASE_SESSION_TOKEN` (optional)
   - `WEBHOOK_SHARED_SECRET` (optional, recommended if you'll wire up real webhooks)
4. Deploy. The first build takes ~60s.
5. Once deployed, your routes are live at:
   - `https://<your-project>.vercel.app/` — UI
   - `https://<your-project>.vercel.app/api/escalation` — main API
   - `https://<your-project>.vercel.app/api/webhook` — webhook receiver

> **Note**: `maxDuration` on the API routes is set to 60s. That's the cap for Vercel's Pro plan; on Hobby it'll be capped at 10s, which may not be enough on cold starts. Bump to Pro or trim the comms-history pull (`perChannelLimit` in `lib/metabase.ts`) if you hit timeouts.

## Wiring real escalation sources

The webhook endpoint at `/api/webhook` is intentionally lenient — it accepts:

**Slack Events API** — point a Slack app's Event Subscription URL at it. URL verification is handled. For real production use, also verify the `X-Slack-Signature` header (not yet implemented; add before pointing real Slack at it).

**Generic JSON** — any service that can POST `{ text, email?, customerId?, entityId?, bizName?, source? }` works.

**Plain text** — falls back to using the body as the escalation text.

If `WEBHOOK_SHARED_SECRET` is set, requests must include `X-Zoca-Webhook-Secret: <value>`.

## How the agent decides things

`lib/agent.ts` makes a single `messages.create` call with `tool_choice: { type: "tool", name: "report" }`. The model is forced to return a `report` tool_use block whose JSON schema matches `AgentResult`. This way:

- We never get loose prose — output is always parseable.
- The schema constrains severity to `P0..P3`, category to a fixed set, etc.
- The system prompt gives crisp definitions of the severity rungs and the auto-resolve guardrails (no refunds, no roadmap promises, no SLA commitments).

The LLM only sees what we hand it via `buildContextPrompt(ctx)` — Chargebee customer, active subscription, unpaid invoices, derived signals, and up to 60 capped comms messages from the last 90 days. That's what keeps it honest about not inventing facts.

## File map

```
app/
  layout.tsx                 root html
  page.tsx                   dashboard
  globals.css                tailwind base
  api/
    escalation/route.ts      POST — main agent entrypoint
    customer/[id]/route.ts   GET  — lookup-only
    webhook/route.ts         POST — generic + Slack handshake
components/
  EscalationForm.tsx         input form
  ResultPanel.tsx            result viewer
lib/
  types.ts                   shared types
  chargebee.ts               REST client (customers, subs, invoices, txns)
  metabase.ts                CSV parser + BaseSheet + comms feeds
  enrichment.ts              builds CustomerContext from a hint
  agent.ts                   single Anthropic tool-use call
```

## Roadmap (things deliberately not built yet)

- **Actually executing** the routing actions (currently just recommended). Wire `routing.actions[]` to Slack / Linear / Gmail when you're ready.
- **Slack signature verification** in `/api/webhook`.
- **Persist runs** to a database for review queues, KPIs, and auto-resolve audits.
- **Rate limiting** the comms CSV downloads — fine at low volume, but if you point this at Slack with a busy event subscription you'll want to add a queue.
