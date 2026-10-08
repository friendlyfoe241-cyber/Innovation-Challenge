#!/usr/bin/env node
/**
 * Process raw OpenStreetMap extracts into compact application datasets.
 *
 * OBSERVED  → buildings / roads / paths / green / water / pois / schools
 *             (OpenStreetMap contributors, ODbL)
 * DERIVED   → tile-level land-surface metrics + walkability graph
 *             (computed here from the OSM data with documented formulas)
 *
 * Output: src/data/dubai/*.json
 *   - tiles.json       grid of land/urban statistics + derived heat inputs
 *   - layers.json      simplified geometries for map rendering (demo zone)
 *   - graph.json       walkable graph for the route planner (demo zone)
 *   - schools.json     school locations for campus mode
 *
 * Usage: node scripts/data/process.mjs [zone]
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, '..', '..', 'data', 'raw');
const OUT = join(__dirname, '..', '..', 'src', 'data', 'dubai');

// ---------------------------------------------------------------- geometry

const load = (name) => {
  const p = join(RAW, `${name}.json`);
  if (!existsSync(p)) {
    console.warn(`missing raw/${name}.json`);
    return [];
  }
  return JSON.parse(readFileSync(p, 'utf8'));
};

const FEET = 0.3048;

/** Lookup tags; treat aerialway/single-node ways safely. */
function round(v, d = 5) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

/** Douglas–Peucker polyline simplification with perpendicular distance (degrees ≈ metres / 111km). */
export function simplifyPts(pts, tol = 0.00005, maxPts = 2000) {
  if (pts.length < 4) return pts;
  const keep = [0, pts.length - 1];
  const stack = [[0, pts.length - 1]];
  while (stack.length && keep.length < maxPts) {
    const [i0, i1] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distToSeg(pts[i], pts[i0], pts[i1]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep.push(idx);
      stack.push([i0, idx], [idx, i1]);
    }
  }
  keep.sort((a, b) => a - b);
  return keep.map((i) => pts[i]);
}

function distToSeg(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-12;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  a += pts[pts.length - 1][0] * pts[0][1] - pts[0][0] * pts[pts.length - 1][1];
  return Math.abs(a / 2);
}

const toLonLat = (el) => el.geometry?.map((g) => [round(g.lon), round(g.lat)]);

// ---------------------------------------------------------------- zones

const ZONES = {
  // Full corridor used for the heat grid.
  grid: { s: 25.155, w: 55.225, n: 25.285, e: 55.335, cols: 44, rows: 32 },
  // Focused demo zone rendered on the explorer map.
  demo: { s: 25.16, w: 55.242, n: 25.235, e: 55.33 },
};

const CORRIDOR = ZONES.grid;

// ---------------------------------------------------------------- tiles

function buildTiles() {
  const { s, w, n, e, cols, rows } = CORRIDOR;
  const dx = (e - w) / cols;
  const dy = (n - s) / rows;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        lon: Math.round((w + (c + 0.5) * dx) * 100000) / 100000,
        lat: Math.round((s + (r + 0.5) * dy) * 100000) / 100000,
        r, c,
      });
    }
  }
  return { tiles, dx, dy };
}

