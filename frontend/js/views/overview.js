import { apiGet } from "../api.js";
import {
  apodDateControls,
  bindApodDateControls,
  fetchApodByDate,
  renderApodCard,
  todayUTC,
  clampApodDate,
} from "../apod.js";
import { createSolarSystem } from "../solar-system.js";
import { createStarfield } from "../starfield.js";
import { navigate } from "../router.js";
import { animateIn, fmtNum, refreshIcons, relativeTime, siteFooter } from "../ui.js";

let starfield;
let solar;
let loaded;
let currentApodDate = todayUTC();

export async function renderOverview(root, params = {}) {
  if (params.date) {
    currentApodDate = clampApodDate(params.date);
  }
  if (!loaded) {
    root.innerHTML = `
      <div class="galaxy-home">
        <canvas class="starfield" id="home-stars" aria-hidden="true"></canvas>

        <section class="galaxy-hero" id="galaxy-hero" aria-label="PULSE hero">
          <div class="galaxy-hero-visual" aria-hidden="true">
            <img
              class="hero-media"
              src="/assets/hero-cosmos.svg"
              alt=""
              width="1600"
              height="900"
              decoding="async"
            />
          </div>
          <div class="galaxy-hero-veil"></div>
          <div class="galaxy-hero-content">
            <div class="brand-hero" aria-label="PULSE">PULSE</div>
            <h1 class="galaxy-headline">THE COSMOS. IN MOTION.</h1>
            <p class="galaxy-lede">NASA skies, planets in orbit, and the ISS — a cinematic window into deep space.</p>
            <div class="galaxy-cta">
              <button type="button" class="btn primary" id="cta-orbit">Enter orbit</button>
              <button type="button" class="btn ghost" id="cta-iss">Track the ISS</button>
            </div>
          </div>
        </section>

        <section class="apod-section" id="apod-section" aria-label="Astronomy Picture of the Day">
          <div class="apod-section-head">
            <div>
              <div class="kicker">NASA APOD</div>
              <h2>Astronomy Picture of the Day</h2>
              <p class="muted">Browse any day since June 16, 1995 — real NASA imagery, title, and explanation.</p>
            </div>
          </div>
          <div class="apod-section-controls">
            ${apodDateControls({ idPrefix: "home-apod", initialDate: currentApodDate })}
          </div>
          <div id="apod-section-body" class="apod-section-body">
            <div class="loading">Loading APOD…</div>
          </div>
        </section>

        <section class="orbit-section" aria-label="Solar system">
          <div class="orbit-section-head">
            <div>
              <div class="kicker">Live ephemeris</div>
              <h2>Planets in orbit</h2>
              <p class="muted">Heliocentric positions from JPL SSD mean elements — not decorative placeholders.</p>
            </div>
            <div class="mono muted" id="planet-epoch">—</div>
          </div>
          <div class="orbit-stage">
            <canvas id="solar-canvas" aria-label="Solar system visualization"></canvas>
            <div class="orbit-legend" id="orbit-legend"></div>
          </div>
          <div class="orbit-attribution mono muted" id="orbit-attr"></div>
        </section>

        <section class="home-signals" aria-label="Space signals">
          <div class="home-signal-grid">
            <article class="signal-block" id="home-iss">
              <div class="kicker">Station</div>
              <h3>ISS now</h3>
              <div class="signal-body loading">Loading…</div>
            </article>
            <article class="signal-block" id="home-launch">
              <div class="kicker">Pad</div>
              <h3>Next launch</h3>
              <div class="signal-body loading">Loading…</div>
            </article>
            <article class="signal-block" id="home-neo">
              <div class="kicker">Near-Earth</div>
              <h3>Closest NEO</h3>
              <div class="signal-body loading">Loading…</div>
            </article>
          </div>
        </section>

        ${siteFooter()}
      </div>
    `;

    starfield = createStarfield(document.getElementById("home-stars"), { density: 1.1 });
    starfield.start();

    solar = createSolarSystem(document.getElementById("solar-canvas"), {
      onSelect(p) {
        highlightPlanet(p.id);
      },
    });

    document.getElementById("cta-orbit")?.addEventListener("click", () => navigate("/space"));
    document.getElementById("cta-iss")?.addEventListener("click", () => navigate("/space?focus=iss"));

    bindApodDateControls(root, {
      idPrefix: "home-apod",
      onDate: (date) => loadApod(date),
    });

    loaded = true;
    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        ".galaxy-hero-content > *",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.07, duration: 0.55, ease: "power2.out", clearProps: "transform" }
      );
      gsap.fromTo(
        ".apod-section",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.12, ease: "power2.out", clearProps: "transform" }
      );
      gsap.fromTo(
        ".orbit-section",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.22, ease: "power2.out", clearProps: "transform" }
      );
    }
  }

  await Promise.all([loadApod(currentApodDate), loadSpaceBundle()]);
  refreshIcons();
}

