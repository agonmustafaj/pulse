import { apiGet } from "../api.js";
import {
  apodDateControls,
  archiveStrip,
  bindApodDateControls,
  clampApodDate,
  fetchApodByDate,
  renderApodCard,
  renderApodEmpty,
  todayUTC,
} from "../apod.js";
import { createMap, upsertIssMarker, flyTo, ISS_MAP_ZOOM } from "../map.js";
import { createSolarSystem } from "../solar-system.js";
import {
  fmtNum,
  sourceLabel,
  relativeTime,
  refreshIcons,
  setError,
  animateIn,
  siteFooter,
} from "../ui.js";

let map;
let marker;
let timer;
let solar;
let loaded;
let issCentered;
let currentApodDate = todayUTC();

function initialOrbitTab(focus) {
  if (focus === "iss" || focus === "apod" || focus === "launches" || focus === "neos") return focus;
  return "planets";
}

export async function renderSpace(root, params = {}) {
  const focus = params.focus || "";
  const tab = initialOrbitTab(focus);

  root.innerHTML = `
    <div class="space-page">
      <div class="page-head space-head">
        <div>
          <div class="kicker">Primary experience</div>
          <h2>Orbit</h2>
          <p class="muted">Planets · ISS · APOD archive · launches · near-Earth objects</p>
        </div>
        <div class="space-tabs" role="tablist">
          <button type="button" class="chip${tab === "planets" ? " active" : ""}" data-tab="planets">Planets</button>
          <button type="button" class="chip${tab === "iss" ? " active" : ""}" data-tab="iss">ISS</button>
          <button type="button" class="chip${tab === "apod" ? " active" : ""}" data-tab="apod">APOD</button>
          <button type="button" class="chip${tab === "launches" ? " active" : ""}" data-tab="launches">Launches</button>
          <button type="button" class="chip${tab === "neos" ? " active" : ""}" data-tab="neos">NEOs</button>
        </div>
      </div>

      <section class="space-panel${tab === "planets" ? " active" : ""}" data-panel="planets" id="panel-planets">
        <div class="orbit-stage tall">
          <canvas id="space-solar" aria-label="Solar system"></canvas>
        </div>
        <div class="orbit-attribution mono muted" id="space-planet-attr">Loading ephemeris…</div>
        <div class="orbit-legend" id="space-planet-legend"></div>
      </section>

      <section class="space-panel${tab === "iss" ? " active" : ""}" data-panel="iss" id="panel-iss">
        <div class="grid-2 space-iss-grid">
          <div class="map-frame" aria-label="ISS tracker map">
            <div id="space-map"></div>
          </div>
          <div class="space-side">
            <div class="kicker">Live track</div>
            <h3>International Space Station</h3>
            <div id="iss-panel"><div class="loading">Loading…</div></div>
            <div class="source-line bare" id="space-source"></div>
            <div class="mono muted" id="iss-stamp">-</div>
          </div>
        </div>
      </section>

      <section class="space-panel${tab === "apod" ? " active" : ""}" data-panel="apod" id="panel-apod">
        <div class="apod-explorer">
          <div class="apod-explorer-head">
            <div>
              <div class="kicker">NASA</div>
              <h3>Astronomy Picture of the Day</h3>
              <p class="muted">Pick any date since June 16, 1995.</p>
            </div>
            ${apodDateControls({ idPrefix: "space-apod", initialDate: currentApodDate })}
          </div>
          <div id="apod-detail"><div class="loading">Loading…</div></div>
          <div class="apod-archive-wrap">
            <div class="panel-title">Recent</div>
            <div id="apod-archive"><div class="loading">Loading…</div></div>
          </div>
        </div>
      </section>

      <section class="space-panel${tab === "launches" ? " active" : ""}" data-panel="launches" id="panel-launches">
        <div class="kicker">Launch Library</div>
        <h3>Upcoming launches</h3>
        <div id="launch-list"><div class="loading">Loading…</div></div>
      </section>

      <section class="space-panel${tab === "neos" ? " active" : ""}" data-panel="neos" id="panel-neos">
        <div class="kicker">NASA NeoWs</div>
        <h3>Near-Earth objects</h3>
        <p class="muted">Closest approaches in the current feed window.</p>
        <div id="neo-list"><div class="loading">Loading…</div></div>
      </section>

      ${siteFooter()}
    </div>
  `;

  // Tabs
  root.querySelectorAll(".space-tabs .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".space-tabs .chip").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      root.querySelectorAll(".space-panel").forEach((p) => {
        p.classList.toggle("active", p.dataset.panel === tab);
      });
      if (tab === "iss") {
        requestAnimationFrame(() => {
          map?.resize();
          if (marker) {
            const ll = marker.getLngLat();
            if (!issCentered) {
              issCentered = true;
              flyTo(map, ll.lng, ll.lat, ISS_MAP_ZOOM);
            }
          }
        });
        loadIss();
      }
      if (tab === "planets") solar?.start();
    });
  });

  bindApodDateControls(root, {
    idPrefix: "space-apod",
    onDate: (date) => loadApod(date),
  });

  solar?.destroy();
  solar = createSolarSystem(document.getElementById("space-solar"), {
    onSelect(p) {
      root.querySelectorAll("#space-planet-legend .orbit-chip").forEach((c) => {
        c.classList.toggle("active", c.dataset.planet === p.id);
      });
    },
  });

  // Map for ISS
  try {
    map?.remove();
  } catch {
    /* map already torn down with DOM */
  }
  map = createMap("space-map", { center: [0, 20], zoom: ISS_MAP_ZOOM });
  marker = null;
  issCentered = false;
  loaded = true;

  await load();
  clearInterval(timer);
  timer = setInterval(loadIss, 20000);
  refreshIcons();

  // Ensure MapLibre sizes correctly when ISS panel is (or becomes) visible
  if (tab === "iss") {
    requestAnimationFrame(() => {
      map?.resize();
      if (marker) {
        const ll = marker.getLngLat();
        flyTo(map, ll.lng, ll.lat, ISS_MAP_ZOOM);
      }
    });
  }
}

