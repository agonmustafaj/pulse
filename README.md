# PULSE — The World. In Motion.

Premium global signal intelligence platform: interactive MapLibre map, live public-data feeds, FastAPI backend, modular vanilla JS frontend.

**Live frontend (Cloudflare Pages):** https://pulse-bw6.pages.dev/

> Real data only. No fabricated markers, prices, or “live” noise.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12+, FastAPI, Pydantic, httpx, in-memory TTL cache |
| Frontend | HTML/CSS/ES modules, MapLibre GL JS, Chart.js, GSAP, Lucide |
| Pages | `npm run build` → `dist/` (Cloudflare Pages output directory) |

---

## Quick start (local)

```bash
# 1) Frontend build (required — produces dist/)
npm run build

# 2) Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optional keys
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://127.0.0.1:8000 — FastAPI serves `dist/` and `/api/*`.

Optional keys in `backend/.env` (see `backend/.env.example`):

- `NASA_API_KEY` — Astronomy Picture of the Day
- `NEWS_API_KEY` — optional NewsAPI enrichment (RSS works without it)
- `CORS_ORIGINS` — comma-separated origins (default `*`)
- `REDIS_URL` — reserved; app uses in-memory cache by default

---

## Cloudflare Pages (frontend)

Configured for this repo:

| Setting | Value |
|---------|--------|
| Root directory | *(empty — repo root)* |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Live URL | https://pulse-bw6.pages.dev/ |

### How the frontend talks to the API

Pages cannot run FastAPI. Host the API separately (Render, Railway, Fly.io, a VPS, etc.), then set a **Pages environment variable**:

| Variable | Purpose |
|----------|---------|
| `PULSE_API_BASE` | Absolute API origin, e.g. `https://pulse-api.onrender.com` (no trailing slash) |

`npm run build` writes `dist/config.js` with:

```js
window.PULSE_API_BASE = "https://your-api.example.com";
```

The SPA calls `${PULSE_API_BASE}/api/...`. If the variable is empty, requests are same-origin (local uvicorn or a reverse proxy).

**CORS:** set `CORS_ORIGINS=https://pulse-bw6.pages.dev` on the API host.

**Optional same-path proxy:** set `PULSE_PAGES_PROXY=1` at build time to emit Cloudflare `_redirects` proxy rules for `/api/*` and `/ws/*` to `PULSE_API_BASE` (then you can leave `PULSE_API_BASE` empty in `config.js` by also using relative fetches — default build keeps absolute `PULSE_API_BASE` in config for explicit cross-origin).

---

## API hosting

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health check: `GET /api/health`  
OpenAPI: `/api/docs`

### Endpoints

- `GET /api/events` · `/api/events/{id}`
- `GET /api/news`
- `GET /api/weather` · `/api/weather/forecast` · `/api/weather/cities`
- `GET /api/markets` · `/api/markets/{symbol}/history`
- `GET /api/space` · `/api/space/iss`
- `GET /api/analytics`
- `GET /api/search?q=`
- `WS /ws/live`

---

## Data sources

Documented in detail: project store `docs/architecture-and-data-sources.md`.

| Domain | Provider |
|--------|----------|
| Earthquakes | USGS GeoJSON |
| Natural events | NASA EONET |
| Weather | Open-Meteo |
| ISS | wheretheiss.at (+ Open Notify fallback) |
| Launches | The Space Devs Launch Library 2 |
| APOD | NASA (optional key) |
| Crypto | CoinGecko |
| FX | Frankfurter / ECB |
| Equities / indices | Yahoo Finance chart API (delayed) |
| News | BBC / Guardian / NASA RSS (+ optional NewsAPI) |
| Map tiles | CARTO Dark Matter via MapLibre (OSM attribution) |

---

## Project layout

```
pulse/
├── package.json          # Pages: npm run build → dist/
├── scripts/build.mjs
├── frontend/             # SPA source
├── dist/                 # build output (gitignored)
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

---

## Modules

Overview · Map · Signals · News · Weather · Markets · Space · Analytics · **Ctrl/Cmd+K** search
