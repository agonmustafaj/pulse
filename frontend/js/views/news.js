import { apiGet } from "../api.js";
import { openDrawer, relativeTime, sourceLabel, setError, animateIn, refreshIcons } from "../ui.js";

const CATS = ["all", "world", "technology", "science", "business", "environment"];
let state = { category: "all", q: "", items: [] };

export async function renderNews(root, params = {}) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="kicker">Headlines</div>
        <h2>News</h2>
        <p class="muted">Public RSS sources · summaries as provided · link out for full articles</p>
      </div>
      <div class="field" style="min-width:220px"><input id="news-q" placeholder="Search headlines…" /></div>
    </div>
    <div class="chip-row" id="news-cats"></div>
    <div class="split-view">
      <div class="panel"><div class="panel-body" id="news-list"><div class="loading">Loading news…</div></div>
        <div class="source-line" id="news-source"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Article</div></div>
        <div class="panel-body" id="news-detail"><div class="empty">Select a story</div></div>
      </div>
    </div>
  `;
  document.getElementById("news-cats").innerHTML = CATS.map(
    (c) => `<button class="chip${state.category === c ? " active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
  document.getElementById("news-cats").onclick = (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    renderNews(root, params);
  };
  let t;
  document.getElementById("news-q").oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = e.target.value;
      load();
    }, 250);
  };
  await load();
  if (params.id) select(params.id);
  refreshIcons();
}

async function load() {
  try {
    const data = await apiGet("/api/news", {
      category: state.category === "all" ? "" : state.category,
      query: state.q,
      limit: 60,
    });
    state.items = data.items || [];
    document.getElementById("news-source").textContent = sourceLabel(data.source, data.updated_at);
    const el = document.getElementById("news-list");
    el.innerHTML = state.items.length
      ? state.items
          .map(
            (a) => `
        <div class="list-item" data-id="${a.id}">
          <div class="item-meta"><span class="badge">${a.category}</span><span>${a.source}</span></div>
          <div class="item-title">${a.headline}</div>
          <div class="item-meta"><span>${relativeTime(a.published)}</span></div>
        </div>`
          )
          .join("")
      : `<div class="empty">No articles</div>`;
    el.querySelectorAll(".list-item").forEach((n) => (n.onclick = () => select(n.dataset.id)));
    animateIn(el);
  } catch (err) {
    setError(document.getElementById("news-list"), err.message);
  }
}

function select(id) {
  const a = state.items.find((x) => x.id === id);
  const el = document.getElementById("news-detail");
  if (!a || !el) return;
  el.innerHTML = `
    <div class="item-meta"><span class="badge cyan">${a.category}</span><span>${a.source}</span></div>
    <h3 style="margin:8px 0">${a.headline}</h3>
    <div class="mono muted">${a.published || "-"}</div>
    <p style="margin-top:12px">${a.description || "<span class='muted'>No summary provided by source.</span>"}</p>
    <a class="btn primary" style="margin-top:14px" href="${a.url}" target="_blank" rel="noopener">Read at source</a>
  `;
  openDrawer({ title: a.headline, body: el.innerHTML, source: `Source: ${a.source}` });
}