async function load() {
  try {
    const data = await apiGet("/api/space");
    document.getElementById("space-source").textContent = sourceLabel(data.source, data.updated_at);

    if (data.planets) {
      solar.setPlanets(data.planets);
      solar.start();
      document.getElementById("space-planet-attr").textContent = data.planets.attribution
        ? `Source: ${data.planets.attribution} · Epoch ${data.planets.epoch || "-"}`
        : sourceLabel(data.source, data.updated_at);
      const legend = document.getElementById("space-planet-legend");
      legend.innerHTML = (data.planets.planets || [])
        .map(
          (p) => `
        <button type="button" class="orbit-chip" data-planet="${p.id}">
          <span class="orbit-dot" style="background:${p.color || "#fff"}"></span>
          ${p.name}
          <span class="mono muted">${fmtNum(p.r_au, 3)} AU · ${fmtNum(p.longitude_deg, 1)}°</span>
        </button>`
        )
        .join("");
      legend.querySelectorAll("[data-planet]").forEach((btn) => {
        btn.addEventListener("click", () => {
          solar.select(btn.dataset.planet);
          legend.querySelectorAll(".orbit-chip").forEach((c) => c.classList.toggle("active", c === btn));
        });
      });
    } else {
      try {
        const p = await apiGet("/api/space/planets");
        solar.setPlanets(p);
        solar.start();
        document.getElementById("space-planet-attr").textContent = p.attribution || "JPL SSD";
      } catch {
        solar.setPlanets(null);
        solar.start();
      }
    }

    if (data.iss) renderIss(data.iss);

    const launches = data.launches || [];
    document.getElementById("launch-list").innerHTML = launches.length
      ? launches
          .map(
            (l) => `
        <div class="list-item launch-item">
          <div class="item-meta"><span class="badge cyan">${l.status || "scheduled"}</span><span>${l.provider || ""}</span></div>
          <div class="item-title">${l.name}</div>
          <div class="item-meta"><span>${l.location || l.pad || "-"}</span><span>${l.net ? relativeTime(l.net) : ""}</span></div>
        </div>`
          )
          .join("")
      : `<div class="empty">No launches</div>`;

    const neos = data.neos || [];
    document.getElementById("neo-list").innerHTML = neos.length
      ? `<div class="neo-table-wrap"><table class="table"><thead><tr>
          <th>Name</th><th>Miss (km)</th><th>Velocity</th><th>Approach</th><th></th>
        </tr></thead><tbody>
        ${neos
          .slice(0, 20)
          .map(
            (n) => `
          <tr>
            <td>${n.name}${n.hazardous ? ' <span class="badge amber">PHA</span>' : ""}</td>
            <td class="mono">${n.miss_distance_km != null ? fmtNum(n.miss_distance_km, 0) : "-"}</td>
            <td class="mono">${n.relative_velocity_kph != null ? fmtNum(n.relative_velocity_kph, 0) + " km/h" : "-"}</td>
            <td class="mono">${n.close_approach || n.date || "-"}</td>
            <td>${n.nasa_jpl_url ? `<a href="${n.nasa_jpl_url}" target="_blank" rel="noopener">JPL</a>` : ""}</td>
          </tr>`
          )
          .join("")}
        </tbody></table></div>
        <div class="source-line bare">Source: NASA NeoWs</div>`
      : `<div class="empty">NEO data unavailable (needs NASA_API_KEY for reliable NeoWs access)</div>`;

    // APOD: prefer today's from bundle, then allow date search
    const archive = data.extras?.apod_archive || [];
    document.getElementById("apod-archive").innerHTML = archiveStrip(archive);
    document.querySelectorAll("#apod-archive .apod-thumb:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.date;
        const input = document.getElementById("space-apod-date-input");
        if (input) input.value = d;
        loadApod(d);
      });
    });

    if (data.apod_meta?.needs_api_key || data.has_nasa_key === false) {
      document.getElementById("apod-detail").innerHTML = renderApodCard(null, {
        needsKey: true,
        message: data.apod_meta?.message,
      });
    } else if (data.apod) {
      currentApodDate = data.apod.date || todayUTC();
      const input = document.getElementById("space-apod-date-input");
      if (input) input.value = currentApodDate;
      document.getElementById("apod-detail").innerHTML = renderApodCard(data.apod);
    } else {
      await loadApod(currentApodDate);
    }
  } catch (err) {
    setError(document.getElementById("iss-panel"), err.message);
  }
}

