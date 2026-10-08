/**
 * THERMO Heat Model
 * ------------------------------------------------------------------
 * This module derives heat-exposure estimates from observed urban
 * geometry (OpenStreetMap) plus a documented diurnal temperature model.
 *
 * PROVENANCE
 *   OBSERVED   → OSM building footprints, roads, green space, water,
 *                POIs, school locations (© OpenStreetMap contributors, ODbL)
 *   DERIVED    → tile statistics (b, p, g, wt, pd, h in tiles.json)
 *                computed by scripts/data/process.mjs
 *   SIMULATED  → the diurnal temperature curve and all heat-index
 *                weights are analytic prototype assumptions, not
 *                calibrated measurements. Surface and air temperatures
 *                are MODELLED estimates, not observations.
 *
 * When real satellite LST data is integrated, the estimate below will
 * be replaced by an OBSERVED field while this model becomes the
 * fallback/downscaling layer.
 *
 * The Heat Exposure Index is a prototype analytical index — it is not
 * a medically validated heat-risk system.
 */
import type { HeatModelConfig, HeatTile } from '../../types/domain';
import { METER_PER_DEG_LAT, METER_PER_DEG_LON } from '../geo/geo';

export const DIURNAL_TIMES = [8, 10, 12, 14, 15, 17, 18, 20, 21] as const;
export const DEFAULT_HOUR = 14 as const;

export const HEAT_MODEL_DEFAULTS: HeatModelConfig = {
  tempBase: 38.4, // midday normative peak, °C
  tempAmp: 6.6, // diurnal amplitude, °C
  albedoAsphalt: 0.08,
  albedoConcrete: 0.28,
  albedoVegetation: 0.23,
  albedoWater: 0.1,
  diurnalOffsetHours: 2.3, // thermal lag: peak air T ~ 15:30
  coolingFromGreen: 7, // max °C-LST reduction at full vegetation
  coolingFromWater: 3.5,
  urbanHeatBonusMax: 2.8, // max °C-LST elevation at full building cover
  heatIndexWeights: {
    temperature: 0.5,
    surfaceAlt: 0.08,
    vegetationAbs: 0.17,
    buildingDensity: 0.14,
    timeOfDay: 0.11,
  },
};

/** Diurnal temperature factor 0..1 (1 at thermal peak ≈ 15:30). */
export function timeFactor(hour: number, offset = HEAT_MODEL_DEFAULTS.diurnalOffsetHours): number {
  const t = hour + offset;
  const mid = 15.5;
  return 0.32 + 0.68 * Math.max(0, (Math.cos(((t - mid) / 12) * Math.PI) + 1) / 2);
}

/** Normative air-temperature estimate from the diurnal model. */
export function airTempAt(hour: number, config: HeatModelConfig = HEAT_MODEL_DEFAULTS): number {
  const f = timeFactor(hour, config.diurnalOffsetHours);
  return round1(config.tempBase - (1 - f) * config.tempAmp);
}

/** Time-of-day factor contributing to the heat-index (0..1). */
export function timeStressFactor(hour: number): number {
  const f = timeFactor(hour);
  return Math.round((0.05 + 0.95 * f) * 100) / 100;
}

/**
 * Estimate land-surface temperature for one tile.
 * Decomposed surface albedo → net solar absorption → LST offset.
 */
export function surfaceTempFor(
  tile: HeatTile,
  hour: number,
  config: HeatModelConfig = HEAT_MODEL_DEFAULTS,
): number {
  const greenFrac = clamp01(tile.g);
  const bare = clamp01(1 - (tile.b + greenFrac + tile.wt));
  const albedo =
    greenFrac * config.albedoVegetation +
    tile.wt * config.albedoWater +
    tile.b * 0.5 * config.albedoConcrete +
    bare * config.albedoAsphalt;

  const absorption = (1 - albedo) * 1.15; // solar-power proxy
  const air = airTempAt(hour, config);
  const lag = 1.6; // h, surfaces lag air re-radiation
  const solarCycle = 0.26 + 0.74 * timeFactor(hour, 1.9);

  // LST reference at 75% absorption; scale absorption around it.
  const base = air + 3.2;
  const absorbedLift = (absorption - 0.75) * 10.5;
  const greenCool = greenFrac * config.coolingFromGreen;
  const waterCool = tile.wt * config.coolingFromWater;
  const uhb = tile.b * config.urbanHeatBonusMax * (0.55 + 0.45 * tile.p);
  const noonBias = solarCycle * 1.5 - lag;

  return round1(base + absorbedLift - greenCool - waterCool + uhb + noonBias);
}

/**
 * Reference stance-height air temperature at the tile, accounting for
 * tree shade and the local canyon effect. Air temperature difference
 * between surface and shade is greater over exposed pavement.
 */
