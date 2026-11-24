import { json, nowIso } from "./_lib/json.js";
import { getAnalytics } from "./_lib/services/analytics.js";

export async function onRequestGet(context) {
  try {
    const data = await getAnalytics(context.env || {});
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "analytics",
      updated_at: nowIso(),
      message: String(exc.message || exc),
    });
  }
}
