import { json, nowIso } from "./_lib/json.js";
import { getMarkets } from "./_lib/services/markets.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  try {
    const data = await getMarkets({ category: url.searchParams.get("category") || undefined });
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "markets",
      updated_at: nowIso(),
      message: String(exc.message || exc),
      items: [],
    });
  }
}
