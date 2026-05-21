/**
 * HTML → plain text — IMPLEMENTATION_PLAN.md Workstream 1.2
 *
 * Converts fetched HTML (web pages, exported documents) into clean readable
 * text for the chunker. Regex-based — no DOM library, no network. Block
 * elements become line breaks so paragraph structure survives for chunking.
 *
 * Pure function.
 */

/** Named HTML entities common in body text. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  euro: "€",
  pound: "£",
  cent: "¢",
};

/** Decode numeric (&#123; &#x1F;) and common named HTML entities. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (whole, name: string) => {
      const lower = name.toLowerCase();
      return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : whole;
    });
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/**
 * Convert an HTML string to plain text.
 *
 * - <script>, <style>, <head>, <noscript>, <svg>, <template> content is dropped
 * - block-level elements and <br> become line breaks (paragraph structure kept)
 * - all remaining tags are stripped
 * - HTML entities are decoded
 * - runs of whitespace are collapsed
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  let s = html;

  // Drop non-content elements entirely (with their inner content).
  s = s.replace(
    /<(script|style|head|noscript|svg|template|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  // Drop HTML comments.
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // Headings get a blank line on each side so they read as their own paragraph.
  s = s.replace(/<\/h[1-6]\s*>/gi, "\n\n");
  s = s.replace(/<h[1-6]\b[^>]*>/gi, "\n\n");

  // Other block-level closers and <br> become single line breaks.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(
    /<\/(p|div|section|article|header|footer|li|ul|ol|table|tr|thead|tbody|blockquote|pre|figure)\s*>/gi,
    "\n",
  );
  s = s.replace(
    /<(p|div|section|article|li|tr|blockquote)\b[^>]*>/gi,
    "\n",
  );

  // Strip every remaining tag.
  s = s.replace(/<[^>]+>/g, " ");

  // Decode entities AFTER tag stripping so a literal "&lt;" in text survives.
  s = decodeHtmlEntities(s);

  // Collapse whitespace while preserving paragraph breaks.
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/ *\n */g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}
