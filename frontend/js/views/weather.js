import { apiGet } from "../api.js";
import { fmtNum, sourceLabel, setError, refreshIcons } from "../ui.js";

let chartHourly;
let chartDaily;
let city = "Tokyo";

export async function renderWeather(root, params = {}) {
  if (params.city) city = params.city;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="kicker">Environment</div>
        <h2>Weather</h2>
        <p class="muted">Open-Meteo current conditions & forecast</p>
      </div>
      <div class="field" style="min-width:240px">
        <input id="wx-city" value="${city}" placeholder="Search city…" />
        <button class="btn primary" id="wx-go">Go</button>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Current</div></div>
        <div class="panel-body" id="wx-current"><div class="loading">Loading…</div></div>
        <div class="source-line" id="wx-source"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">Hourly temperature</div></div>
        <div class="panel-body"><div class="chart-wrap"><canvas id="wx-hourly"></canvas></div></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><div class="panel-title">7-day forecast</div></div>
      <div class="panel-body"><div class="chart-wrap"><canvas id="wx-daily"></canvas></div>
        <div id="wx-daily-list" style="margin-top:12px"></div>
      </div>
    </div>
  `;
  const run = () => {
    city = document.getElementById("wx-city").value.trim() || city;
    load();
  };
  document.getElementById("wx-go").onclick = run;
  document.getElementById("wx-city").addEventListener("keydown", (e) => e.key === "Enter" && run());
  await load();
  refreshIcons();
}

async function load() {
  try {
    const data = await apiGet("/api/weather/forecast", { city });
    if (!data.ok || !data.current) {
      setError(document.getElementById("wx-current"), data.message || "Unavailable");
      return;
    }
    const c = data.current;
    document.getElementById("wx-current").innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="label">Location</div><div class="value" style="font-size:15px">${c.location}</div></div>
        <div class="stat"><div class="label">Condition</div><div class="value" style="font-size:15px">${c.condition || "-"}</div></div>
        <div class="stat"><div class="label">Temp</div><div class="value">${fmtNum(c.temperature_c, 1)}°C</div></div>
        <div class="stat"><div class="label">Feels</div><div class="value">${fmtNum(c.feels_like_c, 1)}°C</div></div>
        <div class="stat"><div class="label">Humidity</div><div class="value">${fmtNum(c.humidity, 0)}%</div></div>
        <div class="stat"><div class="label">Wind</div><div class="value">${fmtNum(c.wind_speed_kmh, 0)} km/h</div></div>
        <div class="stat"><div class="label">Pressure</div><div class="value">${fmtNum(c.pressure_hpa, 0)} hPa</div></div>
        <div class="stat"><div class="label">AQI</div><div class="value">${c.aqi != null ? fmtNum(c.aqi, 0) : "-"}</div></div>
      </div>
      <div class="mono muted" style="margin-top:10px">${fmtNum(c.latitude, 3)}, ${fmtNum(c.longitude, 3)} · ${c.local_time || ""} · ${c.timezone || ""}</div>
    `;
    document.getElementById("wx-source").textContent = sourceLabel(data.source, data.updated_at);

    const hourly = (data.forecast?.hourly || []).slice(0, 24);
    const hctx = document.getElementById("wx-hourly");
    chartHourly?.destroy();
    chartHourly = new Chart(hctx, {
      type: "line",
      data: {
        labels: hourly.map((h) => (h.time || "").slice(11, 16)),
        datasets: [
          {
            label: "°C",
            data: hourly.map((h) => h.temperature_c),
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56,189,248,0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: chartOpts(),
    });

    const daily = data.forecast?.daily || [];
    const dctx = document.getElementById("wx-daily");
    chartDaily?.destroy();
    chartDaily = new Chart(dctx, {
      type: "bar",
      data: {
        labels: daily.map((d) => d.date),
        datasets: [
          { label: "Max °C", data: daily.map((d) => d.temp_max_c), backgroundColor: "rgba(139,92,246,0.7)" },
          { label: "Min °C", data: daily.map((d) => d.temp_min_c), backgroundColor: "rgba(56,189,248,0.45)" },
        ],
      },
      options: chartOpts(),
    });

    document.getElementById("wx-daily-list").innerHTML = daily
      .map(
        (d) =>
          `<div class="item-meta" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span>${d.date}</span><span>${d.condition || "-"}</span>
            <span class="mono">${fmtNum(d.temp_min_c, 0)}° / ${fmtNum(d.temp_max_c, 0)}°</span>
          </div>`
      )
      .join("");
  } catch (err) {
    setError(document.getElementById("wx-current"), err.message);
  }
}

function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#8993a3", boxWidth: 10 } } },
    scales: {
      x: { ticks: { color: "#8993a3", maxRotation: 0 }, grid: { color: "rgba(32,40,51,0.7)" } },
      y: { ticks: { color: "#8993a3" }, grid: { color: "rgba(32,40,51,0.7)" } },
    },
  };
}
