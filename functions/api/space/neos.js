import { json, nowIso } from "../_lib/json.js";
import { getNeos } from "../_lib/services/space.js";

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const start = url.searchParams.get("start_date") || undefined;
    const end = url.searchParams.get("end_date") || undefined;
    const data = await getNeos(context.env || {}, start, end);
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      items: [],
      message: String(exc.message || exc),
      source: "NASA NeoWs",
      updated_at: nowIso(),
    });
  }
}
