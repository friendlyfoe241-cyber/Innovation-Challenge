/**
 * THERMO data catalog.
 *
 * Imports the bundled datasets and exposes their provenance so the UI
 * can always show where every number comes from.
 *
 * Three categories are acknowledged everywhere:
 *   OBSERVED   – obtained from a documented public source (OSM/Overpass)
 *   DERIVED    – computed from observed data with documented formulas
 *   SIMULATED  – generated purely to demonstrate capabilities
 */
import type { Graph, HeatGrid, LayerBundle } from '../types/domain';
import tilesRaw from './dubai/tiles.json';
import layersRaw from './dubai/layers.json';
import graphRaw from './dubai/graph.json';

export const tiles = tilesRaw as HeatGrid;
export const layers = layersRaw as unknown as LayerBundle;
export const graph = graphRaw as unknown as Graph;

export interface DatasetMeta {
  id: string;
  name: string;
  source: string;
  category: 'OBSERVED' | 'DERIVED';
  resolution: string;
  accessDate: string;
  license: string;
  url: string;
  description: string;
}

/**
 * Metadata for the currently bundled demonstration datasets.
 * The full source list and retrieval scripts live in
 * scripts/data — see README / the About page.
 */
export const DATASETS: DatasetMeta[] = [
  {
    id: 'osm-buildings',
    name: 'OpenStreetMap building footprints',
    source: 'OpenStreetMap contributors (Overpass API)',
    category: 'OBSERVED',
    resolution: '~m-level footprint geometry',
    accessDate: '2026-10-08',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'Building footprint polygons within the Dubai demo corridor (approx. 44 km²).',
  },
  {
    id: 'osm-roads',
    name: 'OpenStreetMap road & path network',
    source: 'OpenStreetMap contributors (Overpass API)',
    category: 'OBSERVED',
    resolution: '~m-level line geometry',
    accessDate: '2026-10-08',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'Highways, pedestrian paths, cycleways and service streets used for the route graph.',
  },
  {
    id: 'osm-green',
    name: 'OpenStreetMap green space & vegetation',
    source: 'OpenStreetMap contributors (Overpass API)',
    category: 'OBSERVED',
    resolution: 'polygon level',
    accessDate: '2026-10-08',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'Parks, gardens, grass, trees and natural areas extracted by landuse/leisure/natural tags.',
  },
  {
    id: 'osm-pois',
    name: 'OpenStreetMap points of interest',
    source: 'OpenStreetMap contributors (Overpass API)',
    category: 'OBSERVED',
    resolution: 'node level',
    accessDate: '2026-10-08',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'Amenities, shops, hotels and other POIs for activity-density weighting.',
  },
  {
    id: 'osm-schools',
    name: 'OpenStreetMap school locations',
    source: 'OpenStreetMap contributors (Overpass API)',
    category: 'OBSERVED',
    resolution: 'node/polygon level',
    accessDate: '2026-10-08',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'School and kindergarten locations in the corridor (for the campus use case).',
  },
  {
    id: 'thermo-tiles',
    name: 'THERMO urban geometry grid',
    source: 'DERIVED from the OSM layers above',
    category: 'DERIVED',
    resolution: '≈ 250 m × 250 m tiles',
    accessDate: '2026-10-08',
    license: '—',
    url: '#methodology',
    description:
      'Per-tile statistics of building cover, pavement proxy, vegetation, water, POI density and mean height. Computed by scripts/data/process.mjs on the OSM extracts.',
  },
  {
    id: 'thermo-graph',
    name: 'THERMO walkable graph',
    source: 'DERIVED from the OSM road & path network',
    category: 'DERIVED',
    resolution: 'edge level',
    accessDate: '2026-10-08',
    license: '—',
    url: '#methodology',
    description: 'Simplified walkable graph with distances between road/path junctions.',
  },
];

export function datasetById(id: string): DatasetMeta | undefined {
  return DATASETS.find((d) => d.id === id);
}

/** Boundaries of the corridor that the bundled data covers. */
export const DEMO_BOUNDS = {
  s: 25.155,
  w: 55.225,
  n: 25.285,
  e: 55.335,
};

export const DEMO_CENTER = { lon: 55.279, lat: 25.203, zoom: 13.5 };