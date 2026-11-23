import { json, nowIso } from "../_lib/json.js";
import { getIss } from "../_lib/services/space.js";

export async function onRequestGet() {
  try {
    const pos = await getIss();
    return json({ ok: true, ...pos });
  } catch (exc) {
    return json({ ok: false, error: String(exc.message || exc), updated_at: nowIso() });
  }
}
