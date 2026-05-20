/**
 * PII / secrets redactor — C5
 * MUST run before every LLM call. No bypass path.
 *
 * Strips: SSN, credit card numbers, email addresses, phone numbers,
 * API keys (Bearer / sk- / pk-), and common secret patterns.
 */

export interface RedactionResult {
  redacted: string;
  /** Number of PII tokens replaced */
  count: number;
  /** Types of PII found */
  types: string[];
}

// ─── Patterns ────────────────────────────────────────────────────────────────

const PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  {
    name: "ssn",
    // 123-45-6789 or 123 45 6789 or 123456789
    regex: /\b(?:\d{3}[-\s]\d{2}[-\s]\d{4}|\d{9})\b/g,
    replacement: "[REDACTED-SSN]",
  },
  {
    name: "credit_card",
    // Visa/MC/Amex/Discover — contiguous or dash/space-separated groups of 4
    // Handles: 4111111111111111, 4111-1111-1111-1111, 4111 1111 1111 1111
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[REDACTED-CC]",
  },
  {
    name: "email",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[REDACTED-EMAIL]",
  },
  {
    name: "phone",
    // US/international: +1 (555) 555-5555, 555-555-5555, etc.
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[REDACTED-PHONE]",
  },
  {
    name: "bearer_token",
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: "Bearer [REDACTED-TOKEN]",
  },
  {
    name: "openai_key",
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
    replacement: "[REDACTED-API-KEY]",
  },
  {
    name: "stripe_key",
    regex: /\b(?:pk|sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g,
    replacement: "[REDACTED-STRIPE-KEY]",
  },
  {
    name: "aws_key",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: "[REDACTED-AWS-KEY]",
  },
  {
    name: "password_field",
    // "password": "anything" in JSON-like text
    regex: /("password"\s*:\s*")[^"]+(")/gi,
    replacement: '$1[REDACTED-PASSWORD]$2',
  },
];

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Redact PII from a string. Called inside router.complete/embed/structured.
 * This function is synchronous and has no bypass path.
 */
export function redact(input: string): RedactionResult {
  let result = input;
  const foundTypes: string[] = [];
  let totalCount = 0;

  for (const { name, regex, replacement } of PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    const matches = result.match(regex);
    if (matches && matches.length > 0) {
      foundTypes.push(name);
      totalCount += matches.length;
      result = result.replace(regex, replacement);
    }
  }

  return { redacted: result, count: totalCount, types: foundTypes };
}

/**
 * Redact PII from an array of LLM messages.
 * Modifies the content of each message in place (returns new array).
 */
export function redactMessages(
  messages: Array<{ role: string; content: string | unknown }>
): Array<{ role: string; content: string | unknown }> {
  return messages.map((msg) => {
    if (typeof msg.content === "string") {
      const { redacted } = redact(msg.content);
      return { ...msg, content: redacted };
    }
    // For array content (multimodal), redact text parts only
    if (Array.isArray(msg.content)) {
      const redactedContent = (msg.content as Array<{ type: string; text?: string }>).map((part) => {
        if (part.type === "text" && typeof part.text === "string") {
          const { redacted } = redact(part.text);
          return { ...part, text: redacted };
        }
        return part;
      });
      return { ...msg, content: redactedContent };
    }
    return msg;
  });
}
