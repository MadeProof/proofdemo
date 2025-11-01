"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import "pdfjs-dist/build/pdf.worker.entry";
import Tesseract from "tesseract.js";

export default function DemoPage() {
  const [out, setOut] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector("input[type=file]") as HTMLInputElement;
    if (!fileInput?.files?.length) return;
    const file = fileInput.files[0];
    setDone(false);
    setOut("");
    setOcrText("");
    setOcrBusy(false);

    const text = await extractText(file);
    setOut(text);
    setDone(true);
  }

  async function extractText(file: File) {
    const pdfjs = await import("pdfjs-dist/build/pdf");
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const strings = textContent.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n";
    }

    return fullText.trim();
  }

  // ---- OCR drawings (page 1) ----
  async function ocrFirstPageFromPdfFile(f: File) {
    setOcrBusy(true);
    setOcrText("");
    try {
      const pdfjs = await import("pdfjs-dist/build/pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      const ab = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: ab }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;

      const { data: { text } } = await Tesseract.recognize(canvas, "eng");
      setOcrText(text.trim());
    } catch (err: any) {
      setOcrText("OCR error: " + err.message);
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>🧾 MadeProof Demo — Upload, OCR & Verify</h1>
      <p>Upload any small PDF, DOCX, or image to see extraction + deletion receipt in action.</p>

      <form onSubmit={handleUpload}>
        <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" />
        <button type="submit" style={{ marginLeft: 8 }}>Upload</button>
      </form>

      {out && (
        <button
          style={{ marginTop: 12 }}
          onClick={async () => {
            const fileInput = document.querySelector("input[type=file]") as HTMLInputElement;
            if (fileInput?.files?.[0]) await ocrFirstPageFromPdfFile(fileInput.files[0]);
          }}
          disabled={ocrBusy}
        >
          {ocrBusy ? "Running OCR..." : "OCR drawings (p1)"}
        </button>
      )}

      {done && <p style={{ color: "green" }}>✔ Done</p>}

      {out && (
        <pre style={{
          background: "#f7f7f7",
          padding: "16px",
          borderRadius: "8px",
          marginTop: "12px",
          whiteSpace: "pre-wrap"
        }}>{out}</pre>
      )}

      {ocrText && (
        <>
          <h3>🖼 OCR Extracted Drawing Text</h3>
          <pre style={{
            background: "#eef",
            padding: "16px",
            borderRadius: "8px",
            whiteSpace: "pre-wrap"
          }}>{ocrText}</pre>
        </>
      )}
    </main>
  );
}
