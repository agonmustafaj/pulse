import { json, nowIso } from "./_lib/json.js";
import { getSpace } from "./_lib/services/space.js";

export async function onRequestGet(context) {
  try {
    const data = await getSpace(context.env || {});
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
