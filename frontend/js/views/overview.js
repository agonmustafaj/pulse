import { apiGet } from "../api.js";
import { createMap, eventsToGeoJSON, upsertEventLayers, upsertIssMarker } from "../map.js";
import { fmtNum, panel, relativeTime, sourceLabel, severityBadge, refreshIcons } from "../ui.js";

let map;
let issMarker;
let loaded;

export async function renderOverview(root) {
  if (!loaded) {
    root.innerHTML = `
      <div class="map-stage">
        <div id="overview-map"></div>
        <div class="overlay-grid">
          <div class="overlay-top">
            <div class="hero-copy panel" style="padding:14px 16px;max-width:420px">
              <div class="kicker">Global intelligence</div>
              <h1>THE WORLD. IN MOTION.</h1>
              <p>Explore live signals shaping the planet — seismic activity, environmental events, markets, weather, and space.</p>
            </div>
            <div class="panel" style="padding:10px 12px;min-width:180px">
              <div class="panel-title">System</div>
              <div class="mono" id="ov-health" style="margin-top:6px;font-size:12px">Checking…</div>
            </div>
          </div>
          <div class="overlay-left">
            <div id="ov-signals"></div>
          </div>
          <div class="overlay-right">
            <div id="ov-news"></div>
            <div id="ov-space"></div>
          </div>
          <div class="overlay-bottom">
            <div id="ov-activity"></div>
            <div id="ov-weather"></div>
            <div id="ov-markets"></div>
            <div id="ov-meta"></div>
          </div>
        </div>
      </div>
    `;
    map = createMap("overview-map", { zoom: 1.35 });
    map.on("load", () => refresh());
    loaded = true;
  } else {
    map.resize();
    refresh();
  }
  refreshIcons();
}

async function refresh() {
  try {
    const health = await apiGet("/api/health");
    document.getElementById("ov-health").textContent = health.ok ? "API ONLINE" : "DEGRADED";
  } catch {
    document.getElementById("ov-health").textContent = "API OFFLINE";
  }

  const [events, news, weather, markets, space] = await Promise.allSettled([
    apiGet("/api/events", { limit: 80 }),
    apiGet("/api/news", { limit: 6 }),
    apiGet("/api/weather", { city: "London" }),
    apiGet("/api/markets"),
    apiGet("/api/space"),
  ]);

  if (events.status === "fulfilled" && events.value.ok) {
    const items = events.value.items || [];
    upsertEventLayers(map, eventsToGeoJSON(items));
    const list = items
      .slice(0, 6)
      .map(
        (e) => `
        <div class="list-item">
          <div class="item-meta">${severityBadge(e.severity)} <span>${e.category}</span></div>
          <div class="item-title">${e.title}</div>
          <div class="item-meta"><span>${e.location_name || "—"}</span><span>${relativeTime(e.timestamp)}</span></div>
        </div>`
      )
      .join("");
    document.getElementById("ov-signals").innerHTML = panel({
      title: "Latest signals",
      body: list || `<div class="empty">No signals</div>`,
      source: sourceLabel(events.value.source, events.value.updated_at),
    });
    document.getElementById("ov-activity").innerHTML = panel({
      title: "Activity",
      body: `<div class="stat-grid">
        <div class="stat"><div class="label">Events</div><div class="value">${fmtNum(events.value.total, 0)}</div></div>
        <div class="stat"><div class="label">Mapped</div><div class="value">${fmtNum(items.filter((e) => e.latitude != null).length, 0)}</div></div>
      </div>`,
      source: sourceLabel(events.value.source, events.value.updated_at),
    });
  } else {
    document.getElementById("ov-signals").innerHTML = panel({ title: "Latest signals", body: `<div class="error">Signals unavailable</div>` });
  }

  if (news.status === "fulfilled" && news.value.ok) {
    const list = (news.value.items || [])
      .slice(0, 5)
      .map(
        (a) => `
        <div class="list-item">
          <div class="item-title">${a.headline}</div>
          <div class="item-meta"><span>${a.source}</span><span>${relativeTime(a.published)}</span></div>
        </div>`
      )
      .join("");
    document.getElementById("ov-news").innerHTML = panel({
      title: "News highlights",
      body: list,
      source: sourceLabel(news.value.source, news.value.updated_at),
    });
  }

  if (weather.status === "fulfilled" && weather.value.ok && weather.value.current) {
    const c = weather.value.current;
    document.getElementById("ov-weather").innerHTML = panel({
      title: "Weather",
      body: `<div class="stat"><div class="label">${c.location}</div><div class="value">${fmtNum(c.temperature_c, 1)}°C</div>
        <div class="muted" style="margin-top:4px">${c.condition || "—"} · Wind ${fmtNum(c.wind_speed_kmh, 0)} km/h</div></div>`,
      source: sourceLabel(weather.value.source, weather.value.updated_at),
    });
  }

  if (markets.status === "fulfilled" && markets.value.ok) {
    const top = (markets.value.items || []).filter((i) => i.category === "index" || i.category === "crypto").slice(0, 3);
    const rows = top
      .map((m) => {
        const cls = (m.change_percent || 0) >= 0 ? "pos" : "neg";
        return `<div class="item-meta" style="justify-content:space-between"><span>${m.symbol}</span><span class="mono ${cls}">${fmtNum(m.price)} (${fmtNum(m.change_percent, 2)}%)</span></div>`;
      })
      .join("");
    document.getElementById("ov-markets").innerHTML = panel({
      title: "Markets",
      body: rows || `<div class="empty">No quotes</div>`,
      source: sourceLabel(markets.value.source, markets.value.updated_at),
    });
  }

  if (space.status === "fulfilled" && space.value.ok) {
    const iss = space.value.iss;
    if (iss) issMarker = upsertIssMarker(map, iss, issMarker);
    const launch = (space.value.launches || [])[0];
    document.getElementById("ov-space").innerHTML = panel({
      title: "Space",
      body: `
        <div class="stat-grid">
          <div class="stat"><div class="label">ISS lat</div><div class="value" style="font-size:14px">${iss ? fmtNum(iss.latitude, 2) : "—"}</div></div>
          <div class="stat"><div class="label">ISS lon</div><div class="value" style="font-size:14px">${iss ? fmtNum(iss.longitude, 2) : "—"}</div></div>
        </div>
        <div class="muted" style="margin-top:8px;font-size:12px">${launch ? `Next: ${launch.name}` : "No launch data"}</div>`,
      source: sourceLabel(space.value.source, space.value.updated_at),
    });
  }

  document.getElementById("ov-meta").innerHTML = panel({
    title: "Principles",
    body: `<div class="chip-row">
      <span class="badge violet">Discover</span>
      <span class="badge cyan">Connect</span>
      <span class="badge green">Observe</span>
      <span class="badge amber">Explore</span>
    </div>
    <p class="muted" style="margin:10px 0 0;font-size:12px">Real public data only. Attribution on every panel.</p>`,
  });
}
