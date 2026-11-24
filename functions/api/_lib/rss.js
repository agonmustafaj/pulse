/** Minimal RSS/Atom parser (no feedparser dependency). */

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function attr(block, name, attrName) {
  const re = new RegExp(`<${name}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * @returns {{ title: string, link: string, summary: string|null, published: string|null, image: string|null }[]}
 */
export function parseFeed(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const entryBlocks = itemBlocks.length ? itemBlocks : xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];

  for (const block of entryBlocks) {
    const title = tag(block, "title") || "Untitled";
    let link = tag(block, "link") || "";
    if (!link) {
      const href = attr(block, "link", "href");
      if (href) link = href;
    }
    const summary = tag(block, "description") || tag(block, "summary") || tag(block, "content") || null;
    const published =
      parseDate(tag(block, "pubDate")) ||
      parseDate(tag(block, "published")) ||
      parseDate(tag(block, "updated")) ||
      null;
    const image =
      attr(block, "media:thumbnail", "url") ||
      attr(block, "media:content", "url") ||
      attr(block, "enclosure", "url") ||
      null;
    items.push({ title, link, summary, published, image });
  }
  return items;
}
