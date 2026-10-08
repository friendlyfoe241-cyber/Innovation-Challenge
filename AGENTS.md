# THERMO — Heat-Aware Urban Intelligence Platform

THERMO is a software-first urban heat intelligence product for **Dubai, UAE**. It helps people
understand urban heat, navigate it more safely (heat-aware routing), and explore how cities could
reduce it (intervention simulation).

Built as a student innovation project for the **GEMS Global Innovation Challenge 2026–27**.

> Brand language: warm sunlight + asphalt + shade + maps + environmental data + calm engineering.
> NOT: orange gradients + glowing AI blobs + sci-fi neon. No "AI chatbot", no generic SaaS.

## Product concept

Three user groups, one product:

1. **Individuals** — pick a route that minimizes heat exposure ("Dubai Mall → DIFC at 14:30").
2. **Schools / organisations** — campus heat overview (outdoor areas, bus pickup, sports zones).
3. **Urban planners / researchers** — identify where shade/vegetation interventions matter most.

Core loop: **Observe → Navigate → Improve**.

## Pages / routes

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | LandingPage | Product intro + storytelling (hero → problem → see → move → change → platform → CTA) |
| `/explore` | ExplorerPage | Urban Heat Explorer (map, time, layers, details) |
| `/route` | RoutePlannerPage | Heat-aware route planner (alternatives + trade-off) |
| `/simulate` | SimulatePage | Urban Intervention Simulator (scenario modelling) |
| `/dashboard` | DashboardPage | District overview dashboard |
| `/about` | AboutPage | Methodology, data provenance, limitations |

## Tech stack

- React 19 + TypeScript + Vite 8
- Tailwind is NOT used — custom CSS design system (`src/styles/`)
- Leaflet + react-leaflet for maps
- GSAP + Lenis (smooth scroll), respecting `prefers-reduced-motion`
- Recharts (dashboard/sim charts)
- ESM Node scripts under `scripts/data/` for the data pipeline
- Fonts: Geist (display) + Manrope (body) + IBM Plex Mono (labels) via @fontsource

## Architecture

```
src/
  components/
    navigation/    Nav, Footer
    hero/          HeroField (canvas living-map visual)
    maps/          HeatMap, RouteMap, InterventionMap (Leaflet)
    ui/            Button, Wordmark, SectionHeading, ThermalScale, Provenance, SolarTimeline, …
  pages/           LandingPage, ExplorerPage, RoutePlannerPage, SimulatePage, DashboardPage, AboutPage
  lib/
    heat/          heatModel.ts (heat exposure index, LST model), districtStats.ts
    routing/       routeEngine.ts (weighted-journey router on OSM-derived graph)
    simulation/    scenarioModel.ts (interventions → tile deltas)
    geo/           geo.ts (distance/coordinate helpers)
  data/
    places.ts      curated landmarks/districts/POIs (demonstration coordinates)
    datasets.ts    data catalog + lazy loaders (fetchLayers / fetchGraph); tiles.json bundled
    dubai/         tiles.json (bundled heat grid, ~128 KB)
  hooks/           useSmoothScroll, usePrefersReducedMotion, useData (useLayers/useGraph)
  public/data/     layers.json + graph.json (~4.6 MB each) served statically, fetched lazily
  types/           domain.ts
  styles/          global.css (tokens), components.css (component & page styles)
```

Domain logic stays OUT of UI. All models are pure functions over `HeatTile[]` / the route graph.

## Data strategy — OBSERVED / DERIVED / SIMULATED

Every value shown has a provenance. There are exactly three categories (see §28A of the brief).

- **OBSERVED** — from a documented real dataset. For this prototype: **OpenStreetMap** geometry
  (buildings, roads, paths, green/water, POIs, schools) fetched from the **Overpass API**
  (bbox `25.155,55.225,25.285,55.335` — Downtown Dubai / Business Bay / DIFC / Zabeel corridor).
- **DERIVED** — outputs of THERMO's documented formulas computed from OSM data
  (heat exposure index, LST estimate, route heat scores, district stats).
- **SIMULATED** — synthetic values with no measurement basis (e.g. normative air temperature,
  intervention outcomes, diurnal curve). Always labelled "Simulation / Modelled estimate".

**Critical rules:**
- Land-surface temperature is NOT air temperature. We show **LST estimates** and clearly label
  them as modelled.
- The **THERMO Heat Exposure Index** is a *prototype analytical index*, never a health warning.
- Route scores = **estimated environmental heat exposure**, not physiological risk.
- Intervention outcomes are **modelled scenarios**, not predictions.
- Never invent sources or datasets. If a value's provenance is unclear, mark it SIMULATED.

## Heat model (`src/lib/heat/heatModel.ts`)

- `tile` fields: normalized fractions `b` (built), `p` (pavement), `g` (green), `wt` (water),
  `pd` (population/activity index), `h` (mean building height, m).
- `surfaceTempFor(tile, hour)`: diurnal LST estimate from air temperature + per-surface albedo
  decomposition + green/water cooling + urban-heat bonus.
- `heatIndexFor(tile, hour)`: scaled 0–100 prototype exposure index from LST + vegetation deficit +
  surface albedo + built density + time-of-day stress. Formula documented on `/about`.
- `heatBand`, `bandLabel`, `bandColor`: 5-step categorical scale (Low / Moderate / Elevated / High /
  Extreme), designed to be non-colour-dependent (labels & numbers always shown).
- `airTempAtTile(tile, hour)`: **normative model curve** — labelled simulation.

## Route model (`src/lib/routing/routeEngine.ts`)

