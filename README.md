# THERMO — Heat-Aware Urban Intelligence

THERMO is a software-first urban heat intelligence platform for Dubai, UAE.
It helps people **understand** urban heat, **navigate** it more safely, and
**explore** how cities could reduce it.

> See the heat. Find the shade. Shape cooler cities.

## Capabilities

- **Heat Explorer** (`/explore`) — interactive map of estimated heat exposure with time-of-day controls, layer toggles and interpretable location panels.
- **Route Planner** (`/route`) — walking/cycling route alternatives scored for heat exposure, with a *faster ↔ cooler* preference control.
- **Intervention Simulator** (`/simulate`) — model what vegetation, shaded walkways, reflective surfaces or depaving could do to a neighbourhood.
- **Methodology** (`/about`) — data sources, the heat model, limitations and roadmap.

## Data integrity

THERMO separates **observed** (OpenStreetMap), **derived** (computed with documented
formulas) and **simulated** (demonstration) values. Temperatures and heat indices are
**modelled estimates**, never presented as real measurements. See `DATA.md`.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build
npm run preview   # preview the production build
npm run lint      # oxlint
```

Requires Node ≥ 20. No API keys are required — the app runs in Demo Mode by default.

## Data pipeline

```bash
node scripts/data/fetch-overpass.mjs   # pull OSM data for the Dubai corridor
node scripts/data/process.mjs          # build tiles.json / layers.json / graph.json
```

## Status

Bundled demo data covers a ~44 km² corridor of central Dubai
(Downtown, Business Bay, DIFC, Zabeel, Al Safa). See `AGENTS.md` for the full
implementation status and decisions.