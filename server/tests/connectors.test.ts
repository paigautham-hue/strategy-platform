/**
 * Unit tests — Connector framework (server/connectors/*)
 * IMPLEMENTATION_PLAN.md Phase 5 / Workstream 5.2
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  encryptionConfigured,
} from "../connectors/crypto";
import {
  CONNECTOR_REGISTRY,
  getConnectorMeta,
  isConnectorAvailable,
} from "../connectors";

describe("connectors — crypto, with an encryption key", () => {
  beforeAll(() => {
    process.env.CONNECTOR_ENC_KEY = "unit-test-encryption-key";
  });
  afterAll(() => {
    delete process.env.CONNECTOR_ENC_KEY;
  });

  it("reports encryption as configured", () => {
    expect(encryptionConfigured()).toBe(true);
  });

  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = "lin_api_0123456789abcdef";
    const enc = encryptSecret(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("uses a fresh IV — same plaintext encrypts to different ciphertext", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });
});

describe("connectors — crypto, dev fallback without a key", () => {
  beforeAll(() => {
    delete process.env.CONNECTOR_ENC_KEY;
  });

  it("reports encryption as not configured", () => {
    expect(encryptionConfigured()).toBe(false);
  });

  it("stores and returns the secret as plaintext", () => {
    const enc = encryptSecret("plain-secret");
    expect(enc).toBe("plain-secret");
    expect(isEncrypted(enc)).toBe(false);
    expect(decryptSecret(enc)).toBe("plain-secret");
  });
});

describe("connectors — registry", () => {
  it("lists the three connector types, with Linear available first", () => {
    expect(CONNECTOR_REGISTRY).toHaveLength(3);
    expect(CONNECTOR_REGISTRY[0].type).toBe("linear");
    expect(isConnectorAvailable("linear")).toBe(true);
  });

  it("marks Notion and Jira as not yet available", () => {
    expect(isConnectorAvailable("notion")).toBe(false);
    expect(isConnectorAvailable("jira")).toBe(false);
  });

  it("getConnectorMeta resolves a known type and rejects an unknown one", () => {
    expect(getConnectorMeta("linear")?.label).toBe("Linear");
    expect(getConnectorMeta("salesforce")).toBeUndefined();
    expect(isConnectorAvailable("salesforce")).toBe(false);
  });
});
