#!/usr/bin/env node
/**
 * Build THERMO's shared Dubai spatial model from a fixed OSM snapshot and
 * the official HDX/OCHA Dubai Emirate boundary.
 *
 * Inputs (not committed):
 *   data/source/dubai-thematic.geojson       OSM geometry exported with osmium
 *   data/source/are-boundary/are_admin1.geojson  HDX/OCHA admin-1 boundary
 *
 * Outputs (committed, static/Vercel-friendly):
 *   public/data/dubai-spatial-model.json
 *   public/data/dubai-routing.json
 *
 * Every analysis cell is explicitly supported by OSM geometry in the source
 * snapshot. The 750 m grid is a modelling resolution, not a temperature
 * measurement resolution. Geometry is binned to cells for a coherent field;
 * the app never renders or samples outside those supported cells.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const INPUT = join(ROOT, 'data', 'source', 'dubai-thematic.geojson');
const BOUNDARY = join(ROOT, 'data', 'source', 'are-boundary', 'are_admin1.geojson');
const OUT = join(ROOT, 'public', 'data');

if (!existsSync(INPUT) || !existsSync(BOUNDARY)) {
  throw new Error('Missing source GeoJSON. Run the OSM + HDX acquisition commands documented in DATA.md first.');
}

/** Urban Dubai extent: all listed prototype districts lie inside this window. */
const EXTENT = { s: 24.75, w: 54.85, n: 25.45, e: 55.72 };
const CELL_M = 750;
const METERS_LAT = 110_540;
const METERS_LON = 111_320 * Math.cos((25.1 * Math.PI) / 180);
const CELL_LAT = CELL_M / METERS_LAT;
const CELL_LON = CELL_M / METERS_LON;
const ROWS = Math.ceil((EXTENT.n - EXTENT.s) / CELL_LAT);
const COLS = Math.ceil((EXTENT.e - EXTENT.w) / CELL_LON);
const CELL_AREA = CELL_M * CELL_M;
const ACCESS_DATE = '2026-10-15';

const HIGHWAYS_WALK = new Set([
  'footway', 'path', 'pedestrian', 'steps', 'living_street', 'residential', 'service',
  'unclassified', 'tertiary', 'secondary', 'primary', 'track', 'cycleway', 'road',
]);
const HIGHWAYS_CYCLE = new Set([
  'cycleway', 'path', 'living_street', 'residential', 'service', 'unclassified',
  'tertiary', 'secondary', 'primary', 'track', 'road',
]);
const ACCESS_NO = new Set(['no', 'private', 'destination', 'customers', 'agricultural', 'forestry']);
const YES = new Set(['yes', 'designated', 'permissive', 'official']);
const GREEN_LANDUSE = new Set(['grass', 'forest', 'meadow', 'recreation_ground', 'village_green', 'flowerbed', 'greenfield', 'orchard', 'farmland', 'allotments']);
const GREEN_LEISURE = new Set(['park', 'garden', 'nature_reserve', 'golf_course', 'pitch']);
const GREEN_NATURAL = new Set(['wood', 'scrub', 'grassland', 'heath', 'tree_row']);
const WATER_LANDUSE = new Set(['basin', 'reservoir']);
const BARE_NATURAL = new Set(['sand', 'bare_rock', 'shingle', 'scree', 'mud']);
const HIGHWAY_EXCLUDED = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'proposed', 'raceway', 'bus_guideway']);

