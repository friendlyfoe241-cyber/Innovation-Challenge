/**
 * THERMO route planning on the derived walkable graph.
 *
 * Graph (graph.json) is DERIVED from OpenStreetMap road/path data
 * (OBSERVED). Heat exposure along edges is computed by the heat model,
 * which yields an analytical estimate proportional to:
 *   surface temperature + time of day + exposure to direct sun.
 *
 * The route score is a prototype ("estimated environmental heat
 * exposure"), not a physiological heat-risk prediction.
 *
 * The planner runs several weighted shortest paths ("fastest",
 * "balanced", "cooler") to produce alternatives, then scores each one
 * with the same underlying exposure model.
 */
import type { Graph, GraphNode, HeatTile, LonLat, TimeOfDay } from '../../types/domain';
import { airTempAtTile, heatIndexFor } from '../heat/heatModel';
import { METER_PER_DEG_LAT, METER_PER_DEG_LON, distMeters } from '../geo/geo';

export interface RouteSegment {
  from: GraphNode;
  to: GraphNode;
  dist: number;
  /** fraction of the segment in direct sun (est.) */
  exposed: number;
  surfaceTemp: number;
  heatIndex: number;
  cls: string;
}

export interface RouteResult {
  /** packed polyline [lon,lat] */
  geometry: [number, number][];
  segments: RouteSegment[];
  /** travel time, minutes */
  durationMin: number;
  distanceM: number;
  /** minutes in direct sun */
  exposedMin: number;
  /** minutes in shade/protected settings */
  shadedMin: number;
  /** route heat score 0..100 (distance-weighted mean edge exposure) */
  heatScore: number;
  cost: number;
  /** Fastest / Balanced / Cooler classification used by the UI */
  label: 'Fastest' | 'Balanced' | 'Cooler';
}

export interface RouteOptions {
  /** 0 = fastest, 1 = coolest */
  preference: number;
  hour: TimeOfDay;
  walkingSpeed: number;
}

export const DEFAULT_ROUTE_OPTIONS: RouteOptions = {
  preference: 0.55,
  hour: 14,
  walkingSpeed: 4.9, // km/h warm-day composite (typical urban walking)
};

/** Canonical unordered edge key. */
function edgeKey(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo * 1000000 + hi;
}

