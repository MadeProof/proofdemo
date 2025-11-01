"use client";

import React, { useState } from "react";

// --- pdf.js (v3+) correct ESM imports (fixes 'pdf.worker.mjs' not found) ---
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";

// set worker src for pdf.js
// @ts-ignore - runtime assignment is fine
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function DemoPage() {
  const [text, setText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // ---------- Helpers ----------
  async function extractAllPageText(file: File) {
    const ab = await file.arrayBuffer();
    // @ts-ignore - pdfjs types vary
    const pdf = await pdfjs.getDocument({ data: ab }).promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content: any = await page.getTextContent();
      const strings = content.items.map((it: any) => it.str);
      full += strings.join(" ") + "\n";
    }
    return full.trim();
  }

  async function renderFirstPageToCanvas(file: File) {
    const ab = await file.arrayBuffer();
    // @ts-ignore
    const pdf = await pdfjs.getDocument({ data: ab }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // ---------- UI handlers ----------
  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    const f = input?.files?.[0];
    if (!f) return;
    setBusy(true);
    setDone(false);
    setText("");
    setOcrText("");

    try {
      const t = await extractAllPageText(f);
      setText(t || "(no text extracted)");
      setDone(true);
    } catch (err: any) {
      setText("Error extracting text: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function handleOcr() {
    const input = document.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    const f = input?.files?.[0];
    if (!f || !f.name.toLowerCase().endsWith(".pdf")) {
      alert("Please choose a PDF first.");
      return;
    }
    setBusy(true);
    setOcrText("Running OCR…");
    try {
      const canvas = await renderFirstPageToCanvas(f);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      setOcrText((data.text || "").trim() || "(no OCR text found)");
    } catch (err: any) {
      setOcrText("OCR failed: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  // ---------- Render ----------
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
      <p>
        Upload any small PDF, DOCX, or image to see extraction + deletion
        receipt in action.
      </p>

      <form onSubmit={handleUpload} style={{ marginTop: 16 }}>
        <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" />
        <button
          type="submit"
          disabled={busy}
          style={{ marginLeft: 8, padding: "6px 12px" }}
        >
          {busy ? "Processing…" : "Upload"}
        </button>
        <button
          type="button"
          onClick={handleOcr}
          disabled={busy}
          style={{ marginLeft: 8, padding: "6px 12px" }}
        >
          {busy ? "Working…" : "OCR drawings (p1)"}
        </button>
      </form>

      {done && <p style={{ color: "green", marginTop: 8 }}>✔ Done</p>}

      {text && (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 10,
          }}
        >
          <b>Extracted Text</b>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{text}</pre>
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
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{ocrText}</pre>
        </section>
      )}
    </main>
  );
}
