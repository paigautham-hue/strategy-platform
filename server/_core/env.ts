export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** OpenAI API key — used ONLY for text-embedding-3-small in router.embed(),
   *  and (opt-in) the OpenAI Realtime voice fallback. Never exposed to the
   *  client. Manus forge has no /v1/embeddings endpoint. */
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  /** Google Gemini API key — used ONLY for Gemini Live realtime voice (the
   *  default voice engine). Needs Live API access. Minted into a short-lived
   *  ephemeral token server-side; the raw key never reaches the browser
   *  except on the degraded raw-key fallback. Single source of truth across
   *  the three accepted env names. */
  geminiApiKey:
    process.env.GOOGLE_GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY ??
    "",
  /** Anthropic API key — used ONLY by server/_core/anthropic.ts, which is
   *  called exclusively through the LLM router choke-point (C3). Powers the
   *  planner (claude-fable-5) and extraction (claude-haiku-4-5) tiers in
   *  models.yaml. When absent, those tiers degrade to the forge provider. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  /** Per-user/day LLM spend caps (P8). Warn past the soft cap, block past the
   *  hard cap. Set either to 0 to disable. */
  costSoftCapUsdPerUserPerDay: Number(process.env.COST_SOFT_CAP_USD_PER_USER_PER_DAY ?? "10"),
  costHardCapUsdPerUserPerDay: Number(process.env.COST_HARD_CAP_USD_PER_USER_PER_DAY ?? "25"),
};
