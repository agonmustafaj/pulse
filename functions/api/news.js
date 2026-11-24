import { json, nowIso } from "./_lib/json.js";
import { getNews } from "./_lib/services/news.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  try {
    const data = await getNews(context.env || {}, {
      category: url.searchParams.get("category") || undefined,
      query: url.searchParams.get("query") || undefined,
      source: url.searchParams.get("source") || undefined,
      limit: Number(url.searchParams.get("limit") || 50),
    });
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "news",
      updated_at: nowIso(),
      message: String(exc.message || exc),
      items: [],
      total: 0,
    });
  }
}
