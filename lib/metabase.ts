// Metabase access — public CSV endpoints (no auth needed) plus a small CSV
// parser. We deliberately avoid `papaparse` etc. to keep bundle size low.

import type { Channel, CommsMessage } from "./types";

const PUBLIC = {
  baseSheet:
    "https://metabase.zoca.ai/public/question/87763e8c-8084-442e-891a-df1b11e81b47.csv",
  appChat:
    "https://metabase.zoca.ai/public/question/10a52e37-04fa-4422-b840-803b66e033bf.csv",
  email:
    "https://metabase.zoca.ai/public/question/7a5aa1f6-9205-4e83-be51-3e585aa0f4a8.csv",
  phone:
    "https://metabase.zoca.ai/public/question/60797a27-c546-450d-b00b-a51b7e490143.csv",
  video:
    "https://metabase.zoca.ai/public/question/d95d9354-7c84-4a57-8af5-e700580c6ecb.csv",
  sms:
    "https://metabase.zoca.ai/public/question/bbaad2fb-5f9d-4249-af59-c7812851437c.csv",
} as const;

// --- Tiny CSV parser (RFC 4180-ish) -----------------------------------------

export function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else {
        field += c;
      }
    }
  }
  // trailing
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === "") continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cells[c] ?? "";
    }
    out.push(obj);
  }
  return out;
}

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/csv" },
    // CSVs are cached at the edge for a couple minutes to avoid hammering Metabase
    // when many escalations come in at once.
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`Metabase ${url} ${res.status}`);
  }
  const text = await res.text();
  return parseCsv(text);
}

// --- BaseSheet (master customer reference) ---------------------------------

export interface BaseSheetRow {
  entity_id: string;
  bizname: string;
  customer_id: string;
  app_email: string;
  gbp_email: string;
  dct_email: string;
  sp_name: string;
  ae_name: string;
  am_name: string;
  phone_number: string;
  chrone_zoca_status: string;
  churn_date: string;
  total_monthly_revenue: string;
}

export async function fetchBaseSheet(): Promise<BaseSheetRow[]> {
  const rows = await fetchCsv(PUBLIC.baseSheet);
  return rows as unknown as BaseSheetRow[];
}

export async function findBaseSheetRow(opts: {
  customerId?: string;
  entityId?: string;
  email?: string;
  bizName?: string;
}): Promise<BaseSheetRow | null> {
  const all = await fetchBaseSheet();
  const norm = (s?: string) => (s || "").trim().toLowerCase();
  const wantCid = norm(opts.customerId);
  const wantEid = norm(opts.entityId);
  const wantEmail = norm(opts.email);
  const wantBiz = norm(opts.bizName);

  const matches = all.filter((r) => {
    if (wantCid && norm(r.customer_id) === wantCid) return true;
    if (wantEid && norm(r.entity_id) === wantEid) return true;
    if (wantEmail) {
      if (
        norm(r.app_email) === wantEmail ||
        norm(r.gbp_email) === wantEmail ||
        norm(r.dct_email) === wantEmail
      )
        return true;
    }
    if (wantBiz && norm(r.bizname) === wantBiz) return true;
    return false;
  });
  return matches[0] || null;
}

// --- Communications --------------------------------------------------------

const FIELD_OF: Record<Channel, { created: string; sender: string; body: string; entity: string; duration?: string }> = {
  app_chat: { created: "Created At", sender: "Sender", body: "Message Body", entity: "Entity ID" },
  email: { created: "Created At", sender: "Sender", body: "Message Body", entity: "Entity ID" },
  phone: { created: "Created At", sender: "Sender", body: "Message Body", entity: "Entity ID", duration: "Call Duration" },
  video: { created: "Created At", sender: "Sender", body: "Source", entity: "Entity ID", duration: "Duration" },
  sms: { created: "Created At", sender: "Sender", body: "Message Body", entity: "Entity ID" },
};

const URL_OF: Record<Channel, string> = {
  app_chat: PUBLIC.appChat,
  email: PUBLIC.email,
  phone: PUBLIC.phone,
  video: PUBLIC.video,
  sms: PUBLIC.sms,
};

function classifySender(channel: Channel, raw: string): "client" | "team" | "unknown" {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "unknown";
  if (channel === "email") {
    if (s.includes("received_by_client") || s.includes("by_client") || s === "user") return "client";
    if (s.includes("sent_by_team") || s.includes("team")) return "team";
    return "unknown";
  }
  if (s === "user" || s === "client") return "client";
  if (s.includes("team")) return "team";
  return "unknown";
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export async function fetchCommsForEntity(entityId: string, opts?: { sinceDays?: number; perChannelLimit?: number }): Promise<CommsMessage[]> {
  const sinceDays = opts?.sinceDays ?? 90;
  const perChannelLimit = opts?.perChannelLimit ?? 30;
  const cutoff = Date.now() - sinceDays * 24 * 3600 * 1000;
  const channels: Channel[] = ["app_chat", "email", "phone", "video", "sms"];
  const all: CommsMessage[] = [];
  await Promise.all(
    channels.map(async (ch) => {
      try {
        const rows = await fetchCsv(URL_OF[ch]);
        const fields = FIELD_OF[ch];
        const matches = rows.filter((r) => (r[fields.entity] || "").trim() === entityId);
        const parsed: CommsMessage[] = matches
          .map((r) => {
            const createdRaw = r[fields.created] || "";
            const t = Date.parse(createdRaw);
            if (Number.isNaN(t)) return null;
            if (t < cutoff) return null;
            const body = truncate(r[fields.body] || "", 600);
            const senderRaw = r[fields.sender] || "";
            const msg: CommsMessage = {
              channel: ch,
              createdAt: new Date(t).toISOString(),
              sender: classifySender(ch, senderRaw),
              body,
            };
            if (fields.duration) {
              const d = Number(r[fields.duration]);
              if (!Number.isNaN(d)) msg.durationSec = d;
            }
            return msg;
          })
          .filter((m): m is CommsMessage => m !== null);
        // most recent first, cap
        parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        all.push(...parsed.slice(0, perChannelLimit));
      } catch (e) {
        // best-effort: a single CSV failing shouldn't kill the whole lookup
      }
    })
  );
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return all;
}
