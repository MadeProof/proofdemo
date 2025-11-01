"use client";
import React, { useState, useEffect } from "react";

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
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: "#eee",
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

export default function DemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [out, setOut] = useState<UploadResp | null>(null);
  const [analysis, setAnalysis] = useState<AnalyseResp | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [bubble, setBubble] = useState(
    "G’day — I’m ProofMate. Drop a doc and I’ll show you what I can (and can’t) see."
  );

  useEffect(() => {
    if (!out?.ok) return;
    (async () => {
      setBubble("Reading what I can, then I’ll score coverage.");
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: out.text,
          filename: out.name,
          mime: out.mime,
        }),
      });
      const j = (await res.json()) as AnalyseResp;
      setAnalysis(j);
      setBubble(
        j.band === "green"
          ? "Looks solid — check dates & issuer to be sure."
          : j.band === "amber"
          ? "Close. A couple of gaps — see warnings."
          : "Needs work — see next actions."
      );
    })();
  }, [out?.sha256]);

  async function handleUpload() {
    if (!file) return;
    setStatus("Verifying…");
    setOut(null);
    setAnalysis(null);
    setOcrText("");
    setBubble("Uploading in-memory only. Extracting + verifying.");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOut(data);
      setStatus("✅ Done");
      setBubble("Processed + securely deleted. Here’s what I found.");
    } catch (e: any) {
      setStatus("❌ " + (e.message || "Upload failed"));
      setBubble("Couldn’t process that one. Try a smaller or clearer file.");
    }
  }

  // ---- OCR drawings (page 1) button ----
  async function ocrFirstPageFromPdfFile(f: File) {
    setOcrBusy(true);
    setOcrText("");
    try {
      const pdfjs: any = await import("pdfjs-dist/build/pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).toString();

      const ab = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: ab }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      setOcrText((data.text || "").trim() || "(no OCR text found)");
      setBubble("Extracted drawing text — dimensions + labels captured.");
    } catch (e: any) {
      setOcrText("OCR failed: " + (e.message || e));
      setBubble("That drawing didn’t OCR cleanly — higher-res usually helps.");
    } finally {
      setOcrBusy(false);
    }
  }

  function download(name: string, json: any) {
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "60px auto",
        padding: "0 16px",
        fontFamily: "system-ui",
      }}
    >
      <h1>🧾 MadeProof Demo — Upload, OCR & Verify</h1>
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

      {/* Upload & OCR controls */}
      <div style={{ marginTop: 16 }}>
        <input
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={handleUpload}
          disabled={!file}
          style={{
            marginLeft: 8,
            padding: "6px 12px",
            background: "#111",
            color: "#fff",
            borderRadius: 6,
          }}
        >
          Upload
        </button>
        <button
          onClick={() =>
            file &&
            file.name.toLowerCase().endsWith(".pdf") &&
            ocrFirstPageFromPdfFile(file)
          }
          disabled={!file || !file.name.toLowerCase().endsWith(".pdf") || ocrBusy}
          style={{
            marginLeft: 8,
            padding: "6px 12px",
            borderRadius: 6,
            background: "#444",
            color: "#fff",
          }}
        >
          {ocrBusy ? "OCR…" : "OCR drawings (p1)"}
        </button>
      </div>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}

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
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Chip>{out.name}</Chip>
            <Chip>{out.mime}</Chip>
            <Chip>SHA-256: {out.sha256.slice(0, 12)}…</Chip>
          </div>
          <details open>
            <summary>
              <b>Extracted text</b> (first 10k chars)
            </summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {out.text || "(no text extracted)"}
            </pre>
          </details>
        </section>
      )}

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

      {analysis?.ok && (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #e8e8e8",
            borderRadius: 10,
          }}
        >
          <h3>Coverage check</h3>
          <p>
            Score: <b>{analysis.score}</b>/100 &nbsp;
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

      {out?.ok && (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #e8e8e8",
            borderRadius: 10,
          }}
        >
          <h3>Deletion receipt</h3>
          <p>
            Processed: <code>{out.started_at}</code> &nbsp; • &nbsp; Deleted:{" "}
            <code>{out.deleted_at}</code>
          </p>
          <details>
            <summary>Show receipt JSON</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(out.deletion_receipt, null, 2)}
            </pre>
          </details>
          <details>
            <summary>Signature (base64)</summary>
            <code style={{ wordBreak: "break-all" }}>
              {out.signature_base64}
            </code>
          </details>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            Verify with public key at{" "}
            <a href="/api/public-key" target="_blank">
              /api/public-key
            </a>
            .
          </p>
          <button
            onClick={() =>
              download(`MadeProof-Receipt-${out.sha256.slice(0, 12)}.json`, {
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
