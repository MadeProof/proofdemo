import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { extractText } from "@/lib/extract";
import { signReceipt } from "@/lib/signer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const started = new Date().toISOString();

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }

    // Size guard: 10MB recommended for demo
    const size = file.size ?? 0;
    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (>10MB)" }, { status: 413 });
    }

    const filename = file.name || "upload";
    const mime = file.type || "application/octet-stream";

    // Read file to Buffer
    const ab = await file.arrayBuffer();
    let buffer = Buffer.from(ab);

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Extract text (PDF/DOCX/OCR images)
    const { text, meta } = await extractText(buffer, filename, mime);

    // Wipe buffer from memory
    buffer.fill(0);
    buffer = Buffer.alloc(0);

    const deleted = new Date().toISOString();

    // Build and sign deletion receipt
    const receipt = {
      kind: "MadeProofDeletionReceipt",
      version: 1,
      file: { name: filename, mime, sha256, size },
      process: { started_at: started, deleted_at: deleted },
      extraction: { pages: meta.pages ?? null, ocr: !!meta.ocr }
    };
    const signature = signReceipt(receipt);

    return NextResponse.json({
      ok: true,
      name: filename,
      mime,
      sha256,
      started_at: started,
      deleted_at: deleted,
      meta,
      text: (text || "").slice(0, 10000),
      deletion_receipt: receipt,
      signature_base64: signature,
      verify_with: "/api/public-key"
    }, { headers: { "Cache-Control": "no-store" } });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Upload failed" }, { status: 500 });
  }
}