- Dijkstra on the OSM-derived graph (approx 31k nodes / 34k edges) using an edge weight that blends
  distance (or time) with estimated heat exposure (`heatIndexFor` on the nearest tile at each edge
  midpoint, via `createTileLookup`).
- Three alternatives via **edge-penalty re-routing**: the fastest path is found first; the balanced
  option blends distance + exposure (by the user preference) and is penalised off the fastest path;
  then a strong exposure-weighted re-run is penalised off both prior paths. Each alternative is a
  genuinely distinct street combination.
- Routes are classified by measured time/heat into **Fastest / Balanced / Cooler** labels; the
  low-heat alternative is tagged "Recommended for lower heat exposure".
- User preference slider maps to a blend coefficient: left = distance/time, right = exposure.
- Segment-level breakdowns: distance, duration, heat score, exposed vs shaded/protected time.
- Always worded "recommended for lower heat exposure" — never "this is the correct route".

## Simulation model (`src/lib/simulation/scenarioModel.ts`)

- Sliders (0–50%): vegetation, shade walkways, reflective surfaces, depave (reduce exposed pavement).
- `applyIntervention` mutates tile properties; `scenarioSummary` returns baseline vs scenario heat
  index and % improvement. **All results are modelled, not observed.**

## Data pipeline (Node/ESM in `scripts/data/`)

- `fetch-overpass.mjs` — queries Overpass API by category with HTTP-500 retry/backoff → `data/raw/*.json`.
- `process.mjs` — rasterizes OSM features into a tile grid, layer geometries, and a routable
  street graph. `tiles.json` is written to `src/data/dubai/` (bundled, ~128 KB); `layers.json`
  and `graph.json` are written to `public/data/` and fetched lazily at runtime.
- Bundle optimisation: initial JS is ~700 KB (211 KB gzip); heavy vector data loads on demand.

Run: `npm run fetch:data` then `npm run process:data`.
Requires Python? No — the whole pipeline is Node/ESM (no shapely/numpy needed).

## Environment / secrets

- No API keys required. Overpass API is public (rate-limited) and map pins use OSM standard tiles.
- `.env.example` is empty of secrets (see `.env.example`).
- No secrets are committed.

## Dev commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server | `npm run dev` |
| Typecheck | `npx tsc -b` |
| Build | `npm run build` |
| Preview build | `npm run preview` |
| Lint | `npx oxlint src` |
| Fetch OSM data | `npm run fetch:data` |
| Process data | `npm run process:data` |

## Git workflow

- Branch: `main`; remote: `github.com/friendlyfoe241-cyber/Innovation-Challenge`.
- Commit after every meaningful milestone (feat:/fix:/style:/docs:/perf:), then push.
- Inspect `git status` / `git log` before changing; never blindly overwrite existing work.

## Current implementation status

**Complete:**
- Data pipeline: Overpass fetch (real OSM: ~26k buildings, 6.7k roads, 5k paths, 1.3k green, 175 water,
  1.6k POIs, 8 schools) + processing to grid/layers/graph.
- Provenance docs: README.md, DATA.md, .env.example.
- Design-system foundation: tokens, typography, Nav/Footer, Button, Wordmark, SectionHeading,
  ThermalScale legend, Provenance badges, SolarTimeline sun-arc widget.
- Lenis + GSAP scaffolding (reduced-motion aware) via hooks.
- Landing page complete (hero canvas field, storytelling sections, CTAs).
- Urban Heat Explorer page complete: interactive Leaflet map with live OSM base tiles, heat grid
  (per-tile Heat Exposure Index coloured by band), buildings/vegetation/water/roads/school layers,
  hour-of-day SolarTimeline control, neighbourhood quick-cards (district stats), thermal scale
  legend, crosshair + cursor readout, and a click-to-inspect location panel with interpretable
  "why this score". All heat values labelled DERIVED/SIMULATED.

**Complete (continued)**
- Route Planner page: map + From/To + departure time + walk/cycle mode + Fastest / Balanced /
  Cooler alternatives via penalty-based re-routing + preference slider + per-route heat breakdown
  (exposed vs shaded minutes, heat score). Browser-verified.
- Bundle/performance fix: `layers.json` + `graph.json` moved out of the JS bundle into
  `public/data/` and lazy-loaded (`useLayers` / `useGraph`). Initial bundle ~700 KB (211 KB gzip).

**In progress**
- Intervention Simulator page (sliders + scenario map + before/after + comparison table + charts).
- Dashboard page (district stats, trends).
- Methodology page (/about) with data catalog + model documentation + limitations.

**Known limitations**
- Heat values are DERIVED/SIMULATED — no satellite LST or air-temperature feed yet.
- Route graph is a demonstration simplification of the street network (footpaths + roads);
  alternatives are heuristic, not commercial-grade.
- School mode uses assumed campus footprint (GEMS Wellington coords marked as demonstration).
- Intervention coefficients are hypotheses drawn from urban-heat literature summaries, clearly
  labelled as such (see DATA.md).

## Visual system (brief)

- Ink `#232a26` on warm paper `#f6f2ea`; accents amber `#d97a1e` (ember), sun `#f3c77c`.
- Parchment `#efeadf` surfaces; deep `#161c19` for map/hero depths.
- Thermal scale: cool `#3f7d78` → mild `#8a9a5b` → warm `#d9a94e` → hot `#d9771f` → extreme `#b4521c`.
- Typography: Geist display, Manrope body, IBM Plex Mono labels. Uppercase micro-labels strong hierarchy.
- Motifs: solar arc, heat contours, urban grid, shadow, crosshair readouts. Slow purposeful motion.