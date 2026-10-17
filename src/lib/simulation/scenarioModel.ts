/**
 * Land-cover-aware, spatially local intervention scenarios.
 *
 * These are hypothetical changes to the shared modelled potential, never a
 * temperature prediction. No operation changes water or runway cells, and no
 * slider applies a uniform blanket adjustment.
 */
import type { SpatialCell, SpatialModel } from '../../types/domain';
import { calculateBaseField, cellAt, clamp01 } from '../heat/heatModel';

export interface InterventionSliders {
  vegetation: number;
  shade: number;
  reflective: number;
  depave: number;
}
export const EMPTY_INTERVENTION: InterventionSliders = { vegetation: 0, shade: 0, reflective: 0, depave: 0 };
export const MAX_SLIDER = 0.5;

export interface InterventionMask {
  vegetation: number;
  shade: number;
  reflective: number;
  depave: number;
}
export interface ScenarioField {
  baseline: Map<number, number>;
  scenario: Map<number, number>;
  difference: Map<number, number>;
  masks: Map<number, InterventionMask>;
}

function ineligible(cell: SpatialCell) { return cell.water >= 0.12 || cell.runway >= 0.04; }

/** Masks use observed/mapped cover only; they are zero for unsupported uses. */
export function interventionMask(cell: SpatialCell): InterventionMask {
  if (ineligible(cell)) return { vegetation: 0, shade: 0, reflective: 0, depave: 0 };
  return {
    // Street planting / bare-land planting only — never direct water/runway cooling.
    vegetation: clamp01((cell.road * 0.74 + cell.bare * 0.9) * (1 - cell.b * 0.22)),
    // Shade is limited to cells with mapped walkable network support.
    shade: clamp01(cell.walk * (1 - cell.g * 0.35)),
    // Reflective treatment only applies to mapped hard surfaces.
    reflective: clamp01(cell.b * 0.78 + cell.road * 0.72 + cell.bare * 0.35),
    // Depaving applies to road/paved support, never runways.
    depave: clamp01(cell.road * (1 - cell.b * 0.3)),
  };
}

/**
 * Nearby cooling rule: vegetation and walkway shade may influence supported
 * neighbouring non-water/non-runway cells within 1.2 km. The influence is
 * Gaussian in grid distance and capped at 35% of the source-local effect.
 */
export function buildScenarioField(model: SpatialModel, hour: number, sliders: InterventionSliders): ScenarioField {
  const baseline = calculateBaseField(model, hour);
  const scenario = new Map(baseline);
  const difference = new Map<number, number>();
  const masks = new Map<number, InterventionMask>();
  const localCooling = new Map<number, number>();
  const carryCooling = new Map<number, number>();
  const s = {
    vegetation: Math.min(MAX_SLIDER, sliders.vegetation), shade: Math.min(MAX_SLIDER, sliders.shade),
    reflective: Math.min(MAX_SLIDER, sliders.reflective), depave: Math.min(MAX_SLIDER, sliders.depave),
  };

  for (const cell of model.cells) {
    const mask = interventionMask(cell); masks.set(cell.id, mask);
    const vegetation = 18 * s.vegetation * mask.vegetation;
    const shade = 15 * s.shade * mask.shade;
    const reflective = 8 * s.reflective * mask.reflective;
    const depave = 12 * s.depave * mask.depave;
    const direct = vegetation + shade + reflective + depave;
    localCooling.set(cell.id, direct);
    // Only greenery and shade get a local-area spill-over; hard-surface
    // treatment remains on the eligible source surface.
    const spill = vegetation + shade;
    if (spill <= 0.001) continue;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (!dr && !dc) continue;
        const distance = Math.hypot(dr, dc) * model.grid.cellSizeM;
        if (distance > 1200) continue;
        const neighbour = cellAt(model, cell.r + dr, cell.c + dc);
        if (!neighbour || ineligible(neighbour)) continue;
        const weight = 0.35 * Math.exp(-0.5 * (distance / 620) ** 2);
        carryCooling.set(neighbour.id, (carryCooling.get(neighbour.id) ?? 0) + spill * weight);
      }
    }
  }

  for (const cell of model.cells) {
    const cool = (localCooling.get(cell.id) ?? 0) + (carryCooling.get(cell.id) ?? 0);
    const base = baseline.get(cell.id) ?? 0;
    const next = Math.max(0, base - cool);
    scenario.set(cell.id, next);
    difference.set(cell.id, Math.round((next - base) * 10) / 10);
  }
  return { baseline, scenario, difference, masks };
}

export function scenarioSummary(field: ScenarioField) {
  const values = [...field.baseline.keys()];
  const base = values.reduce((sum, id) => sum + (field.baseline.get(id) ?? 0), 0) / Math.max(1, values.length);
  const scenario = values.reduce((sum, id) => sum + (field.scenario.get(id) ?? 0), 0) / Math.max(1, values.length);
  return { baseline: Math.round(base * 10) / 10, scenario: Math.round(scenario * 10) / 10, reduction: Math.round((base - scenario) * 10) / 10, improvementPct: base ? Math.round(((base - scenario) / base) * 1000) / 10 : 0 };
}
