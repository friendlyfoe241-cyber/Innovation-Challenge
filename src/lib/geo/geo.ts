import type { LonLat } from '../../types/domain';

/** Geographic constants and helpers (WGS84). */
export const METER_PER_DEG_LON = 111320;
export const METER_PER_DEG_LAT = 110540;

export interface Meters {
  x: number;
  y: number;
}

/** Convert decimal degrees to a local south-westerly metre frame. */
export function toMeters(p: LonLat): Meters {
  return { x: p.lon * METER_PER_DEG_LON, y: p.lat * METER_PER_DEG_LAT };
}

export function fromMeters(m: Meters): LonLat {
  return { lon: m.x / METER_PER_DEG_LON, lat: m.y / METER_PER_DEG_LAT };
}

export function haversine(a: LonLat, b: LonLat): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function distMeters(a: LonLat, b: LonLat): number {
  const dx = (b.lon - a.lon) * METER_PER_DEG_LON;
  const dy = (b.lat - a.lat) * METER_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Haversine-agnostic approximate distance in metres. */
export function bearing(a: LonLat, b: LonLat): number {
  const dy = (b.lat - a.lat) * METER_PER_DEG_LAT;
  const dx = (b.lon - a.lon) * METER_PER_DEG_LON;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/** Snapped grid of lat/lon around points for approximate-map math. */
export function bboxFor(points: LonLat[], padMeters = 0): { s: number; w: number; n: number; e: number } {
  let s = 90, w = 180, n = -90, e = -180;
  for (const p of points) {
    if (p.lat < s) s = p.lat;
    if (p.lat > n) n = p.lat;
    if (p.lon < w) w = p.lon;
    if (p.lon > e) e = p.lon;
  }
  const py = padMeters / METER_PER_DEG_LAT;
  const px = padMeters / METER_PER_DEG_LON;
  return { s: s - py, w: w - px, n: n + py, e: e + px };
}

export function clampLonLat(p: LonLat, bbox: { s: number; w: number; n: number; e: number }): LonLat {
  return {
    lon: Math.min(bbox.e, Math.max(bbox.w, p.lon)),
    lat: Math.min(bbox.n, Math.max(bbox.s, p.lat)),
  };
}