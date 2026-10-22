# THERMO — Dubai + global heat-aware urban intelligence

THERMO is a React + TypeScript + Vite prototype for exploring a global satellite land-surface-temperature context layer plus **modelled thermal exposure**, constrained interventions, and heat-aware walk/cycle routes in Dubai. It is an innovation prototype, not a weather product, medical heat-risk system, navigation guarantee, or planning approval tool.

> Product loop: **Observe → Navigate → Improve**. Brand language: warm sunlight, asphalt, shade, maps, environmental data and calm engineering. Avoid synthetic “AI” styling and claims of false precision.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Product story and entry points |
| `/explore` | Continuous modelled thermal-potential field with coverage limits |
| `/route` | Searchable walk/cycle routing with live OSM network geometry |
| `/simulate` | Land-cover-aware hypothetical intervention scenarios |
| `/dashboard` | Data-supported district reference points and coverage status |
| `/about` | Sources, method, provider behavior and limitations |

`public/manus-routes.json` mirrors this manifest. `vercel.json` provides the SPA rewrite required for direct Vercel route loads.

## Stack & architecture

- React 19, TypeScript, Vite 8, React Router, Leaflet/react-leaflet.
- GSAP/Lenis are retained for the narrative shell, respecting reduced motion. No new animation should obscure data state.
- Custom CSS lives in `src/styles/`; no Tailwind.
- `src/types/domain.ts` defines the shared `SpatialModel`, `SpatialCell`, source metadata and local-search contracts.
- `src/data/datasets.ts` lazily fetches the static spatial model from `public/data/dubai-spatial-model.json`.
- `src/data/nasaLst.ts` is the single source of truth for the NASA GIBS layer constants (product id, fixed date, tile URL, verified resolution facts) and the `NASA_LST` copy used by the UI notes.
- `src/components/maps/GlobalThermalLayer.tsx` lazily requests only visible NASA GIBS MODIS land-surface-temperature tiles via those constants. This layer is global, observed satellite browse imagery and must not be treated as the local modelled potential.
- `src/components/ui/NasaLstNote.tsx` renders the "NASA LST · VIEW ONLY" map note and the Explorer "Satellite context layer" panel. Never imply a Celsius legend for the GIBS PNG colours: no verified decoding path exists in this implementation.
- `src/lib/heat/heatModel.ts` is the sole thermal-potential function and sampler. Explorer, simulation and route metrics must use it—not independent formulas.
- `src/lib/simulation/scenarioModel.ts` applies eligibility masks and local spill-over only. It must never use a blanket temperature subtraction or multiplier.
- `src/lib/routing/routeEngine.ts` requests Valhalla pedestrian/bicycle OSM routing and samples returned real geometry against the shared field.
- `src/components/maps/ThermalFieldLayer.tsx` draws the smooth canvas raster and contour bands. Its interpolation is display-only and must remain constrained to supported source cells.

## Data integrity: observed, derived, simulated

Use exactly these labels in UI and documentation:

- **OBSERVED:** documented source geometry/boundary, including OSM geometry/access tags and HDX/OCHA boundary data.
- **DERIVED:** the 750 m spatial cells, thermal-potential field, masks, route metric samples and coverage checks.
- **SIMULATED:** intervention scenarios only.

The thermal value is a **dimensionless 0–100 modelled potential**. It is not air temperature, land-surface temperature, an apparent temperature or health score. Do not reintroduce fabricated °C values, weather curves, shade percentages or sensor claims.

### Source catalogue

| Source | Current use | Snapshot / terms |
| --- | --- | --- |
| OpenStreetMap contributors / Geofabrik GCC extract | Buildings, highways, access, vegetation, water, runways, bare land, named places | OSM snapshot 2026-10-15T20:21:00Z; ODbL 1.0; attribution required |
| HDX/OCHA COD-AB UAE admin-1 v01 | Dubai Emirate (`AE02`) boundary used to constrain the urban analysis window | valid from 2023-05-15; CC BY-IGO |
| Valhalla public OSM route endpoint | Real walk/cycle paths with provider access/costing rules | best-effort public service; CORS checked 2026-10-16 |
| NASA Earthdata GIBS / MODIS Terra daytime LST | Viewport-loaded global land-surface-temperature tiles, configured for 2025-01-01 | global browse imagery; approximately 1 km source pixels; cloud/retrieval gaps; attribution required |

Source URLs and detailed licence/method notes are in `DATA.md` and `/about`.

## Coverage & field resolution

The Explorer has two deliberately separate spatial layers:

- **Global context:** NASA GIBS tiles are requested by Leaflet for the visible viewport only, from zoom 2 through the native Level 7 tile matrix. This gives world/UAE visual coverage without bundling or inventing a world raster. It is observed satellite land-surface temperature, not air temperature, shade, or THERMO potential.
- **Dubai local model:** `public/data/dubai-spatial-model.json` contains 4,414 OSM-supported 750 m cells in the verified Dubai boundary and explicit urban window. It remains the only layer used by the local field sampler, simulator and route metrics.

`public/data/dubai-spatial-model.json` currently contains **4,414 OSM-supported 750 m cells** in an explicit urban Dubai window (`24.75–25.45 N`, `54.85–55.72 E`) constrained by the verified Dubai boundary. It includes data-supported coverage around Downtown, Deira, Dubai Marina, Mirdif, Al Barsha, Dubai Hills and Dubai South.

Cells without fixed-snapshot OSM support are omitted. The canvas makes those areas transparent: do not stretch, fill, nearest-neighbour copy or visually imply coverage beyond them. Smooth raster display is local bilinear interpolation among supported cells only. Contours at 40/55/70/82 are model bands, not measured isotherms.

## Land-cover-aware simulation

