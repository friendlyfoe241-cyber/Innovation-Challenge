/**
 * Shared thermal-potential field.
 *
 * It is deliberately a dimensionless 0–100 modelled exposure potential, not
 * a temperature or a health-risk score. OSM land cover drives the spatial
 * pattern; a transparent daylight factor only changes its relative intensity.
 */
import type { SpatialCell, SpatialModel } from '../../types/domain';

export const DIURNAL_TIMES = [8, 10, 12, 14, 15, 17, 18, 20, 21] as const;
export const HIGH_HEAT_THRESHOLD = 75;

export const HEAT_MODEL_DEFAULTS = {
  sourceResolutionM: 750,
  description: 'Modelled thermal exposure potential from OSM-derived land-cover fractions and a transparent daylight multiplier. No observed temperature is used.',
};

export function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** 0.22–1 solar loading proxy, peaking at 15:00; intentionally unitless. */
export function daylightFactor(hour: number) {
  const phase = Math.cos(((hour - 15) / 12) * Math.PI);
  return 0.22 + 0.78 * Math.max(0, (phase + 1) / 2);
}

/**
 * Thermal potential, derived rather than measured. Water and mapped greenery
 * lower only their own cells here; scenario spill-over is handled separately.
 */
export function thermalPotentialForCell(cell: SpatialCell, hour: number) {
  const solar = daylightFactor(hour);
  const impervious = clamp01(cell.b * 1.15 + cell.road * 0.82 + cell.bare * 0.48 + cell.runway * 0.9);
  const cooling = clamp01(cell.g * 0.86 + cell.water * 1.05);
  const form = clamp01(cell.b * 0.75 + cell.road * 0.28);
  const activity = clamp01(cell.poi / 24);
  return Math.round(clamp(16 + 30 * solar + 25 * impervious + 11 * form + 4 * activity - 22 * cooling, 0, 100) * 10) / 10;
}

export function heatBand(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value >= 82) return 4;
  if (value >= 70) return 3;
  if (value >= 55) return 2;
  if (value >= 40) return 1;
  return 0;
}
export function bandLabel(band: number) { return ['Low', 'Moderate', 'Elevated', 'High', 'Very high'][band] ?? 'Unknown'; }
export function bandColor(band: number) { return ['#3f7d78', '#8a9a5b', '#d9a94e', '#d9771f', '#b4521c'][band] ?? '#d9a94e'; }

export function thermalColor(value: number, alpha = 1) {
  const stops = [
    [48, 125, 120], [112, 151, 95], [217, 169, 78], [217, 119, 31], [180, 82, 28],
  ];
  const t = clamp(value / 100, 0, 0.9999) * (stops.length - 1);
  const i = Math.floor(t); const mix = t - i; const a = stops[i]; const b = stops[i + 1];
  const rgb = a.map((x, j) => Math.round(x + (b[j] - x) * mix));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

export function differenceColor(value: number, alpha = 1) {
  const t = clamp(value / 18, -1, 1);
  const cold = [42, 122, 143]; const mid = [242, 238, 223]; const hot = [189, 78, 44];
  const from = t < 0 ? cold : mid; const to = t < 0 ? mid : hot; const f = Math.abs(t);
  const rgb = from.map((x, i) => Math.round(x + (to[i] - x) * f));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

export function calculateBaseField(model: SpatialModel, hour: number) {
  const values = new Map<number, number>();
  for (const cell of model.cells) values.set(cell.id, thermalPotentialForCell(cell, hour));
  return values;
}

export interface FieldSample { value: number; cell: SpatialCell; interpolated: boolean; }

/**
 * Bilinear display/routing sampler constrained to supported cells. It never
 * fills an unsupported area; if interpolation has too little local support it
 * returns the nearest source cell only inside one source-cell radius.
 */
export function createFieldSampler(model: SpatialModel, values: Map<number, number>) {
  const byId = new Map(model.cells.map((cell) => [cell.id, cell]));
  const { grid } = model;
  const get = (r: number, c: number) => byId.get(r * grid.cols + c);
  return (lon: number, lat: number): FieldSample | null => {
    const x = (lon - grid.w) / grid.cellLon - 0.5;
    const y = (lat - grid.s) / grid.cellLat - 0.5;
    const c0 = Math.floor(x); const r0 = Math.floor(y); const fx = x - c0; const fy = y - r0;
    const corners = [
      [r0, c0, (1 - fx) * (1 - fy)], [r0, c0 + 1, fx * (1 - fy)],
      [r0 + 1, c0, (1 - fx) * fy], [r0 + 1, c0 + 1, fx * fy],
    ] as const;
    let weighted = 0; let support = 0; let nearest: SpatialCell | null = null; let nearestD = Infinity;
    for (const [r, c, weight] of corners) {
      const cell = get(r, c);
      if (!cell) continue;
      const value = values.get(cell.id);
      if (value === undefined) continue;
      weighted += value * weight; support += weight;
      const d = Math.hypot((cell.lon - lon) * 100_800, (cell.lat - lat) * 110_540);
      if (d < nearestD) { nearestD = d; nearest = cell; }
    }
    if (support >= 0.52 && nearest) return { value: weighted / support, cell: nearest, interpolated: true };
    if (nearest && nearestD <= grid.cellSizeM * 0.82) return { value: values.get(nearest.id)!, cell: nearest, interpolated: false };
    return null;
  };
}

export function cellById(model: SpatialModel) { return new Map(model.cells.map((c) => [c.id, c])); }