async function loadApod(date) {
  currentApodDate = clampApodDate(date);
  const el = document.getElementById("apod-detail");
  if (!el) return;
  el.innerHTML = `<div class="loading">Loading APOD…</div>`;
  const input = document.getElementById("space-apod-date-input");
  if (input) input.value = currentApodDate;

  const data = await fetchApodByDate(currentApodDate);
  if (data.needs_api_key || !data.ok || !data.apod) {
    el.innerHTML = renderApodEmpty(data.message, data.date || currentApodDate, {
      needsKey: Boolean(data.needs_api_key),
    });
    return;
  }
  el.innerHTML = renderApodCard(data.apod);
  animateIn(el.querySelector(".apod-card"));
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
  const panel = document.getElementById("iss-panel");
  if (!panel) return;
  panel.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="label">Latitude</div><div class="value" style="font-size:16px">${fmtNum(iss.latitude, 3)}</div></div>
      <div class="stat"><div class="label">Longitude</div><div class="value" style="font-size:16px">${fmtNum(iss.longitude, 3)}</div></div>
      <div class="stat"><div class="label">Altitude</div><div class="value" style="font-size:16px">${iss.altitude_km != null ? fmtNum(iss.altitude_km, 1) + " km" : "-"}</div></div>
      <div class="stat"><div class="label">Velocity</div><div class="value" style="font-size:16px">${iss.velocity_kmh != null ? fmtNum(iss.velocity_kmh, 0) + " km/h" : "-"}</div></div>
    </div>
    <div class="muted" style="margin-top:10px">Visibility: ${iss.visibility || "-"}</div>
  `;
  const stamp = document.getElementById("iss-stamp");
  if (stamp) stamp.textContent = `Updated ${iss.timestamp || "-"} · ${iss.source || ""}`;
  marker = upsertIssMarker(map, iss, marker);
  if (!issCentered) {
    issCentered = true;
    flyTo(map, iss.longitude, iss.latitude, ISS_MAP_ZOOM);
  }
}
