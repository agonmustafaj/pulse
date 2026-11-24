import { getSpace, getApod, isValidApodDate } from "./space.js";

const SPACE_HINTS = [
  ["apod", "/", "Astronomy Picture of the Day", "Explore"],
  ["astronomy", "/", "Astronomy Picture of the Day", "Explore"],
  ["cosmos", "/", "Explore the cosmos", "Explore"],
  ["orbit", "/space", "Orbit", "Orbit"],
  ["planet", "/space?focus=planets", "Planets in orbit", "Orbit"],
  ["mars", "/space?focus=planets", "Mars & solar system", "Orbit"],
  ["jupiter", "/space?focus=planets", "Jupiter & solar system", "Orbit"],
  ["iss", "/space?focus=iss", "International Space Station", "Orbit"],
  ["station", "/space?focus=iss", "International Space Station", "Orbit"],
  ["launch", "/space?focus=launches", "Upcoming launches", "Orbit"],
  ["rocket", "/space?focus=launches", "Upcoming launches", "Orbit"],
  ["neo", "/space?focus=neos", "Near-Earth objects", "Orbit"],
  ["asteroid", "/space?focus=neos", "Near-Earth objects", "Orbit"],
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function search(env, q) {
  const query = (q || "").trim();
  if (query.length < 2) {
    return {
      ok: true,
      source: "search",
      updated_at: new Date().toISOString(),
      items: [],
      query,
      message: "Enter at least 2 characters",
    };
  }

  const ql = query.toLowerCase();
  const results = [];

  for (const [hint, route, title, category] of SPACE_HINTS) {
    if (ql.includes(hint)) {
      results.push({
        id: `hint-${hint}`,
        title,
        subtitle: category,
        category: "space",
        route,
        meta: {},
      });
    }
  }

  if (DATE_RE.test(query) && isValidApodDate(query)) {
    results.push({
      id: `apod-${query}`,
      title: `APOD ${query}`,
      subtitle: "Astronomy Picture of the Day",
      category: "apod",
      route: `/?date=${query}`,
      meta: { date: query },
    });
    try {
      const apod = await getApod(env, query);
      if (apod?.apod?.title) {
        results.push({
          id: `apod-title-${query}`,
          title: apod.apod.title,
          subtitle: `APOD · ${query}`,
          category: "apod",
          route: `/?date=${query}`,
          meta: { date: query },
        });
      }
    } catch {
      /* optional */
    }
  }

  try {
    const space = await getSpace(env);
    const launchQ = ql;
    for (const launch of space.launches || []) {
      const hay = `${launch.name || ""} ${launch.provider || ""}`.toLowerCase();
      if (hay.includes(launchQ)) {
        results.push({
          id: `launch-${launch.id || launch.name}`,
          title: launch.name,
          subtitle: launch.provider || "Launch",
          category: "launch",
          route: "/space?focus=launches",
          meta: {},
        });
      }
    }
    for (const neo of space.neos || []) {
      const hay = String(neo.name || "").toLowerCase();
      if (hay.includes(launchQ)) {
        results.push({
          id: `neo-${neo.id || neo.name}`,
          title: neo.name,
          subtitle: "Near-Earth object",
          category: "neo",
          route: "/space?focus=neos",
          meta: {},
        });
      }
    }
    for (const p of space.planets?.planets || []) {
      if (String(p.name || "").toLowerCase().includes(ql) || String(p.id || "").toLowerCase().includes(ql)) {
        results.push({
          id: `planet-${p.id}`,
          title: p.name,
          subtitle: `${Number(p.r_au).toFixed(2)} AU`,
          category: "planet",
          route: "/space?focus=planets",
          meta: {},
        });
      }
    }
  } catch {
    /* optional */
  }

  for (const [path, title] of [
    ["/", "Explore"],
    ["/space", "Orbit"],
  ]) {
    if (ql.includes(title.toLowerCase()) || (path !== "/" && ql.includes(path.replace("/", "")))) {
      results.push({
        id: `sec-${path || "home"}`,
        title,
        subtitle: "Go to section",
        category: "section",
        route: path,
        meta: {},
      });
    }
  }

  const seen = new Set();
  const unique = [];
  for (const r of results) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
  }

  return {
    ok: true,
    source: ["space", "apod"],
    updated_at: new Date().toISOString(),
    items: unique.slice(0, 30),
    query,
  };
}
