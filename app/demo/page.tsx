"use client";
import React, { useEffect, useState } from "react";

type UploadResp = {
  ok: boolean;
  name: string;
  mime: string;
  sha256: string;
  started_at: string;
  deleted_at: string;
  meta: any;
  text: string;
  deletion_receipt: any;
  signature_base64: string;
  verify_with: string;
  error?: string;
};

type AnalyseResp = {
  ok: boolean;
  score: number;
  band: "green" | "amber" | "red";
  warnings: string[];
  nextActions: string[];
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#eee", fontSize: 12 }}>
      {children}
    </span>
  );
}

export default function DemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [out, setOut] = useState<UploadResp | null>(null);
  const [analysis, setAnalysis] = useState<AnalyseResp | null>(null);
  const [bubble, setBubble] = useState<string>(
    "G’day — I’m ProofMate. Drop a doc and I’ll show you what I can (and can’t) see."
  );

  // OCR (client-side) state
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");

  useEffect(() => {
    if (!out?.ok) return;
    (async () => {
      setBubble("Reading what I can, then I’ll score coverage — no magic, just honest heuristics.");
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: out.text, filename: out.name, mime: out.mime }),
      });
      const j = (await res.json()) as AnalyseResp;
      setAnalysis(j);
      setBubble(
        j.band === "green"
          ? "Looks solid. I’d still sanity-check dates and issuer."
          : j.band === "amber"
          ? "Close. A couple of gaps — see the warnings."
          : "Plenty to tighten. I’ve listed the next actions."
      );
    })();
  }, [out?.sha256]);

  async function handleUpload() {
    if (!file) return;
    setStatus("Verifying…");
    setOut(null);
    setAnalysis(null);
    setOcrText("");
    setBubble("Uploading to memory only. I’ll extract, hash, then delete and give you a signed receipt.");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOut(data);
      setStatus("✅ Done");
      setBubble("All processed — buffer wiped, temp file shredded. Here’s what I could read and your deletion receipt.");
    } catch (e: any) {
      setStatus("❌ " + (e.message || "Upload failed"));
      setBubble("Couldn’t process that one. Smaller file or a clearer PDF usually does the trick.");
    }
  }

  // ---- OCR drawings (page 1) button ----
  async function ocrFirstPageFromPdfFile(f: File) {
    setOcrBusy(true);
    setOcrText("");
    try {
      // Render PDF page 1 to a canvas using pdf.js (ESM)
      const pdfjs: any = await import("pdfjs-dist/build/pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).toString();

      const ab = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: ab }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x for clearer OCR

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // OCR the bitmap with Tesseract.js
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      setOcrText((data.text || "").trim() || "(no OCR text found)");
      setBubble("Pulled text from the drawing. Dimensions and labels show up better via OCR.");
    } catch (e: any) {
      setOcrText("OCR failed: " + (e.message || e));
      setBubble("That drawing didn’t OCR nicely. Higher-res source usually helps.");
    } finally {
      setOcrBusy(false);
    }
  }

  function download(name: string, json: any) {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 860, margin: "60px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>🧾 MadeProof Demo — Upload & Verify</h1>
      <p>Upload any small PDF, DOCX, or image to see extraction + deletion receipt in action.</p>

      {/* ProofMate bubble */}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          maxWidth: 360,
          background: "#111",
          color: "#fff",
          padding: 12,
          borderRadius: 12,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>ProofMate</div>
        <div style={{ fontSize: 14, lineHeight: 1.3 }}>{bubble}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <input
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={handleUpload}
          disabled={!file}
          style={{ marginLeft: 8, padding: "6px 12px", background: "#111", color: "#fff", borderRadius: 6 }}
        >
          Upload
        </button>
        <button
          onClick={() => file && file.name.toLowerCase().endsWith(".pdf") && ocrFirstPageFromPdfFile(file)}
          disabled={!file || !file.name.toLowerCase().endsWith(".pdf") || ocrBusy}
          style={{ marginLeft: 8, padding: "6px 12px", borderRadius: 6 }}
          title="OCR the first page of the PDF (good for CAD drawings)"
        >
          {ocrBusy ? "OCR…" : "OCR drawings (p1)"}
        </button>
      </div>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}

      {/* Extracted text */}
      {out?.ok && (
        <section
          style={{
            marginTop: 18,
            padding: 16,
            background: "#fafafa",
            border: "1px solid #e8e8e8",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <Chip>{out.name}</Chip>
            <Chip>{out.mime}</Chip>
            <Chip>SHA-256: {out.sha256.slice(0, 12)}…</Chip>
          </div>
          <details open>
            <summary style={{ cursor: "pointer" }}>
              <b>Extracted text</b> (first 10k chars)
            </summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{out.text || "(no text extracted)"}</pre>
          </details>
        </section>
      )}

      {/* OCR text (page 1) */}
      {ocrText && (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            background: "#fffdf5",
            border: "1px solid #f0e6c2",
            borderRadius: 10,
          }}
        >
          <b>OCR (page 1)</b>
          <pre style={{ whiteSpace: "pre-wrap" }}>{ocrText}</pre>
        </section>
      )}

      {/* Analysis */}
      {analysis?.ok && (
        <section style={{ marginTop: 16, padding: 16, border: "1px solid #e8e8e8", borderRadius: 10 }}>
          <h3 style={{ margin: "4px 0" }}>Coverage check</h3>
          <p style={{ margin: "6px 0" }}>
            Score: <b>{analysis.score}</b> / 100 &nbsp;
            <Chip>{analysis.band.toUpperCase()}</Chip>
          </p>
          {analysis.warnings.length > 0 && (
            <>
              <b>Warnings</b>
              <ul>
                {analysis.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {analysis.nextActions.length > 0 && (
            <>
              <b>Next actions</b>
              <ol>
                {analysis.nextActions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {/* Receipt */}
      {out?.ok && (
        <section style={{ marginTop: 16, padding: 16, border: "1px solid #e8e8e8", borderRadius: 10 }}>
          <h3 style={{ margin: "4px 0" }}>Deletion receipt</h3>
          <p style={{ margin: "6px 0" }}>
            Processed: <code>{out.started_at}</code> &nbsp; • &nbsp; Deleted: <code>{out.deleted_at}</code>
          </p>
          <details>
            <summary>Show receipt JSON</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(out.deletion_receipt, null, 2)}</pre>
          </details>
          <details>
            <summary>Signature (base64)</summary>
            <code style={{ wordBreak: "break-all" }}>{out.signature_base64}</code>
          </details>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            Verify with public key at <a href="/api/public-key" target="_blank">/api/public-key</a>.
          </p>
          <button
            onClick={() =>
              download(`MadeProof-Deletion-Receipt-${out.sha256.slice(0, 12)}.json`, {
                receipt: out.deletion_receipt,
                signature_base64: out.signature_base64,
              })
            }
            style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6 }}
          >
            Download receipt
          </button>
        </section>
      )}
    </main>
  );
}
