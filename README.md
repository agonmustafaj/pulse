# PULSE — The World. In Motion.

Premium global signal intelligence platform: interactive MapLibre map, live public-data feeds, modular vanilla JS frontend, and a same-origin API.

**Live:** https://pulse-bw6.pages.dev/

> Real data only. No fabricated markers, prices, or “live” noise.

---

## Deploy model (Orbit-style)

**Production is Cloudflare Pages only** — Git connect, build static assets, serve `/api/*` via **Pages Functions**. No separate Render/Railway/Fly API host is required.

| Setting | Value |
|---------|--------|
| Root directory | *(empty — repo root)* |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | `functions/` at repo root (not inside `dist`) |
| Live URL | https://pulse-bw6.pages.dev/ |

Leave **`PULSE_API_BASE` empty** (or unset) so the SPA calls same-origin `/api/...`. Pages Functions implement those routes and call public providers (USGS, EONET, Open-Meteo, ISS, launches, CoinGecko, Frankfurter, Yahoo, RSS).

Optional Pages secrets (Functions env):

| Variable | Purpose |
|----------|---------|
| `NASA_API_KEY` | Astronomy Picture of the Day (DEMO_KEY used if unset) |
| `NEWS_API_KEY` | Optional NewsAPI enrichment (RSS works without it) |

After merge to `main`, Pages rebuilds automatically. Verify:

1. Open https://pulse-bw6.pages.dev/
2. Confirm Overview panels load (events, news, weather, markets, space)
3. Hit https://pulse-bw6.pages.dev/api/health → `{"ok":true,"runtime":"cloudflare-pages",...}`

No extra click is required if Git integration + auto-deploy on `main` is already connected. If the deploy did not start, open the Pages project → **Deployments** → **Retry deployment** (or push an empty commit).

---

## Stack

| Layer | Tech |
|-------|------|
| Production API | Cloudflare Pages Functions (`functions/api/`) |
| Local API | Python 3.12+, FastAPI, Pydantic, httpx, in-memory TTL cache |
| Frontend | HTML/CSS/ES modules, MapLibre GL JS, Chart.js, GSAP, Lucide |
| Pages build | `npm run build` → `dist/` |

---

## Quick start (local)

### Frontend only + Pages Functions (closest to production)

```bash
npm run build
npx --yes wrangler@4 pages dev dist --port 8788
```

Open http://127.0.0.1:8788 — static `dist/` + `functions/` as `/api/*`.

### Full local FastAPI (feature-complete, includes `/ws/live`)

```bash
# 1) Frontend build
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
- `NEWS_API_KEY` — optional NewsAPI enrichment
- `CORS_ORIGINS` — comma-separated origins (default `*`)
- `REDIS_URL` — reserved; app uses in-memory cache by default

---

## How the frontend talks to the API

`window.PULSE_API_BASE` comes from `dist/config.js` (written by `npm run build`).

- **Empty (default / production):** same-origin `/api/...` → Pages Functions (or local uvicorn)
- **Absolute URL:** only if you intentionally host FastAPI elsewhere

WebSocket `/ws/live` is available under local FastAPI. On Pages it is not required — views poll REST; the client stops retrying after a few failed connects.

---

## API endpoints

- `GET /api/health`
- `GET /api/events` · `/api/events/{id}`
- `GET /api/news`
- `GET /api/weather` · `/api/weather/forecast` · `/api/weather/cities`
- `GET /api/markets` · `/api/markets/{symbol}/history`
- `GET /api/space` · `/api/space/iss`
- `GET /api/analytics`
- `GET /api/search?q=`
- `WS /ws/live` *(local FastAPI only)*

Local OpenAPI: `/api/docs` (FastAPI).

---

## Data sources

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
├── package.json            # Pages: npm run build → dist/
├── scripts/build.mjs
├── frontend/               # SPA source
├── dist/                   # build output (gitignored)
├── functions/              # Cloudflare Pages Functions (BFF /api)
│   └── api/                # route handlers + _lib providers
├── backend/                # FastAPI for local / optional split host
│   ├── app/
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

Cloudflare picks up `functions/` from the **repository root** alongside the Pages build output directory (`dist`). Do not copy Functions into `dist`.

---

## Modules

Overview · Map · Signals · News · Weather · Markets · Space · Analytics · **Ctrl/Cmd+K** search
