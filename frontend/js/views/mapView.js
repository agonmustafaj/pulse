import { apiGet } from "../api.js";
import { createMap, eventsToGeoJSON, upsertEventLayers, upsertIssMarker, flyTo, setDarkStyle } from "../map.js";
import { openDrawer, relativeTime, severityBadge, sourceLabel, fmtNum, refreshIcons } from "../ui.js";
import { navigate } from "../router.js";

let map;
let issMarker;
let allEvents = [];
let layers = { earthquakes: true, natural: true, iss: true, launches: false };
let dark = true;
let loaded;

export async function renderMap(root) {
  if (!loaded) {
    root.innerHTML = `
      <div class="map-stage">
        <div id="map"></div>
        <div class="map-toolbar">
          <button class="btn icon" id="map-reset" title="Reset"><i data-lucide="locate-fixed" width="16" height="16"></i></button>
          <button class="btn icon" id="map-style" title="Toggle style"><i data-lucide="moon" width="16" height="16"></i></button>
          <button class="btn icon" id="map-fs" title="Fullscreen"><i data-lucide="maximize" width="16" height="16"></i></button>
        </div>
        <div class="layer-panel panel">
          <div class="panel-header"><div class="panel-title">Layers</div></div>
          <div class="panel-body">
            <label class="chip-row" style="flex-direction:column;align-items:stretch;gap:8px">
              <label><input type="checkbox" data-layer="earthquakes" checked /> Earthquakes (USGS)</label>
              <label><input type="checkbox" data-layer="natural" checked /> Natural events (EONET)</label>
              <label><input type="checkbox" data-layer="iss" checked /> ISS position</label>
              <label><input type="checkbox" data-layer="launches" /> Upcoming launches</label>
            </label>
            <div class="field" style="margin-top:10px">
              <input id="map-search" placeholder="Find city…" />
            </div>
          </div>
          <div class="source-line" id="map-source">Real markers only</div>
        </div>
      </div>
    `;
    map = createMap("map", { zoom: 1.6 });
    map.on("load", () => loadData());
    root.querySelector("#map-reset").onclick = () => map.easeTo({ center: [10, 20], zoom: 1.6 });
    root.querySelector("#map-style").onclick = () => {
      dark = !dark;
      setDarkStyle(map, dark);
      map.once("style.load", () => applyLayers());
    };
    root.querySelector("#map-fs").onclick = () => {
      const el = root.querySelector(".map-stage");
      if (!document.fullscreenElement) el.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    root.querySelectorAll("[data-layer]").forEach((input) => {
      input.addEventListener("change", () => {
        layers[input.dataset.layer] = input.checked;
        applyLayers();
      });
    });
    let t;
    root.querySelector("#map-search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => locateCity(e.target.value), 350);
    });
    loaded = true;
  } else {
    map.resize();
    loadData();
  }
  refreshIcons();
}

async function loadData() {
  try {
    const data = await apiGet("/api/events", { limit: 200 });
    allEvents = data.items || [];
    document.getElementById("map-source").textContent = sourceLabel(data.source, data.updated_at);
    applyLayers();
  } catch (err) {
    document.getElementById("map-source").textContent = `Map data error: ${err.message}`;
  }
  try {
    const space = await apiGet("/api/space");
    if (layers.iss && space.iss) {
      issMarker = upsertIssMarker(map, space.iss, issMarker);
    }
    if (layers.launches) {
      const launches = (space.launches || []).filter((l) => l.latitude != null);
      upsertEventLayers(
        map,
        {
          type: "FeatureCollection",
          features: launches.map((l) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [l.longitude, l.latitude] },
            properties: { id: l.id, title: l.name, category: "space", source: "The Space Devs", type: "space", severity: "" },
          })),
        },
        { onClick: showFeature }
      );
    }
  } catch {
    /* optional */
  }
}

function applyLayers() {
  const filtered = allEvents.filter((e) => {
    const t = (e.metadata && e.metadata.type) || "";
    if (t === "earthquake" && !layers.earthquakes) return false;
    if (t === "natural_event" && !layers.natural) return false;
    return true;
  });
  upsertEventLayers(map, eventsToGeoJSON(filtered), { onClick: showFeature });
  if (!layers.iss && issMarker) {
    issMarker.remove();
    issMarker = null;
  }
}

function showFeature(props, coords) {
  const event = allEvents.find((e) => e.id === props.id);
  openDrawer({
    title: props.title || "Event",
    body: `
      <div class="chip-row" style="margin-bottom:8px">${severityBadge(props.severity)} <span class="badge">${props.category}</span></div>
      <div class="item-meta"><span>${event?.location_name || "-"}</span><span>${relativeTime(event?.timestamp)}</span></div>
      <p class="muted" style="margin-top:10px">${event?.description || ""}</p>
      <div class="mono muted" style="margin-top:10px">${fmtNum(coords[1], 4)}, ${fmtNum(coords[0], 4)}</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn primary" id="drawer-signals">Open in Signals</button>
        ${event?.source_url ? `<a class="btn" href="${event.source_url}" target="_blank" rel="noopener">Source</a>` : ""}
      </div>
    `,
    source: `Source: ${props.source || "-"}`,
  });
  setTimeout(() => {
    const btn = document.getElementById("drawer-signals");
    if (btn) btn.onclick = () => navigate(`/signals?id=${encodeURIComponent(props.id)}`);
  }, 0);
  flyTo(map, coords[0], coords[1], 4.5);
}

async function locateCity(q) {
  if (!q || q.length < 2) return;
  try {
    const res = await apiGet("/api/weather/cities", { q });
    const hit = (res.items || [])[0];
    if (hit) flyTo(map, hit.longitude, hit.latitude, 6);
  } catch {
    /* ignore */
  }
}
