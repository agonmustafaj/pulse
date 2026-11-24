import { json, nowIso } from "../_lib/json.js";
import { getApod } from "../_lib/services/space.js";

/** GET /api/space/apod?date=YYYY-MM-DD — Astronomy Picture of the Day for a date (default today). */
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get("date") || undefined;
    const data = await getApod(context.env || {}, date);
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      missing: false,
      apod: null,
      message: String(exc.message || exc),
      source: "NASA APOD",
      updated_at: nowIso(),
    });
  }
}
