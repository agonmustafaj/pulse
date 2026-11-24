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
export function apodDateControls({ idPrefix = "apod", initialDate, onChange } = {}) {
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

export function renderApodHeroMedia(apod, { hero = false } = {}) {
  if (!apod) return "";
  if (apod.media_type === "image" && apod.url) {
    const src = apod.hdurl || apod.url;
    return `<img class="apod-media${hero ? " apod-media-hero" : ""}" src="${src}" alt="${escapeAttr(apod.title || "Astronomy Picture of the Day")}" />`;
  }
  if (apod.media_type === "video" && apod.url) {
    const thumb = apod.thumbnail_url;
    return `
      <div class="apod-video${hero ? " apod-media-hero" : ""}">
        ${thumb ? `<img src="${thumb}" alt="" class="apod-video-thumb" />` : `<div class="apod-video-fallback"></div>`}
        <a class="btn primary" href="${apod.url}" target="_blank" rel="noopener">Watch media</a>
      </div>`;
  }
  return `<div class="empty">Media unavailable for this entry</div>`;
}

export function renderApodEmpty(message, date) {
  return `
    <div class="apod-empty">
      <div class="apod-empty-title">No picture for this date</div>
      <p class="muted">${escapeHtml(message || "NASA has no Astronomy Picture of the Day for this date.")}</p>
      ${date ? `<div class="mono muted">${escapeHtml(date)}</div>` : ""}
    </div>`;
}

export function renderApodCard(apod, { compact = false } = {}) {
  if (!apod) return renderApodEmpty("APOD unavailable.");
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
    // Fallback: /api/space?date=
    try {
      const bundle = await apiGet("/api/space", { date: d });
      return {
        ok: Boolean(bundle.apod),
        missing: !bundle.apod,
        date: d,
        message: bundle.apod_meta?.message || (!bundle.apod ? "No Astronomy Picture of the Day for this date." : null),
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
          if (!a?.url || a.media_type !== "image") {
            return `<button type="button" class="apod-thumb muted" data-date="${a?.date || ""}" disabled>${a?.date || "—"}</button>`;
          }
          return `
            <button type="button" class="apod-thumb" data-date="${a.date}" title="${escapeAttr(a.title || a.date)}">
              <img src="${a.url}" alt="" loading="lazy" />
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
