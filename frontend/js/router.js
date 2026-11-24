/** Astronomy-only navigation — Explore + Orbit. */
const ROUTES = [
  { path: "/", view: "overview", label: "Explore" },
  { path: "/space", view: "space", label: "Orbit" },
];

/** Old intel paths redirect into the space product. */
const LEGACY_REDIRECTS = {
  "/map": "/space?focus=iss",
  "/signals": "/",
  "/news": "/",
  "/weather": "/",
  "/markets": "/",
  "/analytics": "/",
};

export function getRoutes() {
  return ROUTES;
}

export function parseLocation() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  if (LEGACY_REDIRECTS[path]) {
    const target = LEGACY_REDIRECTS[path];
    const [p, q] = target.split("?");
    history.replaceState({}, "", target);
    const match = ROUTES.find((r) => r.path === p) || ROUTES[0];
    const merged = {
      ...match,
      params: q ? Object.fromEntries(new URLSearchParams(q)) : params,
      path: match.path,
    };
    return merged;
  }
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
      `<button class="nav-link${r.view === current ? " active" : ""}${r.view === "space" ? " nav-priority" : ""}" data-path="${r.path}">${r.label}</button>`
  ).join("");
  container.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.path));
  });
}
