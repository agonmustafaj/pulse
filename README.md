# PULSE — The Cosmos. In Motion.

Cinematic **galaxy / space exploration** site: NASA Astronomy Picture of the Day, planets in orbit, ISS tracking, launches, and near-Earth objects.

**Live:** https://pulse-bw6.pages.dev/

> Real data only. No fabricated markers, ephemerides, or “live” noise.

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

Leave **`PULSE_API_BASE` empty** (or unset) so the SPA calls same-origin `/api/...`.

### Secrets (Pages → Settings → Environment variables)

| Variable | Purpose |
|----------|---------|
| `NASA_API_KEY` | **Required for reliable APOD / NeoWs** (DEMO_KEY is heavily rate-limited) |
| `NEWS_API_KEY` | Optional NewsAPI enrichment (RSS works without it) |

After merge to `main`, Pages rebuilds automatically.

---

## How to review a PR preview

1. Open the Cloudflare Pages **Preview** URL for the PR branch (Pages → Deployments → this branch), or the GitHub PR “Visit Preview” / deployment check link.
2. Confirm **Explore** home: full-bleed APOD hero, **PULSE** brand, planets section — not a multi-panel intel dashboard.
3. Use the **APOD date** control: pick a past date → image/title updates; try an edge date or clear failure path → graceful empty state.
4. Open **Orbit**: planets · ISS map · APOD · launches · NEOs.
5. Hit `/api/health` → `{"ok":true,"runtime":"cloudflare-pages",...}`
6. Hit `/api/space/apod?date=2015-07-14` (example) → JSON with `apod` when `NASA_API_KEY` is bound on the preview environment.

> **Note:** Bind `NASA_API_KEY` for **Preview** as well as Production in the Pages project, or APOD/NeoWs may fall back to DEMO_KEY limits.

---

## Stack

| Layer | Tech |
|-------|------|
| Production API | Cloudflare Pages Functions (`functions/api/`) |
| Local API | Python 3.12+, FastAPI, Pydantic, httpx, in-memory TTL cache |
| Frontend | HTML/CSS/ES modules, MapLibre (ISS/Earth), GSAP, Chart.js, Lucide |
| Ephemeris | JPL SSD planetary mean elements (server + canvas viz) |
| Pages build | `npm run build` → `dist/` |

---

## Quick start (local)

### Frontend + Pages Functions (closest to production)

```bash
npm run build
npx --yes wrangler@4 pages dev dist --port 8788
# optional: NASA_API_KEY=... npx wrangler pages dev dist --port 8788
```

Open http://127.0.0.1:8788

### Full local FastAPI (includes `/ws/live`)

```bash
npm run build
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set NASA_API_KEY
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## API endpoints

- `GET /api/health`
- `GET /api/space` · `?date=YYYY-MM-DD` (APOD for that date + ISS, launches, planets, NEOs)
- `GET /api/space/apod?date=YYYY-MM-DD` (APOD only; default today)
- `GET /api/space/iss`
- `GET /api/space/planets` (JPL SSD mean-element positions)
- `GET /api/space/neos`
- `GET /api/events` · `/api/news` · `/api/weather` · `/api/markets` · `/api/analytics` · `/api/search`
- `WS /ws/live` *(local FastAPI only)*

APOD dates: **1995-06-16** through today. Invalid / empty dates return `{ ok:false, missing:true, message, apod:null }` without crashing the UI.

---

## Data sources

| Domain | Provider |
|--------|----------|
| APOD | NASA APOD (`NASA_API_KEY`) |
| Planets | [JPL SSD approximate positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html) |
| ISS | wheretheiss.at (+ Open Notify fallback) |
| Launches | The Space Devs Launch Library 2 |
| NEOs | NASA NeoWs |
| Earthquakes | USGS GeoJSON |
| Natural events | NASA EONET |
| Weather | Open-Meteo |
| Markets | CoinGecko / Frankfurter / Yahoo |
| News | BBC / Guardian / NASA RSS |
| Map tiles | OpenFreeMap via MapLibre (ISS / Earth views) |

---

## Modules

**Explore** (galaxy home) · **Orbit** (primary space) · Earth · Signals · News · Weather · Markets · Analytics · **Ctrl/Cmd+K** search

Earthquakes, markets, and general news remain available but are **demoted** off the home experience.
