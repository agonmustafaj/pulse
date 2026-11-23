import { json, nowIso } from "./_lib/json.js";

export async function onRequestGet() {
  return json({
    ok: true,
    status: "online",
    service: "PULSE",
    runtime: "cloudflare-pages",
    updated_at: nowIso(),
  });
}
