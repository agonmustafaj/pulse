/** Lightweight canvas starfield; pauses when prefers-reduced-motion. */

export function createStarfield(canvas, { density = 1 } = {}) {
  const ctx = canvas.getContext("2d");
  let stars = [];
  let raf = 0;
  let running = false;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    const parent = canvas.parentElement || document.body;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.floor((w * h) / 9000 * density);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random() * 0.7 + 0.2,
      tw: Math.random() * Math.PI * 2,
      sp: 0.004 + Math.random() * 0.01,
    }));
    draw(0);
  }

  function draw(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    // Deep space wash
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(18, 40, 72, 0.35)");
    g.addColorStop(0.45, "rgba(8, 14, 28, 0.15)");
    g.addColorStop(1, "rgba(3, 5, 10, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      const twinkle = reduced() ? s.a : s.a * (0.55 + 0.45 * Math.sin(t * s.sp + s.tw));
      ctx.beginPath();
      ctx.fillStyle = `rgba(230, 240, 255, ${twinkle})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(ts) {
    draw(ts);
    if (running && !reduced()) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    if (!reduced()) raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  return {
    start,
    stop,
    destroy() {
      stop();
      window.removeEventListener("resize", onResize);
    },
  };
}
