import { NextRequest, NextResponse } from "next/server";
import { buildContext } from "@/lib/enrichment";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/customer/<idOrEmailOrEntity> — quick lookup, no agent call.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const looksLikeEmail = id.includes("@");
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  try {
    const ctx = await buildContext({
      text: "(lookup only)",
      customerHint: looksLikeEmail
        ? { email: id }
        : looksLikeUuid
          ? { entityId: id }
          : { customerId: id },
    });
    return NextResponse.json({ ok: true, context: ctx });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
