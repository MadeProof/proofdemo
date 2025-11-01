import { NextRequest, NextResponse } from "next/server";
import formidable, { IncomingForm } from "formidable";
import { Readable } from "stream";
import crypto from "crypto";
import fs from "fs";
import { extractText } from "@/lib/extract";
import { signReceipt } from "@/lib/signer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMultipart(req: NextRequest): Promise<{ buffer: Buffer; filename: string; mime?: string; tmpPath?: string }> {
  return new Promise(async (resolve, reject) => {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) return reject(new Error("Invalid content type"));
    const readable = Readable.fromWeb(req.body as any);
    const form = new IncomingForm({ multiples:false, maxFileSize:20*1024*1024, uploadDir:"/tmp", keepExtensions:true });
    form.parse(readable as any, (err, _fields, files) => {
      if (err) return reject(err);
      const f = (files.file || files.upload || Object.values(files)[0]) as formidable.File;
      if (!f?.filepath) return reject(new Error("No file"));
      const buf = fs.readFileSync(f.filepath);
      resolve({ buffer: buf, filename: f.originalFilename || "upload", mime: f.mimetype, tmpPath: f.filepath });
    });
  });
}

export async function POST(req: NextRequest) {
  const started = new Date().toISOString();
  let tmpPath: string | undefined;

  try {
    const { buffer, filename, mime, tmpPath: t } = await parseMultipart(req);
    tmpPath = t;

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const { text, meta } = await extractText(buffer, filename, mime);

    // wipe memory buffer
    buffer.fill(0);
    // shred + unlink temp
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        const stat = fs.statSync(tmpPath);
        const fd = fs.openSync(tmpPath, "r+");
        fs.writeSync(fd, Buffer.alloc(stat.size, 0), 0, stat.size, 0);
        fs.closeSync(fd);
        fs.unlinkSync(tmpPath);
      } catch {}
    }
    const deleted = new Date().toISOString();

    const receipt = {
      kind: "MadeProofDeletionReceipt",
      version: 1,
      file: { name: filename, mime, sha256 },
      process: { started_at: started, deleted_at: deleted },
      extraction: { pages: meta.pages ?? null, ocr: !!meta.ocr }
    };
    const signature = signReceipt(receipt);

    return NextResponse.json({
      ok:true, name:filename, mime, sha256,
      started_at: started, deleted_at: deleted, meta,
      text: (text||"").slice(0,10000),
      deletion_receipt: receipt, signature_base64: signature, verify_with: "/api/public-key"
    }, { headers: { "Cache-Control":"no-store" } });

  } catch (e:any) {
    if (tmpPath && fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath); } catch {} }
    return NextResponse.json({ ok:false, error:e.message||"Upload failed" }, { status:400, headers: { "Cache-Control":"no-store" } });
  }
}
