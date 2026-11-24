/** Fetch helpers for Pages Functions (mirrors backend/app/utils/http.py). */

const DEFAULT_TIMEOUT_MS = 20000;

export async function fetchJson(url, { params, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const u = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json", ...(headers || {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${u.hostname}: ${text.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers, redirect = "follow" } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html, application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "PULSE/1.0 (galaxy; https://pulse-bw6.pages.dev)",
        ...(headers || {}),
      },
      redirect,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return { text: await res.text(), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}
