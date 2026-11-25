export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$ (sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

export function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function relativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function severityBadge(sev) {
  if (!sev) return "";
  const cls = sev === "high" ? "red" : sev === "medium" ? "amber" : "green";
  return `<span class="badge ${cls}">${sev}</span>`;
}

export function panel({ title, body, source, actions = "" }) {
  return `
    <article class="panel">
      <div class="panel-header">
        <div class="panel-title">${title}</div>
        <div>${actions}</div>
      </div>
      <div class="panel-body">${body}</div>
      ${source ? `<div class="source-line">${source}</div>` : ""}
    </article>
  `;
}

export function setLoading(el, msg = "Loading…") {
  el.innerHTML = `<div class="loading">${msg}</div>`;
}

export function setError(el, msg) {
  el.innerHTML = `<div class="error">${msg || "Unavailable"}</div>`;
}

export function openDrawer({ title, body, source }) {
  const drawer = $("#detail-drawer");
  $("#drawer-title").textContent = title || "Details";
  $("#drawer-body").innerHTML = body || "";
  $("#drawer-source").textContent = source || "";
  drawer.classList.add("open");
}

export function closeDrawer() {
  $("#detail-drawer").classList.remove("open");
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

export function animateIn(el) {
  if (!el || !window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
}

export function sourceLabel(source, updated) {
  const src = Array.isArray(source) ? source.join(" · ") : source || "—";
  return `Source: ${src}${updated ? ` · Updated ${fmtTime(updated)}` : ""}`;
}

/** Shared site footer for Explore + Orbit shells. */
export function siteFooter() {
  return `
    <footer class="site-footer">
      <p class="site-footer-credit">
        powered by
        <a href="https://agonmustafaj.com/" target="_blank" rel="noopener noreferrer">Agon Mustafaj</a>
      </p>
    </footer>
  `;
}
