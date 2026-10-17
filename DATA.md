# THERMO data & spatial provenance

THERMO keeps **observed source data**, **derived spatial outputs**, and **hypothetical scenarios** separate. It does not present a modelled index as a measured temperature.

## Source data

| Source | Role | Snapshot / validity | Licence |
| --- | --- | --- | --- |
| [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), distributed in the [Geofabrik GCC states extract](https://download.geofabrik.de/asia/gcc-states.html) | Buildings, highways, mapped pedestrian/cycle access, parks/vegetation, water, runways, bare land and named places | Extract timestamp **2026-10-15T20:21:00Z** | ODbL 1.0 |
| [HDX/OCHA COD-AB UAE admin-1](https://data.humdata.org/dataset/cod-ab-are) | Dubai Emirate (`AE02`) boundary used to constrain the analysis window | v01, valid from 2023-05-15 | CC BY-IGO |
| [Valhalla route API](https://valhalla.github.io/valhalla/api/route/api-reference/) via `valhalla1.openstreetmap.de` | Live pedestrian and bicycle route geometries using an OSM routing network | Requested at route time | Provider availability is best-effort; underlying network is OSM-derived |

OpenStreetMap attribution remains visible on every map. Any redistribution of OSM-derived artefacts must respect the ODbL.

## Shared spatial model

`public/data/dubai-spatial-model.json` is the single source used by the Explorer, Simulator and route-metric sampler.

- **Coverage:** OSM-supported urban cells within the verified Dubai boundary and an explicit urban window. Areas with no source support are absent/transparent. THERMO does not stretch or extrapolate the former Downtown grid.
- **Resolution:** 750 m analysis cells. Each cell stores derived support fractions for buildings, roads, mapped vegetation, water, runways, bare land, mapped walk/cycle network and named-place density.
- **Land-cover categories:** `building=*`; `highway=*`; green `landuse`/`leisure`/`natural` tags; `natural=water`, `water=*`, basin/reservoir; `aeroway=runway|taxiway`; and mapped bare/construction classes. Mapping completeness varies.
- **Thermal field:** a unitless 0–100 **modelled thermal potential**, derived from the shared cell fractions and a transparent daylight factor. It is not air temperature, land-surface temperature, a health score, or a satellite product.
- **Continuous rendering:** the Leaflet canvas raster uses local bilinear interpolation only among supported cells. Contours at 40/55/70/82 are model bands. Interpolation improves legibility but does not create sub-cell measurements.

## Intervention simulation

All simulator results are **SIMULATED scenarios**, not measurements or forecasts.

| Intervention | Eligible source cells | Nearby effect |
| --- | --- | --- |
| Vegetation | mapped road-edge or bare-land support | Gaussian carry-over to supported non-water/non-runway cells within 1.2 km; 620 m scale; capped at 35% of direct effect |
| Walkway shade | mapped walk-network support | Same bounded carry-over rule |
| Cool surfaces | mapped building, road or bare support | Source cell only |
| Depaving | mapped road support | Source cell only |

Water and runway cells are excluded from every direct intervention and from the nearby vegetation/shade carry-over. There is no global temperature subtraction or multiplier.

## Heat-aware routing

The public Valhalla provider supports OSM pedestrian and bicycle routing but does **not** offer arbitrary THERMO thermal edge weights. THERMO therefore uses a documented alternative that affects pathfinding before the route is returned:

1. build the shared baseline field for the selected hour;
2. select bounded high-potential source cells near the origin–destination corridor;
3. sample the initial real route, then submit selected high-potential matched samples as Valhalla `exclude_locations`, which removes the corresponding OSM edges during its follow-on route search;
4. return Fastest (no exclusion), Balanced (very-high cells) and Coolest (high cells) with detour guardrails;
5. sample each real returned polyline to report modelled average/peak potential and time in high-potential areas.

This is **categorical thermal avoidance**, not a claim that the external provider performs continuous thermal-cost optimisation. Shade time is intentionally not reported because no verified shade dataset is present.

## Rebuilding the committed artefacts

Raw downloads are intentionally ignored by Git. With `osmium-tool` installed:

```sh
# Download HDX boundary + Geofabrik GCC source as documented in scripts/data/build-dubai-spatial.mjs.
osmium extract --strategy=complete_ways -b 54.70,24.60,56.30,25.55 \
  -o data/source/dubai-extent.osm.pbf data/source/gcc-states-YYYYMMDD.osm.pbf
osmium tags-filter data/source/dubai-extent.osm.pbf \
  w/highway w/building w/landuse w/leisure w/natural w/aeroway w/waterway \
  n/amenity n/shop n/tourism n/place -o data/source/dubai-thematic.osm.pbf
osmium export --geometry-types=point,linestring,polygon \
  -o data/source/dubai-thematic.geojson data/source/dubai-thematic.osm.pbf
node --max-old-space-size=8192 scripts/data/build-dubai-spatial.mjs
```

The current product has no satellite LST, air-temperature feed, local weather, sensor observations, surveyed canopy or verified shade layer. Those are future validation inputs, not silently inferred substitutes.

## Method references

- [OpenStreetMap copyright and ODbL attribution](https://www.openstreetmap.org/copyright)
- [Overpass API public-instance guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) (the older prototype used Overpass; the current reproducible snapshot is a Geofabrik extract)
- [OSM access tag semantics](https://wiki.openstreetmap.org/wiki/Key:access) and [bicycle access semantics](https://wiki.openstreetmap.org/wiki/Key:bicycle)
- [Valhalla route API: `exclude_locations` and `exclude_polygons`](https://valhalla.github.io/valhalla/api/route/api-reference/)
