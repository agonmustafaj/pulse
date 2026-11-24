import { buildNav, parseLocation, getRoutes } from "./router.js";
import { $, closeDrawer, refreshIcons } from "./ui.js";
import { initSearch } from "./search.js";
import { connectLive } from "./websocket.js";
import { renderOverview } from "./views/overview.js";
import { renderSpace } from "./views/space.js";

const views = {
  overview: renderOverview,
  space: renderSpace,
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
  document.title = `PULSE — ${getRoutes().find((r) => r.view === loc.view)?.label || "Explore"}`;
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
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const path = el.getAttribute("data-nav") || el.getAttribute("href") || "/";
      import("./router.js").then(({ navigate }) => navigate(path));
    });
  });
  window.addEventListener("popstate", route);
  tickClock();
  setInterval(tickClock, 1000);
  connectLive(() => {
    /* optional live ticks; views poll REST */
  });
  route();
}

boot();
