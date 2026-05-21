/**
 * Client-side file → text extraction — IMPLEMENTATION_PLAN.md Workstream 1.2
 *
 * Extracts plain text from an uploaded PDF / DOCX / text file in the browser,
 * so the existing text-based ingest pipeline can consume any document format
 * without server-side binary handling or storage uploads.
 *
 * The heavy parsers (pdfjs, mammoth) are dynamically imported — they only
 * load when the user actually picks a file, keeping the main bundle lean.
 */

/** File formats this module can extract. */
export type ExtractableKind = "pdf" | "docx" | "text" | "unsupported";

export interface FileExtractionResult {
  text: string;
  kind: ExtractableKind;
  /** Pages (PDF) or paragraphs touched — informational. */
  blocks: number;
}

/** Classify a file by extension + MIME type. */
export function classifyFile(file: File): ExtractableKind {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (
    name.endsWith(".docx") ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    type.startsWith("text/")
  ) {
    return "text";
  }
  return "unsupported";
}

/** Human-readable list of accepted formats, for the file input's `accept`. */
export const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.md,.markdown";

/** Max upload size (20 MB) — guards the browser against huge files. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Extract plain text from an uploaded file.
 * @throws if the file is unsupported, empty, or too large.
 */
export async function extractTextFromFile(file: File): Promise<FileExtractionResult> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`The file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 20 MB.`);
  }

  const kind = classifyFile(file);
  switch (kind) {
    case "text": {
      const text = (await file.text()).replace(/\r\n?/g, "\n").trim();
      return { text, kind, blocks: 1 };
    }
    case "docx":
      return extractDocx(file);
    case "pdf":
      return extractPdf(file);
    default:
      throw new Error(
        `Unsupported file type: ${file.name}. Accepted: PDF, DOCX, TXT, Markdown.`,
      );
  }
}

/** DOCX → text via mammoth (dynamically imported). */
async function extractDocx(file: File): Promise<FileExtractionResult> {
  const { extractRawText } = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer });
  const text = result.value.replace(/\r\n?/g, "\n").trim();
  if (!text) throw new Error("No text could be extracted from the DOCX file.");
  return { text, kind: "docx", blocks: text.split(/\n{2,}/).length };
}

/** PDF → text via pdfjs-dist (dynamically imported). */
async function extractPdf(file: File): Promise<FileExtractionResult> {
  const pdfjs = await import("pdfjs-dist");
  // Vite resolves the worker to a URL; pdfjs needs it set before getDocument.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (pageText) pages.push(pageText);
  }
  await doc.destroy();

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error(
      "No text could be extracted — the PDF may be scanned images (OCR is not yet supported).",
    );
  }
  return { text, kind: "pdf", blocks: doc.numPages };
}