function round(v, decimals = 5) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function key(r, c) { return r * COLS + c; }
function cellIndex(lon, lat) {
  const c = Math.floor((lon - EXTENT.w) / CELL_LON);
  const r = Math.floor((lat - EXTENT.s) / CELL_LAT);
  return r < 0 || r >= ROWS || c < 0 || c >= COLS ? null : key(r, c);
}
function rowCol(i) { return [Math.floor(i / COLS), i % COLS]; }
function cellCenter(r, c) {
  return { lon: EXTENT.w + (c + 0.5) * CELL_LON, lat: EXTENT.s + (r + 0.5) * CELL_LAT };
}
function distM(a, b) {
  return Math.hypot((a[0] - b[0]) * METERS_LON, (a[1] - b[1]) * METERS_LAT);
}
function segmentMid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function ringAreaM2(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2) * METERS_LON * METERS_LAT;
}
function ringCentroid(ring) {
  let x = 0; let y = 0; let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    x += (ring[i][0] + ring[i + 1][0]) * cross;
    y += (ring[i][1] + ring[i + 1][1]) * cross;
    a += cross;
  }
  if (Math.abs(a) < 1e-12) return ring[0];
  return [x / (3 * a), y / (3 * a)];
}
function bboxOf(ring) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of ring) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY };
}
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.filter((r) => r.length > 3);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap((poly) => poly.filter((r) => r.length > 3));
  return [];
}
function lineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}
function pointFromGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return geometry.coordinates;
  const rings = geometryRings(geometry);
  if (rings.length) return ringCentroid(rings[0]);
  const lines = lineStrings(geometry);
  if (lines.length && lines[0].length) return lines[0][Math.floor(lines[0].length / 2)];
  return null;
}
function boxIntersects(b) {
  return b.maxX >= EXTENT.w && b.minX <= EXTENT.e && b.maxY >= EXTENT.s && b.minY <= EXTENT.n;
}
function candidateCellIndexes(bb) {
  const start = cellIndex(Math.max(EXTENT.w, bb.minX), Math.max(EXTENT.s, bb.minY));
  const end = cellIndex(Math.min(EXTENT.e - 1e-9, bb.maxX), Math.min(EXTENT.n - 1e-9, bb.maxY));
  if (start === null || end === null) return [];
  const [r0, c0] = rowCol(start); const [r1, c1] = rowCol(end);
  const out = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) out.push(key(r, c));
  return out;
}

const boundaryDoc = JSON.parse(readFileSync(BOUNDARY, 'utf8'));
const dubaiBoundary = boundaryDoc.features.find((f) => f.properties?.adm1_pcode === 'AE02' || f.properties?.adm1_name === 'Dubai');
if (!dubaiBoundary) throw new Error('Dubai (AE02) boundary was not found in the HDX/OCHA file.');
const boundaryRings = geometryRings(dubaiBoundary.geometry)
  .map((ring) => ({ ring: ring.filter((_, i) => i % 4 === 0 || i === ring.length - 1), bb: bboxOf(ring) }));
function inDubaiBoundary(lon, lat) {
  return boundaryRings.some(({ ring, bb }) => lon >= bb.minX && lon <= bb.maxX && lat >= bb.minY && lat <= bb.maxY && inRing(lon, lat, ring));
}

const cells = new Map();
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const { lon, lat } = cellCenter(r, c);
    if (!inDubaiBoundary(lon, lat)) continue;
    cells.set(key(r, c), { r, c, lon: round(lon, 6), lat: round(lat, 6), buildingM2: 0, greenM2: 0, waterM2: 0, bareM2: 0, runwayM2: 0, roadM: 0, walkM: 0, cycleM: 0, poi: 0 });
  }
}

