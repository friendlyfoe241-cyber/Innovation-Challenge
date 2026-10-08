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
import type { Graph, GraphNode, LonLat, TimeOfDay } from '../../types/domain';
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
function edgeMidTile(e: { mid: [number, number] }): {
  lon: number; lat: number; r: number; c: number; b: number; p: number; g: number; wt: number; pd: number; h: number;
} {
  return { lon: e.mid[0], lat: e.mid[1], r: 0, c: 0, b: 0, p: 0, g: 0, wt: 0, pd: 0, h: 0 };
}

/**
 * Compute the Fastest / Balanced / Cooler alternatives.
 */
export function computeRoutes(graph: Graph, from: LonLat, to: LonLat, opts: RouteOptions): RouteResult[] {
  const hour = opts.hour ?? 14;
  const a = snapNode(graph, from);
  const b = snapNode(graph, to);
  if (!a || !b) return [];

  // ---- precompute per-edge exposure
  const heatByEdge = new Map<number, number>();
  const surfByEdge = new Map<number, number>();
  for (const e of graph.edges) {
    const mid = edgeMidTile(e);
    const hi = heatIndexFor(mid, hour);
    heatByEdge.set(edgeKey(e.a, e.b), hi);
    surfByEdge.set(edgeKey(e.a, e.b), airTempAtTile(mid, hour));
  }

  const SPEED_MPS = opts.walkingSpeed / 3.6;

  // Dijkstra with a custom edge length.
  const dijk = (costFn: (w: { hi: number; len: number }) => number): Map<number, number> => {
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
        const w = costFn({ hi, len: e.len });
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

  const parentFast = dijk(({ len }) => len);
  const parentCool = dijk(({ hi, len }) => len * (0.35 + (hi / 100) * 1.75));
  // Balanced: blend distance and exposure by the user preference.
  const parentBal = dijk(({ hi, len }) => len * (1 - 0.42 * pref + (hi / 100) * 1.5 * pref));

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
      segs.push({ from: n0, to: n1, dist: d, exposed, surfaceTemp: st, heatIndex: hi, cls: '' });
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
    };
  };

  const routes: RouteResult[] = [];
  const seen = new Set<string>();
  const push = (r: RouteResult | null) => {
    if (!r) return;
    const sig = r.geometry.slice(0, 8).map((p) => p.map((v) => v.toFixed(4)).join(',')).join('|');
    if (seen.has(sig)) return;
    seen.add(sig);
    routes.push(r);
  };

  push(trace(parentFast));
  push(trace(parentBal));
  push(trace(parentCool));
  if (routes.length < 2) push(trace(dijk(({ hi, len }) => len * (0.18 + (hi / 100) * 2.2))));
  if (routes.length < 2) push(trace(dijk(({ hi, len }) => len * (0.02 + (hi / 18)))));

  routes.sort((x, y) => x.durationMin - y.durationMin);
  return routes;
}

/** Human-readable tagline for a route in the result list. */
export function routeTagline(route: RouteResult, indexInTrip: number): string {
  if (indexInTrip === 0) return 'Fastest option';
  if (route.heatScore < 34) return 'Recommended for lower heat exposure';
  if (route.heatScore < 50) return 'Best balance between time and heat exposure';
  return 'Cooler option';
}

export function fmtMin(m: number): string {
  return `${Math.max(1, Math.round(m))} min`;
}

export function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}