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
};
