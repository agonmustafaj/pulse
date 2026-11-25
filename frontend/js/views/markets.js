import { apiGet } from "../api.js";
import { fmtNum, sourceLabel, setError, refreshIcons } from "../ui.js";

let chart;
let selected = "^GSPC";
let range = "1m";
let items = [];

export async function renderMarkets(root, params = {}) {
  if (params.symbol) selected = params.symbol;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="kicker">Markets</div>
        <h2>Market overview</h2>
        <p class="muted">Informational only · not financial advice · quotes may be delayed</p>
      </div>
      <div class="chip-row" id="mkt-ranges">
        ${["1d", "1w", "1m", "3m", "1y"].map((r) => `<button class="chip${range === r ? " active" : ""}" data-range="${r}">${r.toUpperCase()}</button>`).join("")}
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Instruments</div></div>
        <div class="panel-body" style="padding:0">
          <table class="table" id="mkt-table">
            <thead><tr><th>Name</th><th>Symbol</th><th>Price</th><th>Change</th><th>Source</th></tr></thead>
            <tbody><tr><td colspan="5"><div class="loading">Loading…</div></td></tr></tbody>
          </table>
        </div>
        <div class="source-line" id="mkt-source"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title" id="mkt-chart-title">History</div></div>
        <div class="panel-body"><div class="chart-wrap"><canvas id="mkt-chart"></canvas></div></div>
      </div>
    </div>
  `;
  document.getElementById("mkt-ranges").onclick = (e) => {
    const btn = e.target.closest("[data-range]");
    if (!btn) return;
    range = btn.dataset.range;
    document.querySelectorAll("#mkt-ranges .chip").forEach((c) => c.classList.toggle("active", c.dataset.range === range));
    loadHistory();
  };
  await load();
  refreshIcons();
}

async function load() {
  try {
    const data = await apiGet("/api/markets");
    items = data.items || [];
    document.getElementById("mkt-source").textContent =
      sourceLabel(data.source, data.updated_at) + " · " + (data.disclaimer || "");
    const tb = document.querySelector("#mkt-table tbody");
    if (!items.length) {
      tb.innerHTML = `<tr><td colspan="5"><div class="empty">No market data</div></td></tr>`;
      return;
    }
    tb.innerHTML = items
      .map((m) => {
        const cls = (m.change_percent || 0) >= 0 ? "pos" : "neg";
        return `<tr data-symbol="${m.symbol}">
          <td>${m.name}<div class="muted" style="font-size:10px">${m.category}</div></td>
          <td class="mono">${m.symbol}</td>
          <td class="mono">${fmtNum(m.price)}</td>
          <td class="mono ${cls}">${m.change_percent != null ? fmtNum(m.change_percent, 2) + "%" : "-"}</td>
          <td class="muted" style="font-size:10px">${m.source}</td>
        </tr>`;
      })
      .join("");
    tb.querySelectorAll("tr").forEach((tr) => {
      tr.onclick = () => {
        selected = tr.dataset.symbol;
        loadHistory();
      };
    });
    if (!items.find((i) => i.symbol === selected) && items[0]) selected = items[0].symbol;
    await loadHistory();
  } catch (err) {
    setError(document.querySelector("#mkt-table tbody"), err.message);
  }
}

async function loadHistory() {
  document.getElementById("mkt-chart-title").textContent = `${selected} · ${range.toUpperCase()}`;
  try {
    const data = await apiGet(`/api/markets/${encodeURIComponent(selected)}/history`, { range });
    const points = data.points || [];
    const labels = points.map((p) => {
      if (typeof p.t === "string") return p.t;
      const d = new Date(p.t);
      return range === "1d" ? d.toISOString().slice(11, 16) : d.toISOString().slice(5, 10);
    });
    chart?.destroy();
    chart = new Chart(document.getElementById("mkt-chart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: selected,
            data: points.map((p) => p.v),
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139,92,246,0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8993a3", maxTicksLimit: 8 }, grid: { color: "rgba(32,40,51,0.7)" } },
          y: { ticks: { color: "#8993a3" }, grid: { color: "rgba(32,40,51,0.7)" } },
        },
      },
    });
  } catch (err) {
    document.getElementById("mkt-chart-title").textContent = `History unavailable · ${err.message}`;
  }
}