/** Find the graph node nearest a geographic point within maxRadiusM. */
export function snapNode(graph: Graph, p: LonLat, maxRadiusM = 320): GraphNode | null {
  let best: GraphNode | null = null;
  let bestD = maxRadiusM;
  for (const n of graph.nodes) {
    const d = Math.hypot((n.lon - p.lon) * METER_PER_DEG_LON, (n.lat - p.lat) * METER_PER_DEG_LAT);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function unpackPath(parent: Map<number, number>, target: number): number[] {
  const chain: number[] = [];
  let cur: number | undefined = target;
  while (cur !== undefined) {
    chain.push(cur);
    cur = parent.get(cur);
  }
  chain.reverse();
  return chain;
}

/** Tile-lozenge describing an edge midpoint (no per-node OSM heat attrs). */
function edgeMidTile(e: { mid: [number, number] }): HeatTile {
  return { lon: e.mid[0], lat: e.mid[1], r: 0, c: 0, b: 0, p: 0, g: 0, wt: 0, pd: 0, h: 0 };
}

/**
 * Compute the Fastest / Balanced / Cooler alternatives.
 *
 * `tileLookup` maps an edge midpoint to the nearest heat-grid tile so the
 * route weighting reflects the actual urban fabric.
 *
 * The cooler option is not a single uniform weight — after the fastest path
 * is found its edges are penalised so the search must explore a different
 * street combination. This produces genuinely distinct alternatives instead
 * of the same polyline re-scored.
 */
export function computeRoutes(
  graph: Graph,
  from: LonLat,
  to: LonLat,
  opts: RouteOptions,
  tileLookup: (lon: number, lat: number) => HeatTile | null = () => null,
): RouteResult[] {
  const hour = opts.hour ?? 14;
  const a = snapNode(graph, from);
  const b = snapNode(graph, to);
  if (!a || !b) return [];

  // ---- precompute per-edge exposure
  const heatByEdge = new Map<number, number>();
  const surfByEdge = new Map<number, number>();
  for (const e of graph.edges) {
    const mid = edgeMidTile(e);
    const tile = tileLookup(e.mid[0], e.mid[1]) ?? mid;
    const hi = heatIndexFor(tile, hour);
    heatByEdge.set(edgeKey(e.a, e.b), hi);
    surfByEdge.set(edgeKey(e.a, e.b), airTempAtTile(tile, hour));
  }

  const SPEED_MPS = opts.walkingSpeed / 3.6;

  // Dijkstra with a custom edge cost; `penalty` multiplies edge weights.
  const dijk = (
    costFn: (w: { hi: number; len: number }) => number,
    penalty: Map<number, number> = new Map(),
  ): Map<number, number> => {
    const dist = new Map<number, number>();
    const parent = new Map<number, number>();
    const visited = new Set<number>();
    const pq: Array<[number, number]> = [[0, a.id]];
    dist.set(a.id, 0);
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0]);
      const [d, u] = pq.shift()!;
      if (visited.has(u)) continue;
      visited.add(u);
      if (u === b.id) break;
      for (const e of graph.edges) {
        let v = -1;
        if (e.a === u) v = e.b;
        else if (e.b === u) v = e.a;
        if (v < 0 || visited.has(v)) continue;
        const key = edgeKey(e.a, e.b);
        const hi = heatByEdge.get(key) ?? 40;
        const w = costFn({ hi, len: e.len }) * (penalty.get(key) ?? 1);
        const nd = d + w;
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          parent.set(v, u);
          pq.push([nd, v]);
        }
      }
    }
    return parent;
  };

  const pref = Math.min(1, Math.max(0, opts.preference));

  const trace = (parent: Map<number, number>): RouteResult | null => {
    const chain = unpackPath(parent, b.id);
    if (chain.length < 2) return null;
    const segs: RouteSegment[] = [];
    let distanceM = 0;
    let cost = 0;
    for (let i = 0; i < chain.length - 1; i++) {
      const n0 = graph.nodes[chain[i]];
      const n1 = graph.nodes[chain[i + 1]];
      const key = edgeKey(n0.id, n1.id);
      const d = distMeters(n0, n1);
      const hi = heatByEdge.get(key) ?? 40;
      const st = surfByEdge.get(key) ?? 38;
      const exposed = Math.min(0.96, Math.max(0.15, 0.26 + (hi / 100) * 0.6));
      const cls = '';
      segs.push({ from: n0, to: n1, dist: d, exposed, surfaceTemp: st, heatIndex: hi, cls });
      distanceM += d;
      cost += d * hi;
    }
    if (distanceM < 12) return null;
    const durationMin = distanceM / SPEED_MPS / 60;
    const exposedMin = segs.reduce((s, g) => s + g.dist * g.exposed, 0) / SPEED_MPS / 60;
    return {
      geometry: chain.map((id) => [graph.nodes[id].lon, graph.nodes[id].lat] as [number, number]),
      segments: segs,
      durationMin,
      distanceM,
      exposedMin,
      shadedMin: Math.max(0, durationMin - exposedMin),
      heatScore: Math.round(cost / distanceM),
      cost: cost / distanceM,
      label: 'Balanced',
    };
  };

  const routes: RouteResult[] = [];

  // 1) Fastest — distance only.
  const parentFast = dijk(({ len }) => len);
  const fast = trace(parentFast);
  if (fast) {
    routes.push(fast);
    // 2) Balanced: distance + real exposure blend, penalise the fastest path.
    const pen1 = new Map<number, number>();
    for (let i = 0; i < fast.geometry.length - 1; i++) {
      const k = edgeKey(fast.segments[i].from.id, fast.segments[i].to.id);
      pen1.set(k, 2.4);
    }
    const bal = trace(
      dijk(({ hi, len }) => len * (1 - 0.45 * pref + (hi / 100) * 1.35 * pref), pen1),
    );
    if (bal) routes.push(bal);
  }
  // 3) Cooler: strong exposure weight on top of penalties from both paths.
  const pen2 = new Map<number, number>();
  for (const r of routes) {
    for (const s of r.segments) {
      const k = edgeKey(s.from.id, s.to.id);
      pen2.set(k, 3.6);
    }
  }
  const cool = trace(dijk(({ hi, len }) => len * (0.22 + (hi / 100) * 2.0), pen2));
  if (cool) routes.push(cool);

  // Deduplicate by full geometry signature.
  const seen = new Set<string>();
  const unique = routes.filter((r) => {
    const sig = r.geometry.map((p) => p.map((v) => v.toFixed(5)).join(',')).join('|');
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  // Classify by measured time & heat, then present Fastest first and keep
  // the genuine low-heat alternative visible as "Cooler".
  let fastest = unique[0];
  let coolest = unique[0];
  for (const r of unique) {
    if (r.durationMin < fastest.durationMin) fastest = r;
    if (r.heatScore < coolest.heatScore) coolest = r;
  }
  for (const r of unique) {
    if (r === fastest) r.label = 'Fastest';
    else if (r === coolest) r.label = 'Cooler';
    else r.label = 'Balanced';
  }
  unique.sort((a, b) => {
    if (a === fastest) return -1;
    if (b === fastest) return 1;
    return a.durationMin - b.durationMin;
  });
  return unique;
}

/** Human-readable tagline for a route in the result list. */
export function routeTagline(route: RouteResult): string {
  if (route.label === 'Fastest') return 'Fastest option';
  if (route.label === 'Cooler') return 'Recommended for lower heat exposure';
  return 'Best balance between time and heat exposure';
}

export function fmtMin(m: number): string {
  return `${Math.max(1, Math.round(m))} min`;
}

export function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}