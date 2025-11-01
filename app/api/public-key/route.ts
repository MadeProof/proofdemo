import { NextResponse } from "next/server";
import { getPublicKeyPem } from "@/lib/signer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return new NextResponse(getPublicKeyPem(), {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" }
    });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
