import { json, nowIso } from "./_lib/json.js";
import { getEvents } from "./_lib/services/events.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const category = url.searchParams.get("category") || undefined;
  const region = url.searchParams.get("region") || undefined;
  const limit = Number(url.searchParams.get("limit") || 100);
  try {
    const data = await getEvents({ category, region, limit });
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "events",
      updated_at: nowIso(),
      message: String(exc.message || exc),
      items: [],
      total: 0,
    });
  }
}
