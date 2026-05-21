/**
 * Source → Text Extraction — IMPLEMENTATION_PLAN.md Workstream 1.2
 *
 * Turns an ingest source into clean plain text for the chunker. Phase 1 core
 * supports pasted text, markdown, raw HTML, and live URLs. PDF / DOCX / audio
 * / video / image sources slot into `EXTRACTORS` as they are added.
 *
 * The text/markdown/html paths are pure. The url path performs a network
 * fetch (bounded by a timeout and a max byte budget).
 */

import { htmlToText } from "./html-to-text";

export const INGEST_SOURCE_TYPES = ["text", "markdown", "html", "url"] as const;
export type IngestSourceType = (typeof INGEST_SOURCE_TYPES)[number];

export interface ExtractedText {
  text: string;
  sourceType: IngestSourceType;
  /** Final URL after redirects (url sources only). */
  resolvedUrl?: string;
  /** Response content-type (url sources only). */
  contentType?: string;
}

/** Max bytes to read from a URL fetch (4 MB) — guards against huge pages. */
const MAX_URL_BYTES = 4 * 1024 * 1024;
/** URL fetch timeout. */
const URL_TIMEOUT_MS = 15_000;

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN  (light cleanup — markdown is already human-readable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip the noisiest markdown syntax so claims read cleanly, while keeping
 * paragraph structure for the chunker.
 */
export function markdownToText(md: string): string {
  let s = md.replace(/\r\n?/g, "\n");
  // Fenced code blocks → keep the inner text, drop the fences.
  s = s.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code: string) => code);
  // Inline code, emphasis markers.
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");
  s = s.replace(/(\*|_)(.*?)\1/g, "$2");
  // Links / images → keep the visible text.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Heading hashes and blockquote / list markers at line start.
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, "");
  // Horizontal rules.
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// URL FETCH
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch a URL and extract readable text. Bounded by timeout + byte budget. */
async function extractFromUrl(url: string): Promise<ExtractedText> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`extract-text: not a valid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`extract-text: only http(s) URLs are supported, got ${parsed.protocol}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "StrategyPlatform-Ingest/1.0" },
    });
  } catch (err) {
    throw new Error(
      `extract-text: failed to fetch ${parsed.toString()}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    throw new Error(`extract-text: ${parsed.toString()} returned HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("content-type") ?? "";
  const raw = await readBounded(resp, MAX_URL_BYTES);

  const isHtml = contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(raw);
  const text = isHtml ? htmlToText(raw) : raw.trim();

  return {
    text,
    sourceType: "url",
    resolvedUrl: resp.url || parsed.toString(),
    contentType: contentType || undefined,
  };
}

/** Read a response body as text, refusing to buffer more than `maxBytes`. */
async function readBounded(resp: Response, maxBytes: number): Promise<string> {
  const declared = Number(resp.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new Error(
      `extract-text: response is ${declared} bytes, exceeds the ${maxBytes}-byte limit`,
    );
  }
  const buf = await resp.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error(
      `extract-text: response is ${buf.byteLength} bytes, exceeds the ${maxBytes}-byte limit`,
    );
  }
  return new TextDecoder("utf-8").decode(buf);
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract plain text from an ingest source.
 *
 * @param sourceType  one of INGEST_SOURCE_TYPES
 * @param content     raw text / markdown / html, OR the URL for `url`
 */
export async function extractText(
  sourceType: IngestSourceType,
  content: string,
): Promise<ExtractedText> {
  switch (sourceType) {
    case "text":
      return { text: content.replace(/\r\n?/g, "\n").trim(), sourceType };
    case "markdown":
      return { text: markdownToText(content), sourceType };
    case "html":
      return { text: htmlToText(content), sourceType };
    case "url":
      return extractFromUrl(content);
    default: {
      // Exhaustiveness guard — a new source type must be handled here.
      const never: never = sourceType;
      throw new Error(`extract-text: unsupported source type: ${String(never)}`);
    }
  }
}
