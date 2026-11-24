import { apiGet } from "./api.js";
import { relativeTime, sourceLabel } from "./ui.js";

const APOD_MIN = "1995-06-16";

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function clampApodDate(value) {
  if (!value) return todayUTC();
  if (value < APOD_MIN) return APOD_MIN;
  const today = todayUTC();
  if (value > today) return today;
  return value;
}

/** Shared date-search control + render helpers for APOD. */
export function apodDateControls({ idPrefix = "apod", initialDate } = {}) {
  const date = clampApodDate(initialDate || todayUTC());
  return `
    <form class="apod-date-bar" id="${idPrefix}-date-form" autocomplete="off">
      <label class="apod-date-label" for="${idPrefix}-date-input">APOD date</label>
      <input
        type="date"
        id="${idPrefix}-date-input"
        name="date"
        class="apod-date-input"
        min="${APOD_MIN}"
        max="${todayUTC()}"
        value="${date}"
        required
      />
      <button type="submit" class="btn primary apod-date-go">Show</button>
      <button type="button" class="btn ghost" id="${idPrefix}-date-today" title="Today's APOD">Today</button>
    </form>
  `;
}

export function bindApodDateControls(root, { idPrefix = "apod", onDate } = {}) {
  const form = root.querySelector(`#${idPrefix}-date-form`);
  const input = root.querySelector(`#${idPrefix}-date-input`);
  const todayBtn = root.querySelector(`#${idPrefix}-date-today`);
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = clampApodDate(input.value);
    input.value = date;
    onDate?.(date);
  });
  todayBtn?.addEventListener("click", () => {
    const date = todayUTC();
    input.value = date;
    onDate?.(date);
  });
}

function isPlaceholderUrl(url) {
  if (!url) return true;
  const u = String(url).toLowerCase();
  return u.includes("nasa-logo") || u.includes("/themes/nasa-child/") || u.includes("favicon");
}

function youtubeThumb(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

/** Resolve best visual URL: HD image, standard image, or video thumbnail. */
export function apodDisplayUrl(apod) {
  if (!apod) return null;
  if (apod.display_url && !isPlaceholderUrl(apod.display_url)) return apod.display_url;
  if (apod.media_type === "image") {
    if (apod.hdurl && !isPlaceholderUrl(apod.hdurl)) return apod.hdurl;
    if (apod.url && !isPlaceholderUrl(apod.url)) return apod.url;
    return null;
  }
  if (apod.media_type === "video") {
    if (apod.thumbnail_url && !isPlaceholderUrl(apod.thumbnail_url)) return apod.thumbnail_url;
    return youtubeThumb(apod.url) || youtubeThumb(apod.hdurl);
  }
  return null;
}

export function renderApodHeroMedia(apod, { hero = false } = {}) {
  if (!apod) return "";
  const src = apodDisplayUrl(apod);
  if (apod.media_type === "image" && src) {
    return `<img class="apod-media${hero ? " apod-media-hero" : ""}" src="${src}" alt="${escapeAttr(apod.title || "Astronomy Picture of the Day")}" />`;
  }
  if (apod.media_type === "video") {
    return `
      <div class="apod-video${hero ? " apod-media-hero" : ""}">
        ${src ? `<img src="${src}" alt="" class="apod-video-thumb" />` : `<div class="apod-video-fallback"></div>`}
        <a class="btn primary" href="${apod.url || "#"}" target="_blank" rel="noopener">Watch media</a>
      </div>`;
  }
  return `<div class="empty">Media unavailable for this entry</div>`;
}

export function renderApodNeedsKey(message) {
  return `
    <div class="apod-empty apod-needs-key">
      <div class="apod-empty-title">Add NASA_API_KEY</div>
      <p class="muted">${escapeHtml(
        message ||
          "Astronomy Picture of the Day needs a real NASA API key on this Cloudflare Pages environment (Production and Preview)."
      )}</p>
      <p class="mono muted" style="margin-top:10px">Pages → Settings → Environment variables → NASA_API_KEY</p>
      <p class="muted" style="margin-top:8px;font-size:12px">Free key: <a href="https://api.nasa.gov/" target="_blank" rel="noopener">api.nasa.gov</a>. DEMO_KEY only returns a site logo — PULSE will not show it.</p>
    </div>`;
}

export function renderApodEmpty(message, date, { needsKey = false } = {}) {
  if (needsKey) return renderApodNeedsKey(message);
  return `
    <div class="apod-empty">
      <div class="apod-empty-title">No picture for this date</div>
      <p class="muted">${escapeHtml(message || "NASA has no Astronomy Picture of the Day for this date.")}</p>
      ${date ? `<div class="mono muted">${escapeHtml(date)}</div>` : ""}
    </div>`;
}

export function renderApodCard(apod, { compact = false, needsKey = false, message = null } = {}) {
  if (needsKey) return renderApodNeedsKey(message);
  if (!apod || !apodDisplayUrl(apod)) {
    return renderApodEmpty(message || "APOD unavailable.");
  }
  const blurb = compact
    ? (apod.explanation || "").slice(0, 220)
    : (apod.explanation || "").slice(0, 520);
  const more = (apod.explanation || "").length > blurb.length ? "…" : "";
  return `
    <div class="apod-card">
      ${renderApodHeroMedia(apod)}
      <div class="apod-card-body">
        <h3 class="apod-title">${escapeHtml(apod.title || "Astronomy Picture of the Day")}</h3>
        <p class="muted apod-blurb">${escapeHtml(blurb)}${more}</p>
        <div class="mono muted apod-meta">
          ${apod.date || ""} ${apod.copyright ? `· © ${escapeHtml(apod.copyright)}` : ""} · NASA APOD
        </div>
      </div>
    </div>`;
}

export async function fetchApodByDate(date) {
  const d = clampApodDate(date);
  try {
    const data = await apiGet("/api/space/apod", { date: d });
    return data;
  } catch (err) {
    try {
      const bundle = await apiGet("/api/space", { date: d });
      return {
        ok: Boolean(bundle.apod),
        missing: !bundle.apod,
        needs_api_key: Boolean(bundle.apod_meta?.needs_api_key || bundle.has_nasa_key === false),
        has_nasa_key: bundle.has_nasa_key,
        date: d,
        message:
          bundle.apod_meta?.message ||
          (!bundle.apod ? "No Astronomy Picture of the Day for this date." : null),
        apod: bundle.apod || null,
        source: "NASA APOD",
      };
    } catch (err2) {
      return {
        ok: false,
        missing: false,
        date: d,
        message: err2.message || err.message || "Could not load APOD",
        apod: null,
      };
    }
  }
}

export function archiveStrip(items = []) {
  if (!items.length) return `<div class="empty">Archive unavailable</div>`;
  return `
    <div class="apod-archive">
      ${items
        .map((a) => {
          const src = apodDisplayUrl(a);
          if (!src || a.media_type === "video") {
            return `<button type="button" class="apod-thumb muted" data-date="${a?.date || ""}" ${src ? "" : "disabled"}>
              ${src ? `<img src="${src}" alt="" loading="lazy" />` : ""}
              <span class="mono">${a?.date?.slice(5) || "—"}</span>
            </button>`;
          }
          return `
            <button type="button" class="apod-thumb" data-date="${a.date}" title="${escapeAttr(a.title || a.date)}">
              <img src="${src}" alt="" loading="lazy" />
              <span class="mono">${a.date?.slice(5) || ""}</span>
            </button>`;
        })
        .join("")}
    </div>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export { relativeTime, sourceLabel, APOD_MIN };
