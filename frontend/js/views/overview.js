import { apiGet } from "../api.js";
import {
  apodDateControls,
  bindApodDateControls,
  fetchApodByDate,
  renderApodEmpty,
  renderApodHeroMedia,
  todayUTC,
  clampApodDate,
} from "../apod.js";
import { createSolarSystem } from "../solar-system.js";
import { createStarfield } from "../starfield.js";
import { navigate } from "../router.js";
import { animateIn, fmtNum, refreshIcons, relativeTime } from "../ui.js";

let starfield;
let solar;
let loaded;
let currentApodDate = todayUTC();

export async function renderOverview(root) {
  if (!loaded) {
    root.innerHTML = `
      <div class="galaxy-home">
        <canvas class="starfield" id="home-stars" aria-hidden="true"></canvas>

        <section class="galaxy-hero" id="galaxy-hero" aria-label="Astronomy Picture of the Day">
          <div class="galaxy-hero-visual" id="apod-hero-visual">
            <div class="apod-hero-placeholder loading">Loading the cosmos…</div>
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
            <div class="apod-date-wrap">
              ${apodDateControls({ idPrefix: "home-apod", initialDate: currentApodDate })}
            </div>
            <div class="apod-hero-caption mono muted" id="apod-hero-caption"></div>
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
          <p class="home-note muted">Earth intel (quakes, markets, weather) lives under Map &amp; Signals — demoted from this home.</p>
        </section>
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
        ".orbit-section",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: "power2.out", clearProps: "transform" }
      );
    }
  }

  await Promise.all([loadApod(currentApodDate), loadSpaceBundle()]);
  refreshIcons();
}

async function loadApod(date) {
  currentApodDate = clampApodDate(date);
  const visual = document.getElementById("apod-hero-visual");
  const caption = document.getElementById("apod-hero-caption");
  if (!visual) return;
  visual.innerHTML = `<div class="apod-hero-placeholder loading">Loading APOD…</div>`;
  caption.textContent = "";

  const data = await fetchApodByDate(currentApodDate);
  const input = document.getElementById("home-apod-date-input");
  if (input) input.value = currentApodDate;

  if (!data.ok || !data.apod) {
    visual.innerHTML = renderApodEmpty(data.message, data.date || currentApodDate);
    caption.textContent = data.message || "No image for this date";
    return;
  }

  const apod = data.apod;
  visual.innerHTML = renderApodHeroMedia(apod, { hero: true });
  caption.textContent = `${apod.title || "APOD"} · ${apod.date || currentApodDate}${
    apod.copyright ? ` · © ${apod.copyright}` : ""
  } · NASA`;
  animateIn(visual.querySelector(".apod-media, .apod-video, .apod-empty"));
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
