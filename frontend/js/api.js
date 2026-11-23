const API_BASE = () => (window.PULSE_API_BASE || "").replace(/\/$/, "");

export function apiUrl(path) {
  const base = API_BASE();
  if (!path.startsWith("/")) path = `/${path}`;
  return `${base}${path}`;
}

export async function apiGet(path, params = {}) {
  const url = new URL(apiUrl(path), window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  // When API_BASE is absolute, URL constructor still works with full href
  const href = API_BASE() ? `${API_BASE()}${path.startsWith("/") ? path : `/${path}`}${url.search}` : `${url.pathname}${url.search}`;
  const res = await fetch(href, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export function wsUrl() {
  const base = API_BASE();
  if (base) {
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws/live";
    u.search = "";
    return u.toString();
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/live`;
}
