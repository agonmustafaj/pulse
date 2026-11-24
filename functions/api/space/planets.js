import { json, nowIso } from "../_lib/json.js";
import { getPlanets } from "../_lib/services/space.js";

export async function onRequestGet() {
  try {
    const data = await getPlanets();
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      message: String(exc.message || exc),
      updated_at: nowIso(),
    });
  }
}
