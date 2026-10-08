/**
 * District-level statistics: aggregate the tile grid into area
 * summaries used by the explorer panel and school/campus mode.
 * DERIVED data — all values are computed from `tiles` with the heat model.
 */
import { tiles } from '../../data/datasets';
import type { HeatTile, LonLat } from '../../types/domain';
import { airTempAtTile, bandLabel, heatBand, heatIndexFor, shadePotential, surfaceTempFor } from './heatModel';
import { distMeters } from '../geo/geo';

export interface DistrictStats {
  id: string;
  name: string;
  lon: number;
  lat: number;
  radiusM: number;
  heatIndex: number;
  surfaceTemp: number;
  airTemp: number;
  vegetation: number;
  buildingDensity: number;
  shadePotential: number;
  band: number;
  bandName: string;
  intervention: string;
  why: string[];
}

export interface DistrictDef {
  id: string;
  name: string;
  lon: number;
  lat: number;
  radiusM: number;
}

export const DISTRICT_DEFAULTS: DistrictDef[] = [
  { id: 'downtown', name: 'Downtown Dubai', lon: 55.2765, lat: 25.1965, radiusM: 700 },
  { id: 'difc', name: 'DIFC', lon: 55.2653, lat: 25.2087, radiusM: 550 },
  { id: 'business-bay', name: 'Business Bay', lon: 55.286, lat: 25.201, radiusM: 800 },
  { id: 'zabeel', name: 'Zabeel', lon: 55.2959, lat: 25.2352, radiusM: 750 },
  { id: 'wellington', name: 'GEMS Wellington Campus', lon: 55.27148, lat: 25.21137, radiusM: 320 },
];

function pickIntervention(hi: number): string {
  if (hi >= 64) {
    return 'Prioritise street-level shade and cool surfaces where canyon geometry concentrates heat.';
  }
  if (hi >= 50) {
    return 'Prioritise shaded pedestrian infrastructure and additional vegetation for exposed routes.';
  }
  return 'Retain and extend vegetated areas; use them as a model for neighbouring blocks.';
}

function vegLine(g: number): string {
  return g > 0.18
    ? `Vegetative cover is comparatively rich (${Math.round(g * 100)}%)`
    : `Low vegetative cover (${Math.round(g * 100)}%) raises surface heating`;
}

function densityLine(b: number): string {
  return b > 0.22
    ? `Dense built-up fabric (${Math.round(b * 100)}%) traps solar heat and suppresses airflow`
    : `Built density is ${Math.round(b * 100)}% — street geometry dominates exposure`;
}

function nearestTiles(lon: number, lat: number, k: number): HeatTile[] {
  const center: LonLat = { lon, lat };
  return [...tiles.tiles]
    .sort((a, b) => distMeters(a, center) - distMeters(b, center))
    .slice(0, k);
}

function meanSurface(used: HeatTile[], hour: number): number {
  if (!used.length) return 0;
  return used.reduce((s, t) => s + surfaceTempFor(t, hour), 0) / used.length;
}

function meanShade(used: HeatTile[]): number {
  if (!used.length) return 0;
  return used.reduce((s, t) => s + shadePotential(t), 0) / used.length;
}

function roundPct(v: number): number {
  return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
}

export function districtStatsFor(defs: DistrictDef[], hour = 14): DistrictStats[] {
  return defs.map((d) => {
    const pts: LonLat = { lon: d.lon, lat: d.lat };
    const inRadius = tiles.tiles.filter((t) => distMeters(pts, t) <= d.radiusM);
    const used = inRadius.length ? inRadius : nearestTiles(d.lon, d.lat, 8);
    const hi = Math.round(used.reduce((s, t) => s + heatIndexFor(t, hour), 0) / used.length);
    const veg = used.reduce((s, t) => s + t.g, 0) / used.length;
    const dens = used.reduce((s, t) => s + t.b, 0) / used.length;
    return {
      id: d.id,
      name: d.name,
      lon: d.lon,
      lat: d.lat,
      radiusM: d.radiusM,
      heatIndex: hi,
      surfaceTemp: Math.round(meanSurface(used, hour)),
      airTemp: used.length ? airTempAtTile(used[0], hour) : airTempAtTile({ lon: 0, lat: 0, r: 0, c: 0, b: 0, p: 0, g: 0, wt: 0, pd: 0, h: 0 }, hour),
      vegetation: roundPct(veg),
      buildingDensity: roundPct(dens),
      shadePotential: Math.round(meanShade(used) * 100),
      band: heatBand(hi),
      bandName: bandLabel(heatBand(hi)),
      intervention: pickIntervention(hi),
      why: [
        `Surface temperature ≈ ${Math.round(meanSurface(used, hour))}°C at ${hour}:00 (modelled)`,
        vegLine(veg),
        densityLine(dens),
      ],
    };
  });
}