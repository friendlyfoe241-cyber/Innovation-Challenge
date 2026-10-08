# THERMO data & asset provenance

This project deliberately separates **observed**, **derived** and **simulated** values.

## Observed (public source data)

All geometry is from [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL 1.0),
retrieved via the Overpass API on **2026-10-08** for the corridor
`25.155–25.285 N, 55.225–55.335 E` (Dubai — Downtown, Business Bay, DIFC, Zabeel, Al Safa).

| Dataset | File (data/raw) | Elements |
| ------- | --------------- | -------: |
| Building footprints | buildings.json / buildings2.json | 49 156 |
| Roads (excluding paths) | roads.json | 12 971 |
| Pedestrian & cycle paths | paths.json | 9 808 |
| Green space (parks, grass, trees) | green.json | 1 941 |
| Water (lakes, canals, pools) | water.json | 282 |
| Points of interest | pois.json | 8 531 |
| Schools / kindergartens / universities | schools.json | 62 |

Retrieval script: `scripts/data/fetch-overpass.mjs` (endpoints, queries, retries).

## Derived (computed from observed data)

| Dataset | File (src/data/dubai) | Produced by |
| ------- | --------------------- | ----------- |
| ~250 m urban-geometry grid | tiles.json | `scripts/data/process.mjs` `buildGrid()` |
| Simplified map layers (demo zone) | layers.json | `buildLayers()` |
| Walkable routing graph | graph.json | `buildGraph()` |

Formulas for every derived value are documented inline in the scripts and in
`src/lib/heat/heatModel.ts`, `src/lib/routing/routeEngine.ts` and
`src/lib/simulation/scenarioModel.ts`.

## Simulated (prototype demonstration)

The following are **not** measurements:

- the diurnal temperature curve and all surface/air temperature values;
- the THERMO Heat Exposure Index;
- route heat-exposure scores;
- intervention impact coefficients;
- "school mode" priorities (those are derived from the simulated heat index).

All temperatures and heat indices are **modelled estimates** produced by THERMO's
analytic pipeline from the OSM geometry above. They are clearly labelled **Simulation** /
**Modelled scenario** wherever they appear in the UI.

## Assets

- favicon / brand mark: original vector, site `public/mark.svg` (no external assets).
- Map raster tiles: OpenStreetMap standard tiles, subset displayed client-side.
  See [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Fonts: bundled locally via `@fontsource` (Manrope & Geist), no network at runtime.

## Not used (documented for the roadmap)

Leaf-area index, emissivity-corrected satellite LST, ground sensors, weather-station
observations and official municipal datasets are **not yet integrated**. Their planned
sources are listed on the About → Data sources page.