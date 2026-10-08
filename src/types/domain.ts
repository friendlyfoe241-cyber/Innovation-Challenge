/** Shared domain types for THERMO. */

export type DataProvenance = 'OBSERVED' | 'DERIVED' | 'SIMULATED';

/** A location in decimal degrees. */
export interface LonLat {
  lon: number;
  lat: number;
}

/** A single cell of the derived heat grid (tiles.json). */
export interface HeatTile extends LonLat {
  r: number;
  c: number;
  /** building footprint fraction 0..1 */
  b: number;
  /** paved/road proximity proxy 0..1 */
  p: number;
  /** vegetation fraction 0..1 */
  g: number;
  /** water fraction 0..1 */
  wt: number;
  /** point-of-interest density 0..1 */
  pd: number;
  /** mean building height (m) */
  h: number;
}

export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'living_street'
  | 'pedestrian'
  | 'service'
  | 'footway'
  | 'path'
  | 'cycleway'
  | 'steps'
  | 'track'
  | 'other';

export interface LineFeature {
  g: [number, number][];
  cls: string;
  name?: string;
}

export interface BuildingFeature {
  g: [number, number][];
  h: number;
}

export interface HeatGrid {
  tiles: HeatTile[];
}

export interface LayerBundle {
  tiles: HeatTile[];
  buildings: BuildingFeature[];
  roads: LineFeature[];
  paths: LineFeature[];
  green: LineFeature[];
  water: LineFeature[];
  pois: [number, number, string, string][];
  schools: SchoolLocation[];
}

export interface SchoolLocation extends LonLat {
  name: string;
  type: string;
}

export interface GraphNode {
  id: number;
  lon: number;
  lat: number;
}

export interface GraphEdge {
  a: number;
  b: number;
  cls: string;
  speed: number;
  len: number;
  mid: [number, number];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type TimeOfDay = 8 | 10 | 12 | 14 | 15 | 17 | 18 | 20 | 21;

export interface HeatModelConfig {
  tempBase: number;
  tempAmp: number;
  albedoAsphalt: number;
  albedoConcrete: number;
  albedoVegetation: number;
  albedoWater: number;
  diurnalOffsetHours: number;
  coolingFromGreen: number;
  coolingFromWater: number;
  urbanHeatBonusMax: number;
  heatIndexWeights: {
    temperature: number;
    surfaceAlt: number;
    vegetationAbs: number;
    buildingDensity: number;
    timeOfDay: number;
  };
}

export interface HeatIndexConfig {
  /** Reserved — documented in the methodology page. */
}

export interface TileExposure {
  /** model LST estimate, °C */
  surfaceTemp: number;
  /** model air-temperature estimate, °C */
  airTemp: number;
  /** altitude-adjusted alternatives */
  refSurfaceTemp: number;
  /** Heat Exposure Index 0..100 */
  heatIndex: number;
  shadePotential: number;
}

export type HeatBand = 0 | 1 | 2 | 3 | 4;