"use client";
import React, { useState } from "react";

// Lazy imports for pdf.js and tesseract so the page still loads fast
async function renderFirstPageToCanvas(file: File) {
  const pdfjs: any = await import("pdfjs-dist/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const ab = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: ab }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

export default function DemoPage() {
  const [text, setText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // --- Upload handler ---
  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector("input[type=file]") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    setBusy(true);
    setText("");
    setOcrText("");
    setDone(false);

    try {
      const pdfjs = await import("pdfjs-dist/build/pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(" ") + "\n";
      }

      setText(fullText.trim());
      setDone(true);
    } catch (err: any) {
      setText("Error reading PDF: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  // --- OCR button handler ---
  async function handleOcr() {
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF first.");
      return;
    }

    setBusy(true);
    setOcrText("Running OCR...");
    try {
      const canvas = await renderFirstPageToCanvas(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      setOcrText((data.text || "").trim() || "(no OCR text found)");
    } catch (err: any) {
      setOcrText("OCR failed: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: "60px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>🧾 MadeProof Demo — Upload, OCR & Verify</h1>
      <p>Upload any small PDF, DOCX, or image to see extraction + deletion receipt in action.</p>

      <form onSubmit={handleUpload} style={{ marginTop: 16 }}>
        <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" />
        <button type="submit" style={{ marginLeft: 8, padding: "6px 12px" }} disabled={busy}>
          {busy ? "Processing..." : "Upload"}
        </button>
        <button type="button" onClick={handleOcr} style={{ marginLeft: 8, padding: "6px 12px" }} disabled={busy}>
          {busy ? "Working…" : "OCR drawings (p1)"}
        </button>
      </form>

      {done && <p style={{ color: "green", marginTop: 8 }}>✔ Done</p>}

      {text && (
        <section style={{ marginTop: 16, padding: 16, background: "#fafafa", borderRadius: 8 }}>
          <b>Extracted Text</b>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{text}</pre>
        </section>
      )}

      {ocrText && (
        <section style={{ marginTop: 16, padding: 16, background: "#eef", borderRadius: 8 }}>
          <b>OCR (page 1)</b>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{ocrText}</pre>
        </section>
      )}
    </main>
  );
}