function insideCell(i) { return cells.get(i); }
function markPolygon(geometry, type) {
  for (const ring of geometryRings(geometry)) {
    const bb = bboxOf(ring);
    if (!boxIntersects(bb)) continue;
    const area = ringAreaM2(ring);
    if (!area) continue;
    const candidates = candidateCellIndexes(bb).filter((i) => {
      const cell = insideCell(i); return cell && inRing(cell.lon, cell.lat, ring);
    });
    // Small footprints are assigned by centroid. Larger polygons are divided
    // among cells whose centre is supported by the observed geometry.
    const usable = candidates.length ? candidates : (() => {
      const p = ringCentroid(ring); const i = cellIndex(p[0], p[1]); return i !== null && insideCell(i) ? [i] : [];
    })();
    if (!usable.length) continue;
    const each = area / usable.length;
    for (const i of usable) cells.get(i)[`${type}M2`] += each;
  }
}
function addRoadLine(coords, props) {
  for (let j = 0; j < coords.length - 1; j++) {
    const a = coords[j]; const b = coords[j + 1];
    const mid = segmentMid(a, b); const i = cellIndex(mid[0], mid[1]);
    if (i === null || !insideCell(i)) continue;
    const length = distM(a, b);
    const cell = cells.get(i);
    cell.roadM += length;
    if (allowsWalk(props)) cell.walkM += length;
    if (allowsCycle(props)) cell.cycleM += length;
  }
}
function isNo(v) { return ACCESS_NO.has(String(v ?? '').toLowerCase()); }
function allowsWalk(t) {
  const h = String(t.highway ?? '');
  if (HIGHWAY_EXCLUDED.has(h)) return false;
  if (isNo(t.foot) || (isNo(t.access) && !YES.has(t.foot))) return false;
  return HIGHWAYS_WALK.has(h) || YES.has(t.foot);
}
function allowsCycle(t) {
  const h = String(t.highway ?? '');
  if (HIGHWAY_EXCLUDED.has(h) || h === 'steps') return false;
  if (isNo(t.bicycle) || (isNo(t.access) && !YES.has(t.bicycle))) return false;
  if (h === 'footway') return YES.has(t.bicycle);
  if (h === 'pedestrian') return YES.has(t.bicycle) || String(t.bicycle ?? '') === 'permissive';
  return HIGHWAYS_CYCLE.has(h) || YES.has(t.bicycle);
}
function polygonClass(t) {
  if (t.building) return 'building';
  if (t.aeroway === 'runway' || t.aeroway === 'taxiway') return 'runway';
  if (t.natural === 'water' || WATER_LANDUSE.has(t.landuse) || t.water) return 'water';
  if (GREEN_LANDUSE.has(t.landuse) || GREEN_LEISURE.has(t.leisure) || GREEN_NATURAL.has(t.natural)) return 'green';
  if (BARE_NATURAL.has(t.natural) || new Set(['construction', 'brownfield', 'quarry']).has(t.landuse)) return 'bare';
  return null;
}
function isSearchable(t) { return Boolean(t.name && (t.place || t.amenity || t.shop || t.tourism)); }

console.log(`Grid ${ROWS}×${COLS}; Dubai-boundary candidate cells ${cells.size}`);
console.log('Reading OSM GeoJSON…');
const osm = JSON.parse(readFileSync(INPUT, 'utf8'));
const searchByKey = new Map();
let featureCount = 0;

function addSearch(feature, t) {
  if (!isSearchable(t)) return;
  const point = pointFromGeometry(feature.geometry);
  if (!point || !inDubaiBoundary(point[0], point[1])) return;
  if (point[0] < EXTENT.w || point[0] > EXTENT.e || point[1] < EXTENT.s || point[1] > EXTENT.n) return;
  const cellId = cellIndex(point[0], point[1]);
  if (cellId !== null && insideCell(cellId)) cells.get(cellId).poi += 1;
  const category = t.place ? 'place' : t.amenity ? 'amenity' : t.tourism ? 'tourism' : 'shop';
  const k = `${String(t.name).toLowerCase()}|${round(point[0], 4)}|${round(point[1], 4)}`;
  if (!searchByKey.has(k)) searchByKey.set(k, { id: `osm-${searchByKey.size + 1}`, name: t.name, lon: round(point[0], 6), lat: round(point[1], 6), category, area: t['addr:district'] ?? t.place ?? '' });
}
for (const feature of osm.features) {
  featureCount++;
  const t = feature.properties ?? {};
  const geometry = feature.geometry;
  if (!geometry) continue;
  const point = pointFromGeometry(geometry);
  if (point && (point[0] < EXTENT.w || point[0] > EXTENT.e || point[1] < EXTENT.s || point[1] > EXTENT.n)) continue;
  const klass = polygonClass(t);
  if (klass && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) markPolygon(geometry, klass);
  if (t.aeroway === 'runway' || t.aeroway === 'taxiway') {
    for (const line of lineStrings(geometry)) addRoadLine(line, { highway: 'runway' });
  }
  if (t.highway) {
    for (const line of lineStrings(geometry)) {
      addRoadLine(line, t);
    }
  }
  addSearch(feature, t);
  if (featureCount % 200_000 === 0) console.log(`  parsed ${featureCount.toLocaleString()} OSM features`);
}

