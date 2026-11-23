import { json, nowIso } from "./_lib/json.js";
import { search } from "./_lib/services/search.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").slice(0, 120);
  try {
    const data = await search(context.env || {}, q);
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "search",
      updated_at: nowIso(),
      query: q,
      message: String(exc.message || exc),
      items: [],
    });
  }
}
