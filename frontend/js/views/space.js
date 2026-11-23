import { apiGet } from "../api.js";
import { createMap, upsertIssMarker, flyTo } from "../map.js";
import { fmtNum, sourceLabel, relativeTime, refreshIcons, setError } from "../ui.js";

let map;
let marker;
let timer;
let loaded;

export async function renderSpace(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="kicker">Orbit</div>
        <h2>Space</h2>
        <p class="muted">ISS tracker · launch schedule · APOD when available</p>
      </div>
      <div class="mono muted" id="iss-stamp">—</div>
    </div>
    <div class="grid-2" style="min-height:360px">
      <div class="panel" style="position:relative;min-height:320px;overflow:hidden">
        <div id="space-map" style="position:absolute;inset:0"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">ISS</div></div>
        <div class="panel-body" id="iss-panel"><div class="loading">Loading…</div></div>
        <div class="source-line" id="space-source"></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Upcoming launches</div></div>
        <div class="panel-body" id="launch-list"><div class="loading">Loading…</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Astronomy Picture of the Day</div></div>
        <div class="panel-body" id="apod"><div class="muted">Loading…</div></div>
      </div>
    </div>
  `;
  if (!loaded) {
    map = createMap("space-map", { zoom: 1.5 });
    loaded = true;
  } else {
    // remount container — recreate map
    map?.remove();
    map = createMap("space-map", { zoom: 1.5 });
  }
  await load();
  clearInterval(timer);
  timer = setInterval(loadIss, 20000);
  refreshIcons();
}

async function load() {
  try {
    const data = await apiGet("/api/space");
    document.getElementById("space-source").textContent = sourceLabel(data.source, data.updated_at);
    if (data.iss) renderIss(data.iss);
    const launches = data.launches || [];
    document.getElementById("launch-list").innerHTML = launches.length
      ? launches
          .map(
            (l) => `
        <div class="list-item">
          <div class="item-meta"><span class="badge cyan">${l.status || "scheduled"}</span><span>${l.provider || ""}</span></div>
          <div class="item-title">${l.name}</div>
          <div class="item-meta"><span>${l.location || l.pad || "—"}</span><span>${l.net ? relativeTime(l.net) : ""}</span></div>
        </div>`
          )
          .join("")
      : `<div class="empty">No launches</div>`;

    const apod = data.apod;
    const apodEl = document.getElementById("apod");
    if (apod && apod.url) {
      apodEl.innerHTML = `
        ${apod.media_type === "image" ? `<img src="${apod.url}" alt="${apod.title || "APOD"}" style="width:100%;border-radius:6px;border:1px solid var(--border)" />` : `<a href="${apod.url}" target="_blank" rel="noopener">Open media</a>`}
        <h3 style="margin:10px 0 6px;font-size:15px">${apod.title || ""}</h3>
        <p class="muted" style="font-size:12px">${(apod.explanation || "").slice(0, 420)}${(apod.explanation || "").length > 420 ? "…" : ""}</p>
        <div class="mono muted" style="margin-top:8px">${apod.date || ""} ${apod.copyright ? "· © " + apod.copyright : ""} · NASA APOD</div>
      `;
    } else {
      apodEl.innerHTML = `<div class="empty">APOD unavailable (set NASA_API_KEY for reliable access). Other space data still loads.</div>`;
    }
  } catch (err) {
    setError(document.getElementById("iss-panel"), err.message);
  }
}

async function loadIss() {
  try {
    const data = await apiGet("/api/space/iss");
    if (data.ok !== false && data.latitude != null) renderIss(data);
  } catch {
    /* keep last */
  }
}

function renderIss(iss) {
  document.getElementById("iss-panel").innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="label">Latitude</div><div class="value" style="font-size:16px">${fmtNum(iss.latitude, 3)}</div></div>
      <div class="stat"><div class="label">Longitude</div><div class="value" style="font-size:16px">${fmtNum(iss.longitude, 3)}</div></div>
      <div class="stat"><div class="label">Altitude</div><div class="value" style="font-size:16px">${iss.altitude_km != null ? fmtNum(iss.altitude_km, 1) + " km" : "—"}</div></div>
      <div class="stat"><div class="label">Velocity</div><div class="value" style="font-size:16px">${iss.velocity_kmh != null ? fmtNum(iss.velocity_kmh, 0) + " km/h" : "—"}</div></div>
    </div>
    <div class="muted" style="margin-top:10px">Visibility: ${iss.visibility || "—"}</div>
  `;
  document.getElementById("iss-stamp").textContent = `Updated ${iss.timestamp || "—"} · ${iss.source || ""}`;
  marker = upsertIssMarker(map, iss, marker);
  flyTo(map, iss.longitude, iss.latitude, 2.4);
}
