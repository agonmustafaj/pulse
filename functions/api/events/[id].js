import { json, nowIso } from "../_lib/json.js";
import { getEvent } from "../_lib/services/events.js";

export async function onRequestGet(context) {
  const eventId = context.params.id;
  const event = await getEvent(eventId);
  if (!event) {
    return json({ ok: false, error: "Event not found", detail: "Event not found" }, 404);
  }
  return json({ ok: true, item: event, updated_at: nowIso() });
}
