import { buildNav, parseLocation, getRoutes } from "./router.js";
import { $, closeDrawer, refreshIcons } from "./ui.js";
import { initSearch } from "./search.js";
import { connectLive } from "./websocket.js";
import { renderOverview } from "./views/overview.js";
import { renderMap } from "./views/mapView.js";
import { renderSignals } from "./views/signals.js";
import { renderNews } from "./views/news.js";
import { renderWeather } from "./views/weather.js";
import { renderMarkets } from "./views/markets.js";
import { renderSpace } from "./views/space.js";
import { renderAnalytics } from "./views/analytics.js";

const views = {
  overview: renderOverview,
  map: renderMap,
  signals: renderSignals,
  news: renderNews,
  weather: renderWeather,
  markets: renderMarkets,
  space: renderSpace,
  analytics: renderAnalytics,
};

async function route() {
  const loc = parseLocation();
  buildNav($("#nav"), loc.view);
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === loc.view));
  closeDrawer();
  const el = document.getElementById(`view-${loc.view}`);
  const render = views[loc.view];
  if (render && el) await render(el, loc.params);
  refreshIcons();
  document.title = `PULSE — ${getRoutes().find((r) => r.view === loc.view)?.label || "Overview"}`;
}

function tickClock() {
  const now = new Date();
  $("#clock-utc").textContent = `UTC ${now.toISOString().slice(11, 19)}`;
  $("#clock-local").textContent = `Local ${now.toLocaleTimeString()}`;
}

function boot() {
  refreshIcons();
  initSearch();
  $("#drawer-close").addEventListener("click", closeDrawer);
  window.addEventListener("popstate", route);
  tickClock();
  setInterval(tickClock, 1000);
  connectLive(() => {
    /* snapshots available for future HUD ticks; polling covers views */
  });
  route();
}

boot();
