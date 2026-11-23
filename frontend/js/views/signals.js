import { apiGet } from "../api.js";
import { openDrawer, relativeTime, severityBadge, sourceLabel, setError, animateIn, refreshIcons } from "../ui.js";
import { navigate } from "../router.js";

const CATS = ["all", "natural", "environment", "space", "science", "world", "economy"];
let timer;
let state = { category: "all", q: "", items: [] };

export async function renderSignals(root, params = {}) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="kicker">Live feed</div>
        <h2>Signals</h2>
        <p class="muted">Polled public event feeds · interval ~60s · not fabricated</p>
      </div>
      <div class="filters">
        <div class="field"><input id="sig-q" placeholder="Filter signals…" value="${state.q}" /></div>
      </div>
    </div>
    <div class="chip-row" id="sig-cats"></div>
    <div class="split-view">
      <div class="panel feed"><div class="panel-body" id="sig-list"><div class="loading">Loading signals…</div></div>
        <div class="source-line" id="sig-source"></div>
      </div>
      <div class="panel detail">
        <div class="panel-header"><div class="panel-title">Selection</div></div>
        <div class="panel-body" id="sig-detail"><div class="empty">Select a signal</div></div>
      </div>
    </div>
  `;
  document.getElementById("sig-cats").innerHTML = CATS.map(
    (c) => `<button class="chip${state.category === c ? " active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
  document.getElementById("sig-cats").onclick = (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    renderSignals(root, params);
  };
  let t;
  document.getElementById("sig-q").oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = e.target.value;
      drawList();
    }, 200);
  };
  await load();
  if (params.id) select(params.id);
  clearInterval(timer);
  timer = setInterval(load, 60000);
  refreshIcons();
}

async function load() {
  try {
    const data = await apiGet("/api/events", {
      limit: 150,
      category: state.category === "all" ? "" : state.category,
    });
    state.items = data.items || [];
    document.getElementById("sig-source").textContent = sourceLabel(data.source, data.updated_at) + " · refresh 60s";
    drawList();
  } catch (err) {
    setError(document.getElementById("sig-list"), err.message);
  }
}

function drawList() {
  const el = document.getElementById("sig-list");
  if (!el) return;
  const q = state.q.toLowerCase();
  const items = state.items.filter((e) => {
    if (!q) return true;
    return `${e.title} ${e.location_name || ""} ${e.category}`.toLowerCase().includes(q);
  });
  el.innerHTML = items.length
    ? items
        .map(
          (e) => `
      <div class="list-item" data-id="${e.id}">
        <div class="item-meta">${severityBadge(e.severity)} <span>${e.category}</span><span>${e.source}</span></div>
        <div class="item-title">${e.title}</div>
        <div class="item-meta"><span>${e.location_name || "—"}</span><span>${relativeTime(e.timestamp)}</span></div>
      </div>`
        )
        .join("")
    : `<div class="empty">No matching signals</div>`;
  el.querySelectorAll(".list-item").forEach((node) => {
    node.onclick = () => select(node.dataset.id);
  });
  animateIn(el);
}

function select(id) {
  const e = state.items.find((x) => x.id === id);
  const detail = document.getElementById("sig-detail");
  if (!e || !detail) return;
  detail.innerHTML = `
    <div class="chip-row" style="margin-bottom:8px">${severityBadge(e.severity)} <span class="badge cyan">${e.category}</span></div>
    <h3 style="margin:0 0 8px;font-size:16px">${e.title}</h3>
    <div class="item-meta"><span>${e.location_name || "—"}</span><span class="mono">${e.timestamp || "—"}</span></div>
    <p class="muted" style="margin-top:12px">${e.description || ""}</p>
    <div class="mono muted" style="margin-top:10px">${e.latitude ?? "—"}, ${e.longitude ?? "—"}</div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      ${e.latitude != null ? `<button class="btn primary" id="sig-map">View on map</button>` : ""}
      ${e.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${e.source_url}">Open source</a>` : ""}
    </div>
  `;
  const btn = document.getElementById("sig-map");
  if (btn) btn.onclick = () => navigate("/map");
  openDrawer({
    title: e.title,
    body: detail.innerHTML,
    source: `Source: ${e.source}`,
  });
}
