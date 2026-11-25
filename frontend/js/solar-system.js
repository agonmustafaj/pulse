/** Solar system orbit scene from real heliocentric positions (JPL SSD via /api/space/planets). */

const FALLBACK_ORBITS = [
  { id: "mercury", name: "Mercury", color: "#b0b0b0", a_au: 0.39 },
  { id: "venus", name: "Venus", color: "#e8cda0", a_au: 0.72 },
  { id: "earth", name: "Earth", color: "#4ea8de", a_au: 1.0 },
  { id: "mars", name: "Mars", color: "#c1440e", a_au: 1.52 },
  { id: "jupiter", name: "Jupiter", color: "#c88b3a", a_au: 5.2 },
  { id: "saturn", name: "Saturn", color: "#e6d5a8", a_au: 9.54 },
  { id: "uranus", name: "Uranus", color: "#7ec8e3", a_au: 19.2 },
  { id: "neptune", name: "Neptune", color: "#4166f5", a_au: 30.1 },
];

export function createSolarSystem(canvas, { onSelect } = {}) {
  const ctx = canvas.getContext("2d");
  let planets = [];
  let selected = "earth";
  let raf = 0;
  let running = false;
  let t0 = performance.now();
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Visual scale: compress outer planets so inner system stays readable
  function visualRadius(a) {
    return Math.sqrt(Math.max(a, 0.05)) * 42;
  }

  function resize() {
    const parent = canvas.parentElement || document.body;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth || 640;
    const h = parent.clientHeight || 420;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setPlanets(data) {
    if (data?.planets?.length) {
      planets = data.planets.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color || "#fff",
        a_au: p.a_au,
        lon: (p.longitude_deg || 0) * (Math.PI / 180),
        r_au: p.r_au,
      }));
    } else {
      planets = FALLBACK_ORBITS.map((p, i) => ({
        ...p,
        lon: (i / FALLBACK_ORBITS.length) * Math.PI * 2,
        r_au: p.a_au,
      }));
    }
  }

  function draw(now) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w * 0.5;
    const cy = h * 0.52;
    const elapsed = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    // Soft nebula behind orbits
    const neb = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(w, h) * 0.55);
    neb.addColorStop(0, "rgba(56, 189, 248, 0.07)");
    neb.addColorStop(0.4, "rgba(14, 80, 120, 0.05)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    // Orbits
    for (const p of planets) {
      const rad = visualRadius(p.a_au);
      ctx.beginPath();
      ctx.strokeStyle = p.id === selected ? "rgba(125, 211, 252, 0.45)" : "rgba(148, 163, 184, 0.14)";
      ctx.lineWidth = p.id === selected ? 1.5 : 1;
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sun
    const sunG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    sunG.addColorStop(0, "#fff7d6");
    sunG.addColorStop(0.35, "#fbbf24");
    sunG.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#fde68a";
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Planets: slow visual drift on top of real longitude for life
    for (const p of planets) {
      const rad = visualRadius(p.a_au);
      const drift = reduced() ? 0 : elapsed * (0.015 / Math.sqrt(p.a_au));
      const ang = p.lon + drift;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.72; // slight foreshortening
      const size = p.id === "jupiter" || p.id === "saturn" ? 5.5 : p.id === "earth" ? 4.2 : 3.2;

      if (p.id === selected) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(125, 211, 252, 0.55)";
        ctx.lineWidth = 1;
        ctx.arc(x, y, size + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      if (p.id === "saturn") {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(230, 213, 168, 0.7)";
        ctx.lineWidth = 1.2;
        ctx.ellipse(x, y, size + 4, size * 0.45, -0.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = p.id === selected ? "#e2e8f0" : "rgba(148, 163, 184, 0.75)";
      ctx.font = "500 10px Syne, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, x, y + size + 12);
      p._screen = { x, y, size };
    }
  }

  function loop(now) {
    draw(now);
    if (running && !reduced()) raf = requestAnimationFrame(loop);
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const p of planets) {
      if (!p._screen) continue;
      const dx = x - p._screen.x;
      const dy = y - p._screen.y;
      if (dx * dx + dy * dy < (p._screen.size + 10) ** 2) return p;
    }
    return null;
  }

  function onClick(e) {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      selected = hit.id;
      onSelect?.(hit);
      draw(performance.now());
    }
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    t0 = performance.now();
    draw(t0);
    if (!reduced()) raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  canvas.addEventListener("click", onClick);
  const onResize = () => {
    resize();
    draw(performance.now());
  };
  window.addEventListener("resize", onResize);

  return {
    setPlanets,
    select(id) {
      selected = id;
      draw(performance.now());
    },
    start,
    stop,
    destroy() {
      stop();
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    },
  };
}
