import { fetchJson, fetchText } from "../http.js";
import { parseFeed } from "../rss.js";

const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World", category: "world" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC Technology", category: "technology" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC Science", category: "science" },
  { url: "https://www.nasa.gov/news-release/feed/", source: "NASA", category: "science" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian", category: "world" },
  { url: "https://www.theguardian.com/environment/rss", source: "The Guardian Environment", category: "environment" },
  { url: "https://www.theguardian.com/business/rss", source: "The Guardian Business", category: "business" },
];

async function sha1Hex(text) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function articleId(url, title) {
  return `news-${await sha1Hex(`${url}|${title}`)}`;
}

export async function fetchRssNews(limitPerFeed = 12) {
  const articles = [];
  await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const { text: xml } = await fetchText(feed.url);
        const entries = parseFeed(xml).slice(0, limitPerFeed);
        for (const entry of entries) {
          articles.push({
            id: await articleId(entry.link, entry.title),
            headline: entry.title,
            description: entry.summary ? entry.summary.replace(/<[^>]+>/g, "").slice(0, 400) : null,
            source: feed.source,
            published: entry.published,
            category: feed.category,
            url: entry.link,
            image_url: entry.image,
          });
        }
      } catch {
        /* skip failed feed */
      }
    })
  );
  articles.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });
  return articles;
}

export async function fetchNewsApi(env = {}, { query, category } = {}) {
  if (!env.NEWS_API_KEY) return [];
  const params = { apiKey: env.NEWS_API_KEY, pageSize: 30, language: "en" };
  let url;
  if (query) {
    params.q = query;
    url = "https://newsapi.org/v2/everything";
  } else {
    params.country = "us";
    if (category) params.category = category;
    url = "https://newsapi.org/v2/top-headlines";
  }
  const data = await fetchJson(url, { params });
  const articles = [];
  for (const item of data.articles || []) {
    const link = item.url || "";
    const title = item.title || "Untitled";
    articles.push({
      id: await articleId(link, title),
      headline: title,
      description: item.description || null,
      source: item.source?.name || "NewsAPI",
      published: item.publishedAt || null,
      category: category || "world",
      url: link,
      image_url: item.urlToImage || null,
    });
  }
  return articles;
}
