# THERMO data & spatial provenance

THERMO keeps **observed source data**, **derived spatial outputs**, and **hypothetical scenarios** separate. It does not present a modelled index as a measured temperature.

## Source data

| Source | Role | Snapshot / validity | Licence |
| --- | --- | --- | --- |
| [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), distributed in the [Geofabrik GCC states extract](https://download.geofabrik.de/asia/gcc-states.html) | Buildings, highways, mapped pedestrian/cycle access, parks/vegetation, water, runways, bare land and named places | Extract timestamp **2026-10-15T20:21:00Z** | ODbL 1.0 |
| [HDX/OCHA COD-AB UAE admin-1](https://data.humdata.org/dataset/cod-ab-are) | Dubai Emirate (`AE02`) boundary used to constrain the analysis window | v01, valid from 2023-05-15 | CC BY-IGO |
| [Valhalla route API](https://valhalla.github.io/valhalla/api/route/api-reference/) via `valhalla1.openstreetmap.de` | Live pedestrian and bicycle route geometries using an OSM routing network | Requested at route time | Provider availability is best-effort; underlying network is OSM-derived |
| [NASA MODIS Land Surface Temperature and Emissivity](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php) via [NASA Earthdata GIBS](https://earthdata.nasa.gov/) | Global viewport-loaded satellite land-surface-temperature imagery. Layer `MODIS_Terra_Land_Surface_Temp_Day` (MODIS Terra daytime LST browse product). | Fixed product date `2025-01-01` in `src/data/nasaLst.ts`; ~1 km native source pixels (MOD11A1.061, 1200×1200 km SIN grid); GIBS flash raster `GoogleMapsCompatible_Level7` = 1222.99 m/px | NASA Earthdata terms / attribution; cloud and retrieval gaps apply; NOT air temperature and NOT a THERMO layer |

OpenStreetMap attribution remains visible on every map. Any redistribution of OSM-derived artefacts must respect the ODbL.

## Satellite LST layer — what the colours do (and do not) mean

The map shows global viewport context NASA GIBS tiles for the layer `MODIS_Terra_Land_Surface_Temp_Day` (title *"MODIS TERRA Daytime Land Surface Temperature"*). Verified facts:

- **Native product:** MODIS MOD11A1.061 / MOD11_L2 Terra LST, `LST_Day_1km` band, units **Kelvin** with scale factor 0.02, daily, 1 km pixels on the SIN grid, 1200×1200 km tiles, plus a `QC_Day` quality band.
- **GIBS tile matrix:** `GoogleMapsCompatible_Level7` has a pixel size of **1222.99 m/px** (from the official GIBS tiled-access table). The ~1 km native product is therefore displayed at ~1.2 km per tile pixel.
- **Configured date:** the app pins `2025-01-01`, so the tiles are a **single historical date**, not a live feed.
- **RGB colour limitation:** the rendered PNG is a browse colour-mapped image. GIBS documents that translating its RGB pixels to data values requires the specific colormap of the visual product. THERMO does **not** draw a Celsius legend and does not attempt to decode the PNG into temperatures, because there is no verified, reproducible decoding path from the current implementation. If you need numeric LST, use the numerical product (see the validation workflow below), not the PNG palette.
- **Coverage gaps:** pixels can be omitted over clouds, ocean or failed retrievals. A request that returns a fully transparent tile is expected behaviour, not a bug.
- **Scale separation:** satellite LST measures broad-area radiance of the surface. It neither equals near-surface air temperature, nor resolves shade at street level, individual canopies, building geometry/ventilation or sidewalk materials. The THERMO 0–100 index is a separate, OSM-derived *model*, and the two must never be interchanged.

## Shared spatial model

`public/data/dubai-spatial-model.json` is the single source used by the Explorer, Simulator and route-metric sampler.

The Explorer also includes a separate global context layer. `src/components/maps/GlobalThermalLayer.tsx` uses NASA GIBS WMTS tiles, so Leaflet requests only tiles intersecting the current viewport. The map can zoom and pan across the UAE or the world without a giant bundled raster. This does not expand the local THERMO model: outside supported Dubai cells, the app shows satellite land-surface-temperature context only and does not create local potential, land-cover intervention masks, shade, or routes.

- **Coverage:** OSM-supported urban cells within the verified Dubai boundary and an explicit urban window. Areas with no source support are absent/transparent. THERMO does not stretch or extrapolate the former Downtown grid.
- **Resolution:** 750 m analysis cells. Each cell stores derived support fractions for buildings, roads, mapped vegetation, water, runways, bare land, mapped walk/cycle network and named-place density.
- **Land-cover categories:** `building=*`; `highway=*`; green `landuse`/`leisure`/`natural` tags; `natural=water`, `water=*`, basin/reservoir; `aeroway=runway|taxiway`; and mapped bare/construction classes. Mapping completeness varies.
- **Thermal field:** a unitless 0–100 **modelled thermal potential**, derived from the shared cell fractions and a transparent daylight factor. It is not air temperature, land-surface temperature, a health score, or a satellite product.
- **Continuous rendering:** the Leaflet canvas raster uses local bilinear interpolation only among supported cells. Contours at 40/55/70/82 are model bands. Interpolation improves legibility but does not create sub-cell measurements.
- **Global tiles:** NASA MODIS Terra daytime LST is a separate observed satellite browse product. It is not blended into the 0–100 modelled field, not used by the simulator, and not used as a route edge cost. It may contain clouds, missing retrievals, and date-specific conditions.

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

## Numerical satellite-validation workflow (offline)

The GIBS browse tiles are imagery only. To compare THERMO's modelled spatial pattern against *numerical* MODIS LST observations, the repository provides a separate offline workflow that requires no API key at deploy time and never runs in the browser.

- `scripts/data/fetch-modis-lst.sh` — documented, authenticated retrieval of **MOD11A1.061** HDF files for the Dubai SIN tile (`h23v06`). Requires a free NASA Earthdata Login bearer token in `$EARTHDATA_TOKEN`; without a token the script refuses and prints the exact sign-up/procedure instead of inventing data. Alternative manual path: NASA **AppEEARS** (free login) can produce CSV/GeoTIFF point or pixel exports of `LST_Day_1km` and `QC_Day`.
- `scripts/data/validate-modis-lst.mjs` — the actual comparison. It:
  1. loads the committed THERMO spatial model and the numerical LST CSV (`lon,lat,lst_k,qc[,date]`);
  2. applies the documented MOD11 `QC_Day` **mandatory-quality** filter (bits 0–1);
  3. maps each supported THERMO 750 m cell to valid LST samples within **1 km**, using the mean of valid pixels (never invented values);
  4. computes **rank-based** spatial comparisons only: Spearman rank correlation between cell potential and LST, mean LST per thermal band, and LST quartiles;
  5. writes `public/data/modis-lst-validation.json` with full provenance, and refuses to produce a report when too few valid samples exist.

The output explicitly states that Spearman agreement describes **spatial-pattern agreement**, that it does not validate the index as a temperature/health metric, and that no °C↔index conversion exists. **Status: workflow prepared and mechanism-tested with synthetic data; no real validation result is claimed** until an Earthdata-token holder supplies real numerical LST.

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

The current product has no numerically ingested satellite LST (only the GIBS browse imagery shown for context), no air-temperature feed, no local weather, no sensor observations, no surveyed canopy and no verified shade layer. Those are future validation inputs, not silently inferred substitutes.

## Method references

- [OpenStreetMap copyright and ODbL attribution](https://www.openstreetmap.org/copyright)
- [Overpass API public-instance guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) (the older prototype used Overpass; the current reproducible snapshot is a Geofabrik extract)
- [OSM access tag semantics](https://wiki.openstreetmap.org/wiki/Key:access) and [bicycle access semantics](https://wiki.openstreetmap.org/wiki/Key:bicycle)
- [Valhalla route API: `exclude_locations` and `exclude_polygons`](https://valhalla.github.io/valhalla/api/route/api-reference/)
- [NASA MODIS MOD11 product page](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php) (LST/Emissivity daily L3 global 1 km)
- [MOD11A1.061 — MODIS/Terra LST&Emissivity Daily L3 Global 1 km SIN Grid — LAADS DAAC](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD11A1) and [NASA Earthdata catalogue entry](https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod11a1-061)
- [Collection-6 MODIS LST User Guide (LP DAAC)](https://lpdaac.usgs.gov/documents/118/MOD11_User_Guide_V6.pdf) (QC_Day bit semantics: mandatory-quality bits 0–1)
- [NASA GIBS — tiled-access resolutions and "Mapping RGB to Data Values"](https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics) and the [GIBS WMTS service](https://earthdata.nasa.gov/)
