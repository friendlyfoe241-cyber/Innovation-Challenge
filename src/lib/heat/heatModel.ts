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

/**
 * Per-model lookup from (row, col) to the index of its supported cell.
 * Built once per model. Every grid lookup goes through `cellAt`, which is
 * bounds-checked: the old `r * cols + c` id arithmetic silently wrapped
 * across row edges, so samples outside the model extent landed on cells
 * from the other side of the grid and the field appeared to repeat.
 */
export interface ModelIndex {
  rows: number;
  cols: number;
  /** r * cols + c -> index into model.cells, or -1 when unsupported. */
  cellIdx: Int32Array;
}
const modelIndexCache = new WeakMap<SpatialModel, ModelIndex>();
export function getModelIndex(model: SpatialModel): ModelIndex {
  let index = modelIndexCache.get(model);
  if (index) return index;
  const { rows, cols } = model.grid;
  const cellIdx = new Int32Array(rows * cols).fill(-1);
  model.cells.forEach((cell, i) => {
    if (cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols) cellIdx[cell.r * cols + cell.c] = i;
  });
  index = { rows, cols, cellIdx };
  modelIndexCache.set(model, index);
  return index;
}

/** Bounds-checked cell lookup (undefined outside the grid or when unsupported). */
export function cellAt(model: SpatialModel, r: number, c: number): SpatialCell | undefined {
  const { rows, cols, cellIdx } = getModelIndex(model);
  if (r < 0 || c < 0 || r >= rows || c >= cols) return undefined;
  const i = cellIdx[r * cols + c];
  return i < 0 ? undefined : model.cells[i];
}

const baseFieldCache = new WeakMap<SpatialModel, Map<number, Map<number, number>>>();
/** Baseline field for one hour. Memoised per model+hour so identity is stable between renders. */
export function calculateBaseField(model: SpatialModel, hour: number) {
  let byHour = baseFieldCache.get(model);
  if (!byHour) { byHour = new Map(); baseFieldCache.set(model, byHour); }
  const cached = byHour.get(hour);
  if (cached) return cached;
  const values = new Map<number, number>();
  for (const cell of model.cells) values.set(cell.id, thermalPotentialForCell(cell, hour));
  byHour.set(hour, values);
  return values;
}

export interface FieldSample { value: number; cell: SpatialCell; interpolated: boolean; }

/** Dense row-major copy of a field: NaN where a cell is unsupported. */
export interface DenseField { rows: number; cols: number; val: Float32Array; }
const denseCache = new WeakMap<Map<number, number>, DenseField>();
export function buildDenseField(model: SpatialModel, values: Map<number, number>): DenseField {
  const cached = denseCache.get(values);
  if (cached) return cached;
  const { rows, cols } = model.grid;
  const val = new Float32Array(rows * cols).fill(NaN);
  for (const cell of model.cells) {
    const v = values.get(cell.id);
    if (v !== undefined && cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols) val[cell.r * cols + cell.c] = v;
  }
  const dense = { rows, cols, val };
  denseCache.set(values, dense);
  return dense;
}

/**
 * Bilinear display/routing sampler constrained to supported cells. It never
 * fills an unsupported area; if interpolation has too little local support it
 * returns the nearest source cell only inside one source-cell radius. Points
 * outside the model grid always return null.
 */
export function createFieldSampler(model: SpatialModel, values: Map<number, number>) {
  const { grid } = model;
  const { rows, cols } = grid;
  const dense = buildDenseField(model, values);
  const { cellIdx } = getModelIndex(model);
  const { val } = dense;
  const lonMeters = 111_320 * Math.cos(((grid.s + grid.n) / 2) * Math.PI / 180);
  return (lon: number, lat: number): FieldSample | null => {
    const x = (lon - grid.w) / grid.cellLon - 0.5;
    const y = (lat - grid.s) / grid.cellLat - 0.5;
    // Outside the grid (beyond half a cell of the outer cell centres): no data.
    if (x < -1 || y < -1 || x > cols || y > rows) return null;
    const c0 = Math.floor(x); const r0 = Math.floor(y); const fx = x - c0; const fy = y - r0;
    let weighted = 0; let support = 0; let nearestIdx = -1; let nearestD = Infinity;
    for (let k = 0; k < 4; k++) {
      const r = r0 + (k >> 1); const c = c0 + (k & 1);
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      const v = val[r * cols + c];
      if (Number.isNaN(v)) continue;
      const weight = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy);
      weighted += v * weight; support += weight;
      const cell = model.cells[cellIdx[r * cols + c]];
      const d = Math.hypot((cell.lon - lon) * lonMeters, (cell.lat - lat) * 110_540);
      if (d < nearestD) { nearestD = d; nearestIdx = cellIdx[r * cols + c]; }
    }
    if (nearestIdx < 0) return null;
    const nearest = model.cells[nearestIdx];
    if (support >= 0.52) return { value: weighted / support, cell: nearest, interpolated: true };
    if (nearestD <= grid.cellSizeM * 0.82) return { value: values.get(nearest.id)!, cell: nearest, interpolated: false };
    return null;
  };
}

export function cellById(model: SpatialModel) { return new Map(model.cells.map((c) => [c.id, c])); }
