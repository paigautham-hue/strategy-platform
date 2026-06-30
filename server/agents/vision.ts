/**
 * Vision agent — multimodal in/out (IMPLEMENTATION_PLAN.md Phase 4)
 *
 * IN  — extract structured content from an image (slide, whiteboard, chart,
 *        screenshot) by sending it to the multimodal model through the LLM
 *        router (C3). The image is first stored in S3 and passed by URL, so the
 *        base64 never inflates the budget/token estimate and the router's
 *        redaction (C5) still runs on the text instruction.
 * OUT — generate a stylised raster image (e.g. a diagram export) via the real
 *        forge image service (`server/_core/imageGeneration.ts`).
 *
 * Best-effort: on failure the extractor returns an empty result rather than throwing.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { storagePut } from "server/storage";
import { generateImage } from "../_core/imageGeneration";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — guards the request + storage

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface VisionExtractResult {
  /** The model's structured extraction of the image. */
  text: string;
  /** The stored image URL the model read from. */
  imageUrl: string;
}

const EXTRACT_SYSTEM =
  "You are a precise visual analyst for a strategy platform. Extract what the " +
  "image actually shows — read every legible label, axis, number, and relationship. " +
  "For a chart: name the chart type, axes, series, and the key values/trends. For a " +
  "slide or whiteboard: transcribe the text verbatim and capture the structure " +
  "(titles, bullets, boxes, arrows). For a table: reproduce it. Do NOT invent data " +
  "that isn't visible; if something is illegible, say so.";

/**
 * Extract structured content from an image. `imageBase64` is the raw base64 (no
 * data-URL prefix). Returns an empty extraction on any failure.
 */
export async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  instruction: string,
  ctx: RouterContext,
): Promise<VisionExtractResult> {
  const buffer = Buffer.from(imageBase64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Image is empty or exceeds the 8 MB limit.");
  }
  const ext = EXT_BY_MIME[mimeType] ?? "png";
  const { url } = await storagePut(`vision/${Date.now()}-${buffer.length}.${ext}`, buffer, mimeType);

  const ask = instruction.trim() || "Extract everything legible in this image as structured text.";

  try {
    const result = await router.complete({
      systemPrompt: EXTRACT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ask },
            { type: "image_url", image_url: { url, detail: "high" } },
          ],
        },
      ],
      ctx,
    });
    return { text: result.content.trim(), imageUrl: url };
  } catch {
    return { text: "", imageUrl: url };
  }
}

export interface VisionGenerateResult {
  url: string | null;
}

/** Generate a raster image from a prompt (image-out). Best-effort. */
export async function generateVisual(prompt: string): Promise<VisionGenerateResult> {
  const p = prompt.trim();
  if (!p) return { url: null };
  try {
    const { url } = await generateImage({ prompt: p });
    return { url: url ?? null };
  } catch {
    return { url: null };
  }
}
