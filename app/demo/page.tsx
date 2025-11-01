"use client";
import React, { useState } from "react";

export default function DemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  async function handleUpload() {
    if (!file) return;
    setStatus("⏳ Uploading...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setText(data.text || "(No text extracted)");
      setStatus("✅ Done");
    } catch (err: any) {
      setStatus("❌ " + err.message);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>🧾 MadeProof Demo — Upload & Verify</h1>
      <p>Upload any small PDF, DOCX, or image to see extraction + deletion receipt in action.</p>
      <div style={{ marginTop: 20 }}>
        <input
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          style={{
            marginLeft: 10,
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            borderRadius: 6,
          }}
          onClick={handleUpload}
          disabled={!file}
        >
          Upload
        </button>
      </div>

      {status && <p style={{ marginTop: 20 }}>{status}</p>}
      {text && (
        <pre
          style={{
            marginTop: 20,
            padding: 16,
            background: "#f9f9f9",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </pre>
      )}
    </main>
  );
}
