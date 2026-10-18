import type { SpatialModel } from '../types/domain';

/** Static artefacts generated from the documented OSM + HDX source snapshot. */
let spatialModelPromise: Promise<SpatialModel> | null = null;

function staticData(path: string) {
  return fetch(import.meta.env.BASE_URL + path).then((r) => {
    if (!r.ok) throw new Error(`Spatial data request failed (${r.status})`);
    return r.json();
  });
}

export function fetchSpatialModel(): Promise<SpatialModel> {
  if (!spatialModelPromise) spatialModelPromise = staticData('data/dubai-spatial-model.json') as Promise<SpatialModel>;
  return spatialModelPromise;
}

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

export const DATASETS: DatasetMeta[] = [
  {
    id: 'osm-snapshot',
    name: 'OpenStreetMap Dubai urban geometry & access tags',
    source: 'OpenStreetMap contributors via Geofabrik GCC states extract',
    category: 'OBSERVED',
    resolution: 'mapped feature geometry; completeness varies by area',
    accessDate: '2026-10-15',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'Buildings, highways, pedestrian/cycle access tags, vegetation, water, runways, bare land and named places from a fixed OSM snapshot.',
  },
  {
    id: 'hdx-boundary',
    name: 'Dubai Emirate administrative boundary',
    source: 'HDX/OCHA COD-AB UAE admin-1 v01 (Dubai AE02)',
    category: 'OBSERVED',
    resolution: 'administrative polygon',
    accessDate: '2026-10-16',
    license: 'CC BY-IGO',
    url: 'https://data.humdata.org/dataset/cod-ab-are',
    description: 'Verified Dubai Emirate boundary used to constrain the supported urban analysis window and prevent extension into other emirates.',
  },
  {
    id: 'thermo-spatial',
    name: 'THERMO spatial field & land-cover masks',
    source: 'Derived from the fixed OSM snapshot and HDX/OCHA boundary above',
    category: 'DERIVED',
    resolution: '750 m analysis cells',
    accessDate: '2026-10-16',
    license: 'ODbL-derived data; see source attribution',
    url: '#model',
    description: 'Shared cells record OSM-supported building, road, vegetation, water, runway and bare-land fractions. Unsupported cells are intentionally absent.',
  },
  {
    id: 'thermo-routing',
    name: 'Valhalla pedestrian/cycle OSM routing network',
    source: 'valhalla1.openstreetmap.de public OSM routing service',
    category: 'DERIVED',
    resolution: 'OSM network edge level; live provider response',
    accessDate: '2026-10-16',
    license: 'Provider availability is best-effort; underlying network is OSM-derived',
    url: '#routing',
    description: 'Routes use Valhalla pedestrian/bicycle costing and OSM access rules. THERMO submits selected modelled high-potential cells as pre-search exclusions because the public provider has no custom thermal edge-weight API.',
  },
];

export const DUBAI_DEFAULT_VIEW = { lat: 25.130, lon: 55.255, zoom: 10.55 };


/**
 * Pan limits for every map: the model extent plus a margin. Stops the map
 * (and its base tiles) from wandering across repeated world copies when zoomed out.
 */
export function mapBoundsFor(model: { grid: { s: number; w: number; n: number; e: number } }, marginDeg = 0.5): [[number, number], [number, number]] {
  const { s: south, w, n, e } = model.grid;
  return [[south - marginDeg, w - marginDeg], [n + marginDeg, e + marginDeg]];
}