// Precompute feature bounding boxes (lon/lat space).
function withBBox(pts) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function pointInPoly(pt, pts) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToLine(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-12;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const METER_LON = 111320;
const METER_LAT = 110540;
function toMeters(lon, lat) {
  return [lon * METER_LON, lat * METER_LAT];
}

function tileKey(r, c) {
  return `${r}:${c}`;
}

export function buildGrid() {
  const buildings = load('buildings').concat(load('buildings2'));
  const roads = load('roads');
  const paths = load('paths');
  const green = load('green');
  const water = load('water');
  const pois = load('pois');

  const grid = buildTiles();
  const { tiles } = grid;
  const cols = 44, rows = 32;
  const { s, w, n, e } = CORRIDOR;

  const tileW = (e - w) / cols;
  const tileH = (n - s) / rows;

  // Feature forms
  const bPolys = [];
  for (const el of buildings) {
    const pts = toLonLat(el);
    if (!pts || pts.length < 3) continue;
    // only polygons that plausibly exist (closed-ish)
    if (Math.abs(pts[0][0] - pts[pts.length - 1][0]) > 1e-6 || Math.abs(pts[0][1] - pts[pts.length - 1][1]) > 1e-6) continue;
    bPolys.push({ pts, bb: withBBox(pts), height: parseFloat(el.tags?.height) || parseFloat(el.tags?.['building:levels']) * 3 || 9 });
  }
  const gPolys = [];
  for (const el of green) {
    const pts = toLonLat(el);
    if (!pts || pts.length < 3) continue;
    if (Math.abs(pts[0][0] - pts[pts.length - 1][0]) > 1e-6) continue;
    gPolys.push({ pts, bb: withBBox(pts) });
  }
  const wPolys = [];
  for (const el of water) {
    const pts = toLonLat(el);
    if (!pts || pts.length < 3) continue;
    wPolys.push({ pts, bb: withBBox(pts) });
  }
  const roadSegs = [];
  for (const el of roads.concat(paths)) {
    const pts = toLonLat(el);
    if (!pts || pts.length < 2) continue;
    const cls = el.tags?.highway ?? '';
    roadSegs.push({ pts, cls, bb: withBBox(pts) });
  }
  const poiPts = [];
  for (const el of pois) {
    const g = el.lat != null ? { lon: el.lon, lat: el.lat } : el.center;
    if (!g) continue;
    poiPts.push([round(g.lon), round(g.lat)]);
  }

  // Bin buildings into a coarse lat/lon lookup for fast point queries.
  const COLS = 64, ROWS = 48;
  const bins = Array.from({ length: COLS * ROWS }, () => []);
  const binW = (e - w) / COLS;
  const binH = (n - s) / ROWS;
  const binIdx = (x, y) => {
    const c = Math.min(COLS - 1, Math.max(0, Math.floor((x - w) / binW)));
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor((y - s) / binH)));
    return r * COLS + c;
  };
  for (const p of bPolys) {
    bins[binIdx(p.bb.minX, p.bb.minY)].push(p);
    bins[binIdx(p.bb.maxX, p.bb.maxY)].push(p);
    bins[binIdx(p.bb.minX, p.bb.maxY)].push(p);
    bins[binIdx(p.bb.maxX, p.bb.minY)].push(p);
  }

  // Sample points inside each tile for coverage estimation.
  const SAMPLES = 5;
  const building = [];
  const pavement = [];
  const greening = [];
  const waterF = [];
  const poiDensity = [];
  const height = [];

  for (const t of tiles) {
    const cx = t.lon, cy = t.lat;
    // midpoint of tile in lon/lat for sampling
    const x0 = cx - tileW / 2, x1 = cx + tileW / 2;
    const y0 = cy - tileH / 2, y1 = cy + tileH / 2;
    let bHits = 0;
    let pHits = 0;
    let gHits = 0;
    let wHits = 0;
    const pts = [];
    for (let i = 0; i < SAMPLES; i++) {
      for (let j = 0; j < SAMPLES; j++) {
        const px = x0 + (tileW * (i + 0.5)) / SAMPLES;
        const py = y0 + (tileH * (j + 0.5)) / SAMPLES;
        const p = [px, py];
        pts.push(p);
        // sample building polygons from 4 corner bins
        let hit = false;
        const seen = new Set();
        for (const corner of [binIdx(px, py), binIdx(px - tileW, py - tileH), binIdx(px + tileW, py - tileH), binIdx(px - tileW, py)]) {
          for (const poly of bins[corner]) {
            const k2 = poly;
            if (seen.has(k2)) continue;
            seen.add(k2);
            if (px < poly.bb.minX || px > poly.bb.maxX || py < poly.bb.minY || py > poly.bb.maxY) continue;
            if (pointInPoly(p, poly.pts)) { hit = true; break; }
          }
          if (hit) break;
        }
        if (hit) { bHits++; continue; }
        for (const poly of gPolys) {
          if (px < poly.bb.minX || px > poly.bb.maxX || py < poly.bb.minY || py > poly.bb.maxY) continue;
          if (pointInPoly(p, poly.pts)) { gHits++; break; }
        }
        for (const poly of wPolys) {
          if (px < poly.bb.minX || px > poly.bb.maxX || py < poly.bb.minY || py > poly.bb.maxY) continue;
          if (pointInPoly(p, poly.pts)) { wHits++; break; }
        }
      }
    }
    // road proximity: distance from tile centre to nearest road segment
    const [mx, my] = toMeters(cx, cy);
    let minD = 1e9;
    for (const seg of roadSegs) {
      const d = distToLine(mx, my, ...toMeters(seg.pts[0][0], seg.pts[0][1]), ...toMeters(seg.pts[Math.floor(seg.pts.length / 2)][0], seg.pts[Math.floor(seg.pts.length / 2)][1]));
      if (d < minD) minD = d;
    }
    let poi = 0;
    for (const pp of poiPts) {
      const d = Math.hypot((pp[0] - cx) * METER_LON, (pp[1] - cy) * METER_LAT);
      if (d < 220) poi++;
    }

    const total = SAMPLES * SAMPLES;
    building.push(Math.round((bHits / total) * 1000) / 1000);
    pavement.push(Math.round((1 - Math.min(1, minD / 260)) * 1000) / 1000);
    greening.push(Math.round((gHits / total) * 1000) / 1000);
    waterF.push(Math.round((wHits / total) * 1000) / 1000);
    poiDensity.push(Math.round(Math.min(1, poi / 14) * 1000) / 1000);
    // mean building height proxy
    let bh = 0;
    let bn = 0;
    const rect = { minX: x0, maxX: x1, minY: y0, maxY: y1 };
    for (const poly of bPolys) {
      if (poly.bb.maxX < rect.minX || poly.bb.minX > rect.maxX || poly.bb.maxY < rect.minY || poly.bb.minY > rect.maxY) continue;
      bh += poly.height;
      bn++;
    }
    height.push(Math.round((bn ? bh / bn : 0) * 10) / 10);
  }

  grid.tiles.forEach((t, i) => {
    t.b = building[i];
    t.p = pavement[i];
    t.g = greening[i];
    t.wt = waterF[i];
    t.pd = poiDensity[i];
    t.h = height[i];
  });

  const totals = {
    buildingCells: building.filter((b) => b > 0.01).length,
    greenCells: greening.filter((g) => g > 0.05).length,
  };
  return grid;
}

// ---------------------------------------------------------------- demo layers

function clipPoly(pts, zone) {
  return pts.filter(([x, y]) => x >= zone.w && x <= zone.e && y >= zone.s && y <= zone.n);
}

function demoTiles() {
  const grid = buildGrid();
  const { demo } = ZONES;
  return grid.tiles.filter((t) => t.lon >= demo.w && t.lon <= demo.e && t.lat >= demo.s && t.lat <= demo.n);
}

function buildLayers() {
  const demo = ZONES.demo;
  const buildings = load('buildings').concat(load('buildings2'));
  const roads = load('roads');
  const paths = load('paths');
  const green = load('green');
  const water = load('water');
  const pois = load('pois');
  const schools = load('schools');

  const outBuildings = [];
  let kept = 0;
  for (const el of buildings) {
    const pts = toLonLat(el);
    if (!pts || pts.length < 3) continue;
    const bb = withBBox(pts);
    if (bb.maxX < demo.w || bb.minX > demo.e || bb.maxY < demo.s || bb.minY > demo.n) continue;
    const simp = simplifyPts(pts, 0.00003);
    if (simp.length < 3) continue;
    const h = parseFloat(el.tags?.height) || parseFloat(el.tags?.['building:levels']) * 3 || 0;
    outBuildings.push({ g: simp.map(([x, y]) => [round(x), round(y)]), h: Math.round(h * 10) / 10 });
    kept++;
  }
  console.log(`  buildings kept: ${kept}`);

  const clipSegs = (els, denoise) => {
    const segs = [];
    for (const el of els) {
      const pts = toLonLat(el);
      if (!pts || pts.length < 2) continue;
      const bb = withBBox(pts);
      if (bb.maxX < demo.w || bb.minX > demo.e || bb.maxY < demo.s || bb.minY > demo.n) continue;
      let simp = simplifyPts(pts, denoise);
      if (simp.length < 2) continue;
      const tags = el.tags ?? {};
      segs.push({
        g: simp.map(([x, y]) => [round(x), round(y)]),
        cls: tags.highway ?? tags.leisure ?? tags.natural ?? tags.landuse ?? '',
        name: tags.name ?? '',
      });
    }
    return segs;
  };

  const outRoads = clipSegs(roads, 0.00005);
  const outPaths = clipSegs(paths, 0.00004);
  const outGreen = clipSegs(green, 0.00005);
  const outWater = clipSegs(water, 0.00005);

  const outPois = [];
  for (const el of pois) {
    const g = el.lat != null ? el : { center: el.center };
    if (!g?.lat && !g.center) continue;
    const lon = g.lat != null ? g.lon : g.center.lon;
    const lat = g.lat != null ? g.lat : g.center.lat;
    if (lon < demo.w || lon > demo.e || lat < demo.s || lat > demo.n) continue;
    const tags = el.tags ?? {};
    outPois.push([round(lon), round(lat), tags.amenity ?? tags.shop ?? tags.tourism ?? tags.building ?? 'poi', tags.name ?? '']);
  }
  // dedupe by rounded coords
  const seenP = new Set();
  const poisUnique = [];
  for (const p of outPois) {
    const k = `${p[0]}|${p[1]}`;
    if (seenP.has(k)) continue;
    seenP.add(k);
    poisUnique.push(p);
  }

  const schoolPts = [];
  for (const el of schools) {
    const g = el.lat != null ? el : el.center;
    if (!g) continue;
    if (g.lon < demo.w || g.lon > demo.e || g.lat < demo.s || g.lat > demo.n) continue;
    const tags = el.tags ?? {};
    schoolPts.push({
      lon: round(g.lon),
      lat: round(g.lat),
      name: tags.name ?? 'School',
      type: tags.amenity ?? 'school',
    });
  }

  const tiles = demoTiles();
  return { tiles, buildings: outBuildings, roads: outRoads, paths: outPaths, green: outGreen, water: outWater, pois: poisUnique, schools: schoolPts };
}