export function airTempAtTile(
  tile: HeatTile,
  hour: number,
  config: HeatModelConfig = HEAT_MODEL_DEFAULTS,
): number {
  const air = airTempAt(hour, config);
  const exposed = Math.max(0, 1 - tile.g * 0.8 - tile.b * 0.45 - tile.wt * 0.5);
  const lift = exposed * (3.6 * timeFactor(hour, 1.6));
  const canyon = tile.b * tile.p * 0.6;
  return round1(air + lift - canyon);
}

/** Reference LST (used for the "no building/no water" baseline label). */
export function referenceSurfaceTemp(
  tile: HeatTile,
  hour: number,
  config: HeatModelConfig = HEAT_MODEL_DEFAULTS,
): number {
  const bare: HeatTile = { ...tile, b: 0, g: 0, wt: 0, p: 1 };
  return surfaceTempFor(bare, hour, config);
}

/**
 * THERMO Heat Exposure Index (0..100).
 * Prototype analytical index — documented weighting, not validated risk.
 */
export function heatIndexFor(
  tile: HeatTile,
  hour: number,
  config: HeatModelConfig = HEAT_MODEL_DEFAULTS,
): number {
  const w = config.heatIndexWeights;

  const t = surfaceTempFor(tile, hour, config);
  const tScore = clamp01((t - 30) / 18); // 30°C → 0, 48°C → 1

  const ref = referenceSurfaceTemp(tile, hour, config);
  const sAlt = clamp01((t - ref) / 10 + 0.5); // deviation & absolute

  const vegScore = clamp01(greenPenalty(tile.g));

  const density = clamp01(tile.b * 1.15 + tile.p * 0.5);

  const timeScore = timeStressFactor(hour);

  const raw =
    w.temperature * tScore +
    w.surfaceAlt * sAlt +
    w.vegetationAbs * vegScore +
    w.buildingDensity * density +
    w.timeOfDay * timeScore;

  return clamp01(Math.max(0, raw + w.surfaceAlt * 0.1)) * 100;
}

export function greenPenalty(g: number): number {
  // 0 at ~40%+ vegetation, 1 at bare/asphalt
  return 1 - clamp01((g - 0.02) / 0.38);
}

export function shadePotential(tile: HeatTile): number {
  // Depends on wall geometry + natural cover: buildings block sun when
  // tall enough; vegetation provides diffuse shade.
  return clamp01(tile.h / 60 * 0.55 + Math.min(0.7, tile.b * 0.7 + tile.h / 90));
}

/** Heat band for non-colour encoding (0 low … 4 extreme). */
export function heatBand(index: number): 0 | 1 | 2 | 3 | 4 {
  if (index >= 82) return 4;
  if (index >= 68) return 3;
  if (index >= 52) return 2;
  if (index >= 36) return 1;
  return 0;
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Score label used across the UI. */
export function bandLabel(band: number): string {
  return ['Low', 'Moderate', 'Elevated', 'High', 'Extreme'][band] ?? 'Low';
}

export function bandColor(band: number): string {
  return ['#3f7d78', '#8a9a5b', '#d9a94e', '#d9771f', '#b4521c'][band] ?? '#d9a94e';
}

/**
 * Thin nearest-tile lookup over the heat grid. Builds once per grid and
 * answers "which tile is nearest to (lon,lat)" in O(1) via a coarse
 * bucket index. Used by routing to estimate edge-level exposure.
 */
export function createTileLookup(grid: Pick<HeatTile, 'lon' | 'lat'>[]) {
  const BUCKETS = 64;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const t of grid) {
    if (t.lon < minLon) minLon = t.lon;
    if (t.lon > maxLon) maxLon = t.lon;
    if (t.lat < minLat) minLat = t.lat;
    if (t.lat > maxLat) maxLat = t.lat;
  }
  const spanLon = maxLon - minLon || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  const buckets: HeatTile[][] = Array.from({ length: BUCKETS * BUCKETS }, () => []);
  for (const t of grid) {
    const bx = Math.min(BUCKETS - 1, Math.floor(((t.lon - minLon) / spanLon) * BUCKETS));
    const by = Math.min(BUCKETS - 1, Math.floor(((t.lat - minLat) / spanLat) * BUCKETS));
    buckets[by * BUCKETS + bx].push(t as HeatTile);
  }
  return function nearest(lon: number, lat: number): HeatTile | null {
    const bx = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((lon - minLon) / spanLon) * BUCKETS)));
    const by = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((lat - minLat) / spanLat) * BUCKETS)));
    let best: HeatTile | null = null;
    let bestD = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cxx = bx + dx;
        const cyy = by + dy;
        if (cxx < 0 || cyy < 0 || cxx >= BUCKETS || cyy >= BUCKETS) continue;
        for (const t of buckets[cyy * BUCKETS + cxx]) {
          const d = Math.hypot((t.lon - lon) * METER_PER_DEG_LON, (t.lat - lat) * METER_PER_DEG_LAT);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
      }
    }
    return best;
  };
}