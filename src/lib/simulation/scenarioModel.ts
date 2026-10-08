/**
 * THERMO Intervention Simulator model.
 *
 * All outputs are MODELLED SCENARIOS. The sensitivity coefficients
 * below are transparent prototype assumptions based on published
 * urban-heat literature (street tree shade, albedo treatments,
 * vegetation cooling). They are NOT measured post-intervention
 * temperatures. Every value produced here is DERIVED from the current
 * tile state through these documented coefficients.
 */
import type { HeatTile, HeatModelConfig } from '../../types/domain';
import { heatIndexFor, surfaceTempFor, HEAT_MODEL_DEFAULTS } from '../heat/heatModel';

export interface InterventionSliders {
  /** 0..1 additional vegetation fraction applied across open ground */
  vegetation: number;
  /** 0..1 fraction of exposed footways given shade cover */
  shade: number;
  /** 0..1 fraction of hard surfaces given high-albedo treatment */
  reflective: number;
  /** 0..1 fraction of exposed pavement replaced by permeable/shaded surface */
  depave: number;
}

export const EMPTY_INTERVENTION: InterventionSliders = {
  vegetation: 0,
  shade: 0,
  reflective: 0,
  depave: 0,
};

export const MAX_SLIDER = 0.5; // UI scale cap, e.g. "up to 50%"

/** Coefficients applied to the tile model (documented prototype). */
const SENSITIVITY = {
  // per unit vegetation fraction → °C LST reduction
  vegCool: 9,
  // per unit shaded footway fraction → °C rider reduction on open ground
  shadeCool: 7,
  // per unit reflective fraction → °C reduction via higher albedo
  reflectCool: 6,
  // per unit depave → °C reduction on previously exposed ground
  depaveCool: 8,
};

/** Apply interventions to a tile, returning a modified copy. */
export function applyIntervention(tile: HeatTile, sliders: InterventionSliders): HeatTile {
  const out: HeatTile = { ...tile };
  const v = Math.min(0.5, sliders.vegetation);
  const s = Math.min(0.5, sliders.shade);
  const r = Math.min(0.5, sliders.reflective);
  const d = Math.min(0.5, sliders.depave);

  // Vegetation is added onto current open ground.
  const open = Math.max(0, 1 - tile.g - tile.b - tile.wt);
  out.g = Math.min(0.85, tile.g + v * open);

  // Shaded walkways reduce the direct-sun fraction of open ground.
  out.p = Math.min(0.92, tile.p * (1 - s * 0.6));

  // Reflectivity lifts the effective albedo so the LST model cools.
  // We encode this by nudging the albedo term through tile fields:
  // (paved surfaces become brighter → handled as a thermal offset below)
  const offset =
    s * SENSITIVITY.shadeCool * (1 - Math.min(0.7, tile.g * 1.4)) -
    r * SENSITIVITY.reflectCool * 0.9 -
    d * SENSITIVITY.depaveCool * (1 - tile.g) * 0.8 -
    v * SENSITIVITY.vegCool * open;

  (out as HeatTile & { _offset?: number })._offset = offset;
  return out;
}

/** Account for the thermal offset inside the surface-temp estimate. */
export function surfaceTempAfter(tile: HeatTile, hour: number, config: HeatModelConfig = HEAT_MODEL_DEFAULTS): number {
  const base = surfaceTempFor(tile, hour, config);
  const off = (tile as HeatTile & { _offset?: number })._offset ?? 0;
  return Math.round((base + off) * 10) / 10;
}

export function heatIndexAfter(tile: HeatTile, hour: number, config: HeatModelConfig = HEAT_MODEL_DEFAULTS): number {
  const base = heatIndexFor(tile, hour, config);
  const off = (tile as HeatTile & { _offset?: number })._offset ?? 0;
  return Math.round(Math.min(100, Math.max(0, base + off * 2.4)) * 10) / 10;
}

export interface ScenarioSummary {
  baselineIndex: number;
  scenarioIndex: number;
  improvementPct: number;
  components: {
    vegetation: number;
    shade: number;
    reflective: number;
    depave: number;
  };
}

/** Aggregate index for a set of tiles under an intervention. */
export function scenarioSummary(tiles: HeatTile[], sliders: InterventionSliders, hour: number, weights?: number[]): ScenarioSummary {
  const n = tiles.length;
  let baseSum = 0;
  let scenSum = 0;
  for (let i = 0; i < n; i++) {
    const w = weights?.[i] ?? 1;
    baseSum += heatIndexFor(tiles[i], hour) * w;
    const mod = applyIntervention(tiles[i], sliders);
    scenSum += heatIndexAfter(mod, hour) * w;
  }
  const baselineIndex = round0(baseSum / n);
  const scenarioIndex = round0(scenSum / n);
  const improvementPct =
    baselineIndex === 0 ? 0 : round0(((baselineIndex - scenarioIndex) / baselineIndex) * 100);
  return {
    baselineIndex,
    scenarioIndex,
    improvementPct,
    components: {
      vegetation: sliders.vegetation,
      shade: sliders.shade,
      reflective: sliders.reflective,
      depave: sliders.depave,
    },
  };
}

/** Per-intervention isolated impact (each at 100% of the UI cap). */
export function isolatedImpacts(tiles: HeatTile[], hour: number): { label: string; impact: number; detail: string }[] {
  const base = scenarioSummary(tiles, EMPTY_INTERVENTION, hour);
  const cap: InterventionSliders = { vegetation: 0.35, shade: 0.35, reflective: 0.35, depave: 0.35 };
  const mk = (label: string, partial: Partial<InterventionSliders>, detail: string) => {
    const s = { ...EMPTY_INTERVENTION, ...partial };
    const sc = scenarioSummary(tiles, s, hour);
    const rel = base.baselineIndex === 0 ? 0 : round0(((base.baselineIndex - sc.scenarioIndex) / base.baselineIndex) * 100);
    return { label, impact: rel, detail };
  };
  return [
    mk('More vegetation', { vegetation: cap.vegetation }, 'Street trees & planted ground across open areas'),
    mk('Shaded walkways', { shade: cap.shade }, 'Canopies and arcades over exposed footpaths'),
    mk('Reflective surfaces', { reflective: cap.reflective }, 'High-albedo pavements and roofs'),
    mk('Less exposed pavement', { depave: cap.depave }, 'Depaving: permeable & planted surfaces'),
  ];
}

function round0(v: number): number {
  return Math.round(v * 10) / 10;
}