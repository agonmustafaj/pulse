import { json, nowIso } from "./_lib/json.js";
import { hasNasaApiKey } from "./_lib/providers/space.js";

export async function onRequestGet(context) {
  const env = context?.env || {};
  return json({
    ok: true,
    status: "online",
    service: "PULSE",
    runtime: "cloudflare-pages",
    updated_at: nowIso(),
    // Boolean only: never echo the secret
    nasa_api_key_configured: hasNasaApiKey(env),
  });
}
