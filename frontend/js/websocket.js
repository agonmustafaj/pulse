import { wsUrl } from "./api.js";

let socket;
let retries = 0;
const MAX_RETRIES = 3;

export function connectLive(onMessage) {
  // Pages Functions have no /ws/live; REST polling covers views.
  if (retries >= MAX_RETRIES) return;
  try {
    socket?.close();
    socket = new WebSocket(wsUrl());
  } catch {
    retries = MAX_RETRIES;
    return;
  }
  socket.addEventListener("open", () => {
    retries = 0;
  });
  socket.addEventListener("message", (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  });
  socket.addEventListener("error", () => {
    retries = Math.max(retries, MAX_RETRIES - 1);
  });
  socket.addEventListener("close", () => {
    retries += 1;
    if (retries >= MAX_RETRIES) return;
    const delay = Math.min(30000, 2000 * 2 ** retries);
    setTimeout(() => connectLive(onMessage), delay);
  });
}
