// GET /api/escalations
//   ?q=<biz name | entity uuid | email | chargebee customer id>
//   ?sinceDays=365   (0 or negative = no cutoff)
//   ?perChannelLimit=500
//
// Returns the matched customer (from BaseSheet) plus every message they're
// associated with across all 5 comms channels, sorted newest-first.

import { NextRequest, NextResponse } from "next/server";
import {
  fetchCommsForEntity,
  searchBaseSheet,
  type BaseSheetRow,
} from "@/lib/metabase";
import type { CommsMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CustomerCard {
  bizName: string;
  entityId: string;
  customerId: string;
  email: string;
  phone: string;
  amName: string;
  spName: string;
  aeName: string;
  status: string;
  churnDate: string;
  monthlyRevenue?: number;
}

function toCard(row: BaseSheetRow): CustomerCard {
  const mrrNum = Number((row.total_monthly_revenue || "").replace(/[^0-9.\-]/g, ""));
  return {
    bizName: row.bizname,
    entityId: row.entity_id,
    customerId: row.customer_id,
    email: row.app_email || row.gbp_email || row.dct_email,
    phone: row.phone_number,
    amName: row.am_name,
    spName: row.sp_name,
    aeName: row.ae_name,
    status: row.chrone_zoca_status,
    churnDate: row.churn_date,
    monthlyRevenue: Number.isFinite(mrrNum) ? mrrNum : undefined,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const sinceDays = Number(url.searchParams.get("sinceDays") ?? "365");
  const perChannelLimit = Number(url.searchParams.get("perChannelLimit") ?? "500");

  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Missing query. Pass ?q=<biz name | entity uuid | email | customer id>" },
      { status: 400 }
    );
  }

  try {
    const matches = await searchBaseSheet(q, 10);
    if (!matches.length) {
      return NextResponse.json({
        ok: true,
        query: q,
        matches: [],
        customer: null,
        comms: [],
        stats: { total: 0, byChannel: {}, bySender: {} },
        lookupNotes: ["No customer matched that search. Try a UUID, exact biz name, or an email address."],
      });
    }

    // First match wins. UI gets the full list so the user can see ambiguity.
    const primary = matches[0];
    if (!primary.entity_id) {
      return NextResponse.json({
        ok: true,
        query: q,
        matches: matches.map(toCard),
        customer: toCard(primary),
        comms: [],
        stats: { total: 0, byChannel: {}, bySender: {} },
        lookupNotes: ["BaseSheet row found but it has no entity_id, so we can't pull comms history."],
      });
    }

    const comms: CommsMessage[] = await fetchCommsForEntity(primary.entity_id, {
      sinceDays,
      perChannelLimit,
    });

    // Build stats.
    const byChannel: Record<string, number> = {};
    const bySender: Record<string, number> = {};
    for (const m of comms) {
      byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
      bySender[m.sender] = (bySender[m.sender] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      query: q,
      matches: matches.map(toCard),
      customer: toCard(primary),
      comms,
      stats: {
        total: comms.length,
        byChannel,
        bySender,
      },
      lookupNotes:
        matches.length > 1
          ? [`${matches.length} BaseSheet rows matched "${q}". Showing the first; the others are listed under matches.`]
          : [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
