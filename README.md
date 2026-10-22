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

THERMO separates **observed** (OpenStreetMap snapshot, HDX/OCHA Dubai boundary, NASA browse imagery), **derived** (computed with documented formulas) and **simulated** (demonstration) values. The thermal potential is a **dimensionless 0–100 modelled index**, never presented as a measured temperature. The NASA satellite layer is visual context only — it is not used in the model, routing or simulations. See `DATA.md`.

## NASA satellite context layer

The maps include a NASA Earthdata GIBS layer (`MODIS_Terra_Land_Surface_Temp_Day`, configured date 2025-01-01, ~1 km native MODIS LST). It loads only the tiles visible in the current viewport. It is land-surface temperature from a fixed historical date, not a live temperature map and not THERMO's prediction; colours are a browse palette with no Celsius legend in this implementation.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build
npm run preview   # preview the production build
npm run lint      # oxlint
```

Requires Node ≥ 20. No API keys are required to view the deployed app (routing uses the best-effort public Valhalla provider; the NASA layer is public GIBS tiles). Numerical satellite validation is a separate offline workflow that needs a free NASA Earthdata Login — see `DATA.md`.

## Data pipeline

The committed spatial model is built from a fixed OSM snapshot (Geofabrik GCC extract) clipped to Dubai and the HDX/OCHA boundary, then processed with `osmium` and:

```bash
npm run build:data   # node --max-old-space-size=8192 scripts/data/build-dubai-spatial.mjs
```

The NASA tiles are not bundled — the browser loads only what it needs from GIBS. Numerical MODIS LST validation scripts (Earthdata-credentialed) live in `scripts/data/` (see `DATA.md`).

## Status

Bundled model covers OSM-supported urban Dubai within the verified Dubai Emirate boundary (4,414 × 750 m cells; Deira, Dubai Marina, Mirdif, Al Barsha, Dubai Hills, Dubai South and more), plus a global NASA satellite context layer. See `AGENTS.md` for the full implementation status and decisions.