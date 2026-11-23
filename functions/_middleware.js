/**
 * Optional CORS / security headers for Functions.
 * Same-origin SPA does not need CORS; kept permissive for local wrangler tooling.
 */
export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("X-PULSE-Runtime", "cloudflare-pages");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