The fixed OSM snapshot classifies:

- buildings: `building=*` polygons;
- roads: `highway=*` line density;
- vegetation: selected `landuse`, `leisure` and `natural` green tags;
- water: `natural=water`, `water=*`, basin/reservoir;
- runways/taxiways: `aeroway=runway|taxiway`;
- bare/support land: selected bare/natural/construction tags.

Eligibility is hard-coded and documented:

- vegetation → mapped road-edge or bare-land support only;
- walkway shade → cells with mapped walk-network support only;
- cool surfaces → mapped building, road or bare support only;
- depave → mapped road support only;
- water and runway cells → excluded from all direct changes and nearby cooling.

Vegetation/shade carry-over uses a 1.2 km radius, 620 m Gaussian scale and a 35% maximum source-local influence. It is applied only to supported non-water/non-runway neighbours. Reflective and depaving effects remain local. These coefficients are scenario assumptions, not predictions.

## Heat-aware routing

Routes must use `walk` or `cycle` mode and a **genuine pedestrian/cycle OSM routing provider**. The UI must draw all returned polylines and start/end markers; cards alone are insufficient. Route metrics supported today are distance, ETA, modelled average potential, modelled peak potential and modelled time above the high-potential threshold. No shade metric is available.

Valhalla does not expose a custom THERMO edge-weight parameter. THERMO uses a documented valid alternative that changes the provider’s path search:

1. create the shared baseline field for the selected hour;
2. sample the initial real path against that field;
3. send a bounded set of high-potential matched route locations as `exclude_locations` **before** each provider follow-on network search;
4. Fastest has no exclusions; Balanced excludes a small very-high set; Coolest excludes a bounded high set;
5. reject heat-aware paths that exceed the fastest route’s 1.5× time or 1.45× distance guardrails, or do not improve a supported exposure metric (Coolest must reduce mean potential);
6. sample each accepted real provider geometry against the shared field.

This is categorical thermal avoidance, not continuous calibrated thermal cost. Do not claim otherwise. If the provider cannot find a path, show that limitation instead of inventing a route.

## Data build pipeline

`data/source/` is ignored: it contains reproducible downloads, never committed raw data.

1. Download the HDX/OCHA UAE boundary and Geofabrik GCC PBF snapshot.
2. Use `osmium` to extract the Dubai urban window and selected OSM tags.
3. Export thematic GeoJSON.
4. Run `npm run build:data` to create the committed static Dubai model and routing-provider metadata. Do not download or bundle the global NASA tile archive; the browser loads those tiles on demand.

See `DATA.md` for exact commands. Do not silently substitute old Downtown raw files, random values or a widened grid when rebuilding.

### Numerical satellite validation (offline)

`scripts/data/fetch-modis-lst.sh` (Earthdata-token authenticated retrieval of MOD11A1.061 HDF for SIN tile `h23v06`) and `scripts/data/validate-modis-lst.mjs` (QC-filtered, rank-based spatial comparison of numerical LST vs the modelled field) are the sanctioned validation path. They never run in the browser, never require an API key from app users, and the validator refuses to fabricate a result with too few valid samples. See DATA.md §"Numerical satellite-validation workflow".

## Development & validation

| Action | Command |
| --- | --- |
| Install | `npm install` |
| Data build (with source downloads present) | `npm run build:data` |
| Typecheck + production build | `npm run build` |
| Lint | `npx oxlint src` |
| Local preview | `npm run dev -- --host 0.0.0.0` |

Before a milestone commit: inspect `git status` and diffs, run relevant build/lint checks, verify direct SPA paths are covered by `vercel.json`, and check Explorer, Simulator and Route flows. Commit meaningful milestones on `main`, then push to `origin/main`; never force-push or overwrite unrelated user work.

## Current limitations

- No numerically ingested satellite LST, weather-station/air-temperature data, humidity, wind, sensors, surveyed canopy or verified shade raster. The NASA GIBS layer is browse imagery for context only; numerical LST validation is a prepared offline workflow waiting for Earthdata credentials.
- OSM completeness and access tagging vary; paths are provider results, not a safety/access guarantee.
- Public Valhalla routing availability is best-effort and its OSM snapshot can differ from the fixed spatial-model snapshot.
- Global MODIS LST imagery is land-surface temperature, not the Dubai modelled potential. It is time-specific, cloud/retrieval-limited, and does not provide land-cover intervention masks or global pedestrian routing.
- Thermal potential and all intervention reductions are modelled, not observed or validated outcomes.

## Map-layer performance & wrap fix (Oct 2026)

- **Bug (repeating overlay when zoomed out):** grid lookups used `id = r * cols + c` with no bounds check, so
  samples outside the grid wrapped onto cells from the neighbouring row and the field repeated every grid
  width. All lookups now go through `cellAt` / `getModelIndex` / `buildDenseField` in `src/lib/heat/heatModel.ts`
  (bounds-checked; outside the grid means "no data"). The same wrap existed in the scenario spill-over loop.
- **Bug (slow / janky zoom-out):** the old layer re-sampled every screen pixel and re-traced contours on every
  `moveend`/`zoomend`, and `HeatMap` re-rendered (and rebuilt the field) on every `move` event.
  `ThermalFieldLayer` now rasterises the field once per (model, values, palette) into a canvas shown through a
  Leaflet overlay (panned/zoomed by CSS transforms), and draws contours as vector polylines hidden below zoom 9.
  Field maps are memoised per (model, hour); the cursor readout writes to the DOM directly instead of React state.
- All three maps use `noWrap` tiles and `maxBounds` (`mapBoundsFor`) so the base map cannot show world copies.
- Simulator sliders use `useDeferredValue` so dragging stays responsive.