async function loadApod(date) {
  currentApodDate = clampApodDate(date);
  const body = document.getElementById("apod-section-body");
  if (!body) return;
  body.innerHTML = `<div class="loading">Loading APOD…</div>`;

  const url = new URL(window.location.href);
  if (currentApodDate === todayUTC()) url.searchParams.delete("date");
  else url.searchParams.set("date", currentApodDate);
  history.replaceState({}, "", `${url.pathname}${url.search}`);

  const data = await fetchApodByDate(currentApodDate);
  const input = document.getElementById("home-apod-date-input");
  if (input) input.value = currentApodDate;

  if (data.needs_api_key || !data.ok || !data.apod) {
    body.innerHTML = renderApodCard(null, {
      needsKey: Boolean(data.needs_api_key),
      message: data.message,
    });
    animateIn(body.querySelector(".apod-empty, .apod-card"));
    return;
  }

  body.innerHTML = renderApodCard(data.apod);
  animateIn(body.querySelector(".apod-card"));
}

async function loadSpaceBundle() {
  try {
    const data = await apiGet("/api/space");
    const planets = data.planets;
    if (planets) {
      solar.setPlanets(planets);
      solar.start();
      document.getElementById("planet-epoch").textContent = planets.epoch
        ? `Epoch ${new Date(planets.epoch).toISOString().replace("T", " ").slice(0, 19)}Z`
        : "—";
      document.getElementById("orbit-attr").textContent = planets.attribution
        ? `Source: ${planets.attribution}`
        : "Source: JPL SSD";
      renderLegend(planets.planets || []);
    } else {
      try {
        const p = await apiGet("/api/space/planets");
        solar.setPlanets(p);
        solar.start();
        document.getElementById("planet-epoch").textContent = p.epoch
          ? `Epoch ${new Date(p.epoch).toISOString().replace("T", " ").slice(0, 19)}Z`
          : "—";
        document.getElementById("orbit-attr").textContent = p.attribution || "JPL SSD";
        renderLegend(p.planets || []);
      } catch {
        solar.setPlanets(null);
        solar.start();
        document.getElementById("orbit-attr").textContent = "Planet API unavailable — orbits shown with mean semi-major axes";
      }
    }

    const iss = data.iss;
    const issEl = document.querySelector("#home-iss .signal-body");
    if (iss && issEl) {
      issEl.innerHTML = `
        <div class="signal-stat">${fmtNum(iss.latitude, 2)}°, ${fmtNum(iss.longitude, 2)}°</div>
        <div class="muted">${iss.altitude_km != null ? fmtNum(iss.altitude_km, 0) + " km · " : ""}${iss.visibility || "—"}</div>
        <button type="button" class="btn ghost compact" data-nav="/space?focus=iss">Open tracker</button>
      `;
    } else if (issEl) {
      issEl.innerHTML = `<div class="empty">ISS unavailable</div>`;
    }

    const launch = (data.launches || [])[0];
    const launchEl = document.querySelector("#home-launch .signal-body");
    if (launch && launchEl) {
      launchEl.innerHTML = `
        <div class="signal-stat">${launch.name}</div>
        <div class="muted">${launch.provider || "—"} · ${launch.net ? relativeTime(launch.net) : "TBD"}</div>
        <button type="button" class="btn ghost compact" data-nav="/space?focus=launches">All launches</button>
      `;
    } else if (launchEl) {
      launchEl.innerHTML = `<div class="empty">No launch data</div>`;
    }

    const neo = (data.neos || [])[0];
    const neoEl = document.querySelector("#home-neo .signal-body");
    if (neo && neoEl) {
      neoEl.innerHTML = `
        <div class="signal-stat">${neo.name}</div>
        <div class="muted">${neo.miss_distance_km != null ? fmtNum(neo.miss_distance_km / 1e6, 2) + " M km miss" : "—"}${
          neo.hazardous ? " · PHA" : ""
        }</div>
        <button type="button" class="btn ghost compact" data-nav="/space?focus=neos">Browse NEOs</button>
      `;
    } else if (neoEl) {
      neoEl.innerHTML = `<div class="empty">NEO feed unavailable</div>`;
    }

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.nav));
    });
  } catch (err) {
    document.querySelector("#home-iss .signal-body").innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function renderLegend(planets) {
  const el = document.getElementById("orbit-legend");
  if (!el) return;
  el.innerHTML = planets
    .map(
      (p) => `
      <button type="button" class="orbit-chip" data-planet="${p.id}">
        <span class="orbit-dot" style="background:${p.color || "#fff"}"></span>
        ${p.name}
        <span class="mono muted">${fmtNum(p.r_au, 2)} AU</span>
      </button>`
    )
    .join("");
  el.querySelectorAll("[data-planet]").forEach((btn) => {
    btn.addEventListener("click", () => {
      solar.select(btn.dataset.planet);
      highlightPlanet(btn.dataset.planet);
    });
  });
}

function highlightPlanet(id) {
  document.querySelectorAll(".orbit-chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.planet === id);
  });
}
