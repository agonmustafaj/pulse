import { json, nowIso } from "../../_lib/json.js";
import { getHistory } from "../../_lib/services/markets.js";

export async function onRequestGet(context) {
  const symbol = decodeURIComponent(context.params.symbol || "");
  const url = new URL(context.request.url);
  const range = url.searchParams.get("range") || "1m";
  try {
    const hist = await getHistory(symbol, range);
    return json({ ok: true, ...hist, updated_at: nowIso() });
  } catch (exc) {
    return json({
      ok: false,
      symbol,
      range,
      points: [],
      error: String(exc.message || exc),
    });
  }
}