const outputCells = [];
for (const cell of cells.values()) {
  const building = clamp01(cell.buildingM2 / CELL_AREA);
  const green = clamp01(cell.greenM2 / CELL_AREA);
  const water = clamp01(cell.waterM2 / CELL_AREA);
  const bare = clamp01(cell.bareM2 / CELL_AREA);
  const runway = clamp01(cell.runwayM2 / CELL_AREA);
  const road = clamp01(cell.roadM / 700);
  const walk = clamp01(cell.walkM / 650);
  const cycle = clamp01(cell.cycleM / 650);
  // A cell is visible only if the fixed OSM snapshot has mapped support.
  const evidence = cell.roadM + cell.buildingM2 / 40 + cell.greenM2 / 55 + cell.waterM2 / 55 + cell.runwayM2 / 70 + cell.poi * 110;
  if (evidence < 70) continue;
  const dominant = water >= 0.2 ? 'water'
    : runway >= 0.08 ? 'runway'
      : green >= 0.22 ? 'vegetation'
        : building >= 0.16 ? 'building'
          : road >= 0.32 ? 'road'
            : bare >= 0.16 ? 'bare' : 'mixed';
  outputCells.push({
    id: key(cell.r, cell.c), r: cell.r, c: cell.c, lon: cell.lon, lat: cell.lat,
    b: round(building, 3), road: round(road, 3), g: round(green, 3), water: round(water, 3),
    bare: round(bare, 3), runway: round(runway, 3), walk: round(walk, 3), cycle: round(cycle, 3),
    poi: cell.poi, cover: dominant,
  });
}

const requiredNames = ['deira', 'dubai marina', 'mirdif', 'al barsha', 'dubai hills', 'dubai south'];
const searchable = [...searchByKey.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .slice(0, 12_000);
for (const required of requiredNames) {
  const has = searchable.some((p) => p.name.toLowerCase().includes(required));
  console.log(`Search anchor ${required}: ${has ? 'found' : 'not mapped as a searchable named OSM feature'}`);
}

mkdirSync(OUT, { recursive: true });
const metadata = {
  schema: 'thermo-spatial-v2', generatedAt: new Date().toISOString(), accessDate: ACCESS_DATE,
  source: {
    osm: 'Geofabrik GCC states extract (OpenStreetMap contributors, ODbL 1.0)',
    osmSnapshot: '2026-10-15T20:21:00Z',
    boundary: 'HDX/OCHA COD-AB UAE admin-1 v01, Dubai (AE02), valid 2023-05-15',
  },
  coverage: {
    description: 'OSM-supported urban Dubai cells inside the verified Dubai Emirate boundary and this static urban analysis window. Unsupported cells are transparent; no values are extrapolated into them.',
    extent: EXTENT,
    requiredAreas: ['Deira', 'Dubai Marina', 'Mirdif', 'Al Barsha', 'Dubai Hills', 'Dubai South'],
    sourceResolutionM: CELL_M,
    observedCells: outputCells.length,
  },
  classifications: {
    water: 'OSM natural=water, water=* or landuse=basin/reservoir',
    vegetation: 'OSM leisure/landuse/natural green tags; only where mapped',
    buildings: 'OSM building=* polygons',
    roads: 'OSM highway=* line density',
    runways: 'OSM aeroway=runway/taxiway',
    bare: 'OSM natural=sand/bare_rock/shingle/scree/mud or construction/brownfield/quarry',
  },
};
writeFileSync(join(OUT, 'dubai-spatial-model.json'), JSON.stringify({ metadata, grid: { ...EXTENT, rows: ROWS, cols: COLS, cellLat: CELL_LAT, cellLon: CELL_LON, cellSizeM: CELL_M }, cells: outputCells, search: searchable }));
writeFileSync(join(OUT, 'routing-provider.json'), JSON.stringify({
  provider: 'Valhalla public OSM routing endpoint',
  endpoint: 'https://valhalla1.openstreetmap.de/route',
  modes: ['pedestrian', 'bicycle'],
  method: 'Fastest has no thermal constraint. Balanced/Coolest sample the initial real route then submit bounded high-potential matched samples as exclude_locations before a follow-on provider path search.',
  limitation: 'The public provider does not accept arbitrary THERMO edge weights; categorical high-potential avoidance is used instead.',
}));
console.log(`Wrote ${outputCells.length.toLocaleString()} spatial cells and ${searchable.length.toLocaleString()} searchable OSM places. Routing is served live by Valhalla's OSM pedestrian/bicycle network.`);
