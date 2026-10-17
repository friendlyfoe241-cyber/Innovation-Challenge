/** Shared contracts for THERMO's one Dubai spatial model. */
export type DataProvenance = 'OBSERVED' | 'DERIVED' | 'SIMULATED';

export interface LonLat {
  lon: number;
  lat: number;
}

export type LandCover = 'water' | 'vegetation' | 'building' | 'road' | 'runway' | 'bare' | 'mixed';

/**
 * A supported 750 m analysis cell. Fractions are derived from fixed OSM
 * geometry; they are not satellite-derived temperature observations.
 */
export interface SpatialCell extends LonLat {
  id: number;
  r: number;
  c: number;
  b: number;
  road: number;
  g: number;
  water: number;
  bare: number;
  runway: number;
  walk: number;
  cycle: number;
  poi: number;
  cover: LandCover;
}

export interface SpatialGrid {
  s: number;
  w: number;
  n: number;
  e: number;
  rows: number;
  cols: number;
  cellLat: number;
  cellLon: number;
  cellSizeM: number;
}

export interface SpatialMetadata {
  schema: string;
  generatedAt: string;
  accessDate: string;
  source: {
    osm: string;
    osmSnapshot: string;
    boundary: string;
  };
  coverage: {
    description: string;
    extent: Pick<SpatialGrid, 's' | 'w' | 'n' | 'e'>;
    requiredAreas: string[];
    sourceResolutionM: number;
    observedCells: number;
  };
  classifications: Record<string, string>;
}

export interface SearchPlace extends LonLat {
  id: string;
  name: string;
  category: 'place' | 'amenity' | 'tourism' | 'shop' | 'pin';
  area?: string;
}

export interface SpatialModel {
  metadata: SpatialMetadata;
  grid: SpatialGrid;
  cells: SpatialCell[];
  search: SearchPlace[];
}

/** Directed OSM-derived graph: m bit 1=walk, bit 2=cycle. */
export interface RoutingNode extends LonLat { id: number; }
export interface RoutingEdge {
  from: number;
  to: number;
  /** mode bit mask, 1 walking and/or 2 cycling */
  m: number;
  len: number;
  mid: [number, number];
  cls: string;
  name: string;
  /** Simplified observed OSM line geometry, ordered from `from` to `to`. */
  g: [number, number][];
}
export interface RoutingGraph {
  metadata: SpatialMetadata & { graph: string };
  nodes: RoutingNode[];
  edges: RoutingEdge[];
}

export type RouteMode = 'walk' | 'cycle';
export type RouteChoice = 'Fastest' | 'Balanced' | 'Coolest';
