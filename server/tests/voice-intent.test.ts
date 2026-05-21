/**
 * Unit tests — Voice Intent normalisation (server/services/voice-intent.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.5
 */

import { describe, it, expect } from "vitest";
import { normalizeVoiceIntent } from "../services/voice-intent";

const TRANSCRIPT = "Should we expand Northwind into the German mid-market and what would it take";

describe("voice-intent — normalizeVoiceIntent", () => {
  it("normalizes a well-formed intent", () => {
    const intent = normalizeVoiceIntent(
      {
        projectName: "Germany mid-market expansion",
        projectDescription: "Assess entering the German mid-market for Northwind.",
        summary: "Evaluate German expansion.",
        confidence: "high",
      },
      TRANSCRIPT,
    );
    expect(intent.projectName).toBe("Germany mid-market expansion");
    expect(intent.confidence).toBe("high");
    expect(intent.summary).toBe("Evaluate German expansion.");
  });

  it("defaults an invalid confidence to low", () => {
    const intent = normalizeVoiceIntent(
      { projectName: "X", projectDescription: "Y", confidence: "certain" },
      TRANSCRIPT,
    );
    expect(intent.confidence).toBe("low");
  });

  it("falls back to the transcript when the LLM gives nothing", () => {
    const intent = normalizeVoiceIntent({}, TRANSCRIPT);
    expect(intent.projectName.length).toBeGreaterThan(0);
    expect(intent.projectDescription).toBe(TRANSCRIPT);
    expect(intent.confidence).toBe("low");
  });

  it("derives a name of at most 8 words from the transcript fallback", () => {
    const intent = normalizeVoiceIntent({}, TRANSCRIPT);
    expect(intent.projectName.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it("handles a non-object payload", () => {
    const intent = normalizeVoiceIntent(null, TRANSCRIPT);
    expect(intent.confidence).toBe("low");
    expect(intent.projectDescription).toBe(TRANSCRIPT);
  });

  it("caps the project name at 255 characters", () => {
    const longName = "word ".repeat(100);
    const intent = normalizeVoiceIntent(
      { projectName: longName, projectDescription: "d", confidence: "high" },
      TRANSCRIPT,
    );
    expect(intent.projectName.length).toBeLessThanOrEqual(255);
  });

  it("summary falls back to the description when missing", () => {
    const intent = normalizeVoiceIntent(
      { projectName: "N", projectDescription: "The description.", confidence: "medium" },
      TRANSCRIPT,
    );
    expect(intent.summary).toBe("The description.");
  });

  it("produces a usable name even for an empty transcript", () => {
    const intent = normalizeVoiceIntent({}, "");
    expect(intent.projectName).toBe("Untitled project");
  });
});