// ---------------------------------------------------------------- routing graph

export function buildGraph() {
  const demo = { s: 25.178, w: 55.262, n: 25.2225, e: 55.326 };
  const roads = load('roads').concat(load('paths'));
  const nodes = new Map(); // key -> {id, lon, lat}
  const edges = [];
  let nid = 0;
  const keyOf = (lon, lat) => `${lon.toFixed(5)},${lat.toFixed(5)}`;
  const ensure = (lon, lat) => {
    const k = keyOf(lon, lat);
    if (!nodes.has(k)) {
      nodes.set(k, { id: nid++, lon: round(lon), lat: round(lat) });
    }
    return nodes.get(k);
  };

  for (const el of roads) {
    const pts = toLonLat(el);
    if (!pts || pts.length < 2) continue;
    const bb = withBBox(pts);
    if (bb.maxX < demo.w || bb.minX > demo.e || bb.maxY < demo.s || bb.minY > demo.n) continue;
    const cls = el.tags?.highway ?? '';
    if (/motorway|trunk/.test(cls)) continue;
    const speed = cls === 'primary' ? 60 : cls === 'secondary' ? 50 : cls === 'tertiary' ? 40 : 12;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = ensure(pts[i][0], pts[i][1]);
      const b = ensure(pts[i + 1][0], pts[i + 1][1]);
      if (a.id === b.id) continue;
      const seg = { a: a.id, b: b.id, cls, speed };
      const dLat = (b.lat - a.lat) * METER_LAT;
      const dLon = (b.lon - a.lon) * METER_LON;
      seg.len = Math.hypot(dLon, dLat);
      seg.mid = [round((a.lon + b.lon) / 2, 6), round((a.lat + b.lat) / 2, 6)];
      edges.push(seg);
    }
  }
  const nodeList = [...nodes.values()];
  return { nodes: nodeList, edges };
}

// ---------------------------------------------------------------- main

mkdirSync(OUT, { recursive: true });

const grid = buildGrid();
writeFileSync(join(OUT, 'tiles.json'), JSON.stringify(grid));
console.log(`tiles.json → ${grid.tiles.length} tiles`);

const layers = buildLayers();
writeFileSync(join(OUT, 'layers.json'), JSON.stringify(layers));
console.log(`layers.json → buildings ${layers.buildings.length}, roads ${layers.roads.length}, paths ${layers.paths.length}, green ${layers.green.length}, water ${layers.water.length}, pois ${layers.pois.length}, schools ${layers.schools.length}`);

const graph = buildGraph();
writeFileSync(join(OUT, 'graph.json'), JSON.stringify(graph));
console.log(`graph.json → ${graph.nodes.length} nodes, ${graph.edges.length} edges`);