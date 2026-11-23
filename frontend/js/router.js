const ROUTES = [
  { path: "/", view: "overview", label: "Overview" },
  { path: "/map", view: "map", label: "Map" },
  { path: "/signals", view: "signals", label: "Signals" },
  { path: "/news", view: "news", label: "News" },
  { path: "/weather", view: "weather", label: "Weather" },
  { path: "/markets", view: "markets", label: "Markets" },
  { path: "/space", view: "space", label: "Space" },
  { path: "/analytics", view: "analytics", label: "Analytics" },
];

export function getRoutes() {
  return ROUTES;
}

export function parseLocation() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const match = ROUTES.find((r) => r.path === path) || ROUTES[0];
  return { ...match, params, path: match.path };
}

export function navigate(path, { replace = false } = {}) {
  const url = path.startsWith("/") ? path : `/${path}`;
  if (replace) history.replaceState({}, "", url);
  else history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function buildNav(container, current) {
  container.innerHTML = ROUTES.map(
    (r) =>
      `<button class="nav-link${r.view === current ? " active" : ""}" data-path="${r.path}">${r.label}</button>`
  ).join("");
  container.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.path));
  });
}
