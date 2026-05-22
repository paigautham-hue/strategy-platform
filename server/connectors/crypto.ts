/**
 * Connector credential encryption — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.2
 *
 * Per-portco execution-tool API tokens are encrypted at rest with AES-256-GCM.
 * The key is derived (SHA-256) from the `CONNECTOR_ENC_KEY` environment
 * variable, which the deployment supplies from the Vault.
 *
 * Dev fallback: when no key is configured, secrets are stored as-is so the
 * platform still runs locally — `isEncrypted` makes the distinction explicit.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.CONNECTOR_ENC_KEY;
  if (!raw || !raw.trim()) return null;
  return createHash("sha256").update(raw).digest(); // deterministic 32-byte key
}

/** Is a stored credential string in encrypted form? Pure. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/** Is connector-credential encryption configured? */
export function encryptionConfigured(): boolean {
  return getKey() !== null;
}

/**
 * Encrypt a secret for storage. When no key is configured, returns the
 * plaintext unchanged (dev fallback) — never throws.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv.toString("hex"), tag.toString("hex"), ciphertext.toString("hex")].join(":")
  );
}

/**
 * Decrypt a stored credential. A non-encrypted string is returned as-is (it was
 * stored under the dev fallback). Throws only if an encrypted value is found
 * but no key is configured to decrypt it.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = getKey();
  if (!key) {
    throw new Error("CONNECTOR_ENC_KEY is required to decrypt a stored credential.");
  }
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted credential.");
  const [ivHex, tagHex, ctHex] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
