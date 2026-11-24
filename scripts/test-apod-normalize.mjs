/**
 * Unit + live scrape checks for APOD logo rejection and HTML fallback.
 * Run: node scripts/test-apod-normalize.mjs
 */
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(pathToFileURL(join(root, "functions/api/_lib/providers/space.js")).href);

const {
  isPlaceholderApodUrl,
  isUsableApodMedia,
  hasNasaApiKey,
  parseApodHtml,
  scrapeApodHtml,
  fetchApod,
} = mod;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.log("FAIL", msg);
  } else {
    console.log("OK  ", msg);
  }
}

assert(hasNasaApiKey({ NASA_API_KEY: "DEMO_KEY" }) === false, "DEMO_KEY rejected");
assert(
  isPlaceholderApodUrl(
    "https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png"
  ),
  "meatball is placeholder"
);

const brokenApiHtml = `
<html><head><title>APOD: 2026 November 24 - Galaxies Battle in the NGC 7771 Group - NASA Science</title>
<meta property="og:image" content="https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/november/NGC7771group_Marinoni_1179.jpg/jcr:content/renditions/cq5dam.web.1280.1280.jpeg" />
</head><body><h1>Galaxies Battle in the NGC 7771 Group</h1>
<img src="https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/november/NGC7771group_Marinoni_1179.jpg?w=1280" />
</body></html>`;

const parsed = parseApodHtml(brokenApiHtml, { date: "2026-11-24" });
assert(parsed && parsed.title === "Galaxies Battle in the NGC 7771 Group", "parse title from h1");
assert(parsed && isUsableApodMedia(parsed), "parsed media is usable");
assert(parsed && !isPlaceholderApodUrl(parsed.display_url), "parsed url is not logo");
assert(parsed.display_url.includes("NGC7771") || parsed.display_url.includes("cds/apod"), "prefer apod CDN path");

const ytHtml = `
<title>APOD Video - NASA Science</title>
<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`;
const yt = parseApodHtml(ytHtml, { date: "2020-01-01" });
assert(yt && yt.media_type === "video", "youtube iframe → video");
assert(yt && yt.thumbnail_url && yt.thumbnail_url.includes("img.youtube.com"), "youtube thumb");

console.log("\nLive scrape (network)…");
const live = await scrapeApodHtml("2026-11-24");
assert(live && isUsableApodMedia(live), "live scrape 2026-11-24 usable");
if (live) console.log("   ", live.title, "→", (live.display_url || "").slice(0, 90));

const liveOld = await scrapeApodHtml("2024-11-20");
assert(liveOld && isUsableApodMedia(liveOld), "live scrape 2024-11-20 usable");
if (liveOld) console.log("   ", liveOld.title, "→", (liveOld.display_url || "").slice(0, 90));

const resolved = await fetchApod({}, "2026-11-24");
assert(resolved && isUsableApodMedia(resolved), "fetchApod without key still scrapes HTML");
assert(!String(resolved.display_url || "").includes("nasa-logo"), "no logo in resolved media");

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
