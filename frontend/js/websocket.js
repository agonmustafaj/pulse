import { wsUrl } from "./api.js";

let socket;
let retries = 0;

export function connectLive(onMessage) {
  try {
    socket?.close();
    socket = new WebSocket(wsUrl());
  } catch {
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
  socket.addEventListener("close", () => {
    const delay = Math.min(30000, 2000 * 2 ** retries);
    retries += 1;
    setTimeout(() => connectLive(onMessage), delay);
  });
}
