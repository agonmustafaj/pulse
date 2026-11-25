import { apiGet } from "../api.js";
import { fmtNum, sourceLabel, setError, refreshIcons } from "../ui.js";

let charts = [];

export async function renderAnalytics(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="kicker">Trends</div>
        <h2>Analytics</h2>
        <p class="muted">Derived from live cached events & news, not demo values</p>
      </div>
    </div>
    <div class="grid-3" id="an-totals"></div>
    <div class="grid-analytics">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Timeline</div></div>
        <div class="panel-body"><div class="chart-wrap"><canvas id="an-timeline"></canvas></div></div>
        <div class="source-line" id="an-source"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">By category</div></div>
        <div class="panel-body"><div class="chart-wrap"><canvas id="an-cat"></canvas></div></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><div class="panel-title">By region (approximate)</div></div>
      <div class="panel-body"><div class="chart-wrap" style="height:260px"><canvas id="an-region"></canvas></div></div>
    </div>
  `;
  charts.forEach((c) => c.destroy());
  charts = [];
  try {
    const data = await apiGet("/api/analytics");
    document.getElementById("an-source").textContent = sourceLabel(data.source, data.updated_at);
    const t = data.totals || {};
    document.getElementById("an-totals").innerHTML = [
      ["Events", t.events],
      ["Earthquakes", t.earthquakes],
      ["Natural events", t.natural_events],
      ["News items", t.news],
    ]
      .map(
        ([label, v]) =>
          `<div class="panel"><div class="panel-body"><div class="stat"><div class="label">${label}</div><div class="value">${fmtNum(v, 0)}</div></div></div></div>`
      )
      .join("");

    charts.push(
      new Chart(document.getElementById("an-timeline"), {
        type: "line",
        data: {
          labels: (data.timeline || []).map((x) => x.date),
          datasets: [
            {
              data: (data.timeline || []).map((x) => x.count),
              borderColor: "#38bdf8",
              backgroundColor: "rgba(56,189,248,0.12)",
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: baseOpts(false),
      })
    );

    charts.push(
      new Chart(document.getElementById("an-cat"), {
        type: "doughnut",
        data: {
          labels: (data.by_category || []).map((x) => x.category),
          datasets: [
            {
              data: (data.by_category || []).map((x) => x.count),
              backgroundColor: ["#8b5cf6", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#64748b"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { color: "#8993a3", boxWidth: 10 } } },
        },
      })
    );

    charts.push(
      new Chart(document.getElementById("an-region"), {
        type: "bar",
        data: {
          labels: (data.by_region || []).map((x) => x.region),
          datasets: [
            {
              data: (data.by_region || []).map((x) => x.count),
              backgroundColor: "rgba(139,92,246,0.75)",
            },
          ],
        },
        options: baseOpts(false),
      })
    );
  } catch (err) {
    setError(document.getElementById("an-totals"), err.message);
  }
  refreshIcons();
}

function baseOpts(legend = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: legend, labels: { color: "#8993a3" } } },
    scales: {
      x: { ticks: { color: "#8993a3" }, grid: { color: "rgba(32,40,51,0.7)" } },
      y: { ticks: { color: "#8993a3" }, grid: { color: "rgba(32,40,51,0.7)" } },
    },
  };
}
