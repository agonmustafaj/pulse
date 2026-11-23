/** JSON response helpers matching FastAPI shapes. */

export function nowIso() {
  return new Date().toISOString();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30",
    },
  });
}

export function meta(ok, source, extra = {}) {
  return {
    ok,
    source,
    updated_at: nowIso(),
    cached: false,
    ...extra,
  };
}
