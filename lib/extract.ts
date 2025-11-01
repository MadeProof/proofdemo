import pdfParse from "pdf-parse";
import mammoth from "mammoth";
// @ts-ignore
import Tesseract from "tesseract.js";

export async function extractText(buffer: Buffer, filename: string, mime?: string) {
  const ext = (filename.split(".").pop() || "").toLowerCase();

  if (ext === "pdf") {
    const data = await pdfParse(buffer);
    return { text: data.text || "", meta: { pages: (data as any).numpages, mime } };
  }

  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value || "", meta: { mime } };
  }

  if (["jpg","jpeg","png"].includes(ext)) {
    const { data: { text } } = await Tesseract.recognize(buffer, "eng");
    return { text: text || "", meta: { ocr: true, mime } };
  }

  return { text: "", meta: { mime } };
}
