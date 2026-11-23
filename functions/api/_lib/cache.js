/**
 * TTL cache for Pages Functions.
 * Uses Cache API when available (cross-isolate), plus in-memory for the current isolate.
 */

const memory = new Map();

function memGet(key) {
  const item = memory.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return item.value;
}

function memSet(key, value, ttlSec) {
  memory.set(key, { expires: Date.now() + ttlSec * 1000, value });
}

export async function cacheGet(key) {
  const local = memGet(key);
  if (local !== null && local !== undefined) return local;

  try {
    if (typeof caches === "undefined") return null;
    const cache = caches.default;
    const req = new Request(`https://pulse-cache.internal/${encodeURIComponent(key)}`);
    const hit = await cache.match(req);
    if (!hit) return null;
    const data = await hit.json();
    if (!data || data.expires < Date.now()) return null;
    memSet(key, data.value, Math.max(1, Math.floor((data.expires - Date.now()) / 1000)));
    return data.value;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSec) {
  memSet(key, value, ttlSec);
  try {
    if (typeof caches === "undefined") return;
    const cache = caches.default;
    const req = new Request(`https://pulse-cache.internal/${encodeURIComponent(key)}`);
    const body = JSON.stringify({ expires: Date.now() + ttlSec * 1000, value });
    await cache.put(
      req,
      new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttlSec}`,
        },
      })
    );
  } catch {
    /* Cache API optional */
  }
}
