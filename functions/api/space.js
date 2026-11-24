import { json, nowIso } from "./_lib/json.js";
import { getSpace } from "./_lib/services/space.js";

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get("date") || undefined;
    const data = await getSpace(context.env || {}, { date });
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "space",
      updated_at: nowIso(),
      message: String(exc.message || exc),
    });
  }
}
