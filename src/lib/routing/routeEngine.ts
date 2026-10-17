/**
 * Genuine walk/cycle routing through Valhalla's OSM network.
 *
 * The public provider does not accept arbitrary THERMO edge weights. THERMO
 * therefore samples the initial real OSM path, then submits a bounded set of
 * high-potential samples as `exclude_locations` before each follow-on network
 * search. Valhalla maps those locations to OSM edges and excludes them during
 * its own pathfinding: alternatives are not post-route re-rankings.
 */
import type { LonLat, RouteChoice, RouteMode, SpatialModel } from '../../types/domain';
import { HIGH_HEAT_THRESHOLD, calculateBaseField, createFieldSampler } from '../heat/heatModel';

export interface RouteResult {
  id: string;
  label: RouteChoice;
  geometry: [number, number][];
  distanceM: number;
  durationMin: number;
  averagePotential: number;
  peakPotential: number;
  highHeatMin: number;
  cost: number;
  thermalRule: string;
}
export interface RouteOptions { mode: RouteMode; hour: number; }

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
interface ProviderTrip { summary?: { length?: number; time?: number }; legs?: Array<{ shape?: string }> }
interface ProviderResponse { trip?: ProviderTrip; alternates?: Array<{ trip?: ProviderTrip }> }

function decodePolyline6(shape: string): [number, number][] {
  let index = 0; let lat = 0; let lon = 0; const points: [number, number][] = [];
  const read = () => { let result = 0; let shift = 0; let byte = 0; do { byte = shape.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); return result & 1 ? ~(result >> 1) : result >> 1; };
  while (index < shape.length) { lat += read(); lon += read(); points.push([lon / 1e6, lat / 1e6]); }
  return points;
}
function distanceM(a: LonLat, b: LonLat) { return Math.hypot((a.lon - b.lon) * 100_800, (a.lat - b.lat) * 110_540); }

/** Select separated, mapped route points whose shared field value is high. */
function exclusionLocations(model: SpatialModel, values: Map<number, number>, geometry: [number, number][], from: LonLat, to: LonLat, threshold: number, maximum: number) {
  const sample = createFieldSampler(model, values);
  const candidates = geometry.map(([lon, lat]) => ({ lon, lat, value: sample(lon, lat)?.value ?? 0 }))
    .filter((point) => point.value >= threshold && distanceM(point, from) > 500 && distanceM(point, to) > 500)
    .sort((a, b) => b.value - a.value);
  const chosen: Array<{ lon: number; lat: number }> = [];
  for (const candidate of candidates) {
    if (chosen.length >= maximum) break;
    if (chosen.every((point) => distanceM(point, candidate) >= 180)) chosen.push({ lon: candidate.lon, lat: candidate.lat });
  }
  return chosen;
}
async function requestProvider(from: LonLat, to: LonLat, mode: RouteMode, excluded: Array<{ lon: number; lat: number }>) {
  const payload: Record<string, unknown> = {
    locations: [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }],
    costing: mode === 'walk' ? 'pedestrian' : 'bicycle', units: 'kilometers', alternates: 2, language: 'en-US',
  };
  if (excluded.length) payload.exclude_locations = excluded.map(({ lon, lat }) => ({ lon, lat }));
  const url = `${VALHALLA_URL}?${new URLSearchParams({ json: JSON.stringify(payload) })}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Routing provider returned ${response.status}`);
  const body = await response.json() as ProviderResponse;
  return [body.trip, ...(body.alternates ?? []).map((item) => item.trip)].filter((trip): trip is ProviderTrip => Boolean(trip?.legs?.[0]?.shape));
}
function metrics(model: SpatialModel, values: Map<number, number>, trip: ProviderTrip, label: RouteChoice, thermalRule: string): RouteResult | null {
  const geometry = decodePolyline6(trip.legs?.[0]?.shape ?? ''); if (geometry.length < 2) return null;
  const sample = createFieldSampler(model, values); let total = 0; let weighted = 0; let high = 0; let peak = 0;
  for (let i = 1; i < geometry.length; i++) {
    const a = { lon: geometry[i - 1][0], lat: geometry[i - 1][1] }; const b = { lon: geometry[i][0], lat: geometry[i][1] }; const distance = distanceM(a, b);
    const potential = sample((a.lon + b.lon) / 2, (a.lat + b.lat) / 2)?.value ?? 55;
    total += distance; weighted += potential * distance; if (potential >= HIGH_HEAT_THRESHOLD) high += distance; peak = Math.max(peak, potential);
  }
  const reportedM = (trip.summary?.length ?? total / 1000) * 1000; const durationMin = (trip.summary?.time ?? (reportedM / 1.25)) / 60;
  return { id: label.toLowerCase(), label, geometry, distanceM: reportedM, durationMin, averagePotential: Math.round(weighted / Math.max(1, total)), peakPotential: Math.round(peak), highHeatMin: Math.round(durationMin * high / Math.max(1, total) * 10) / 10, cost: durationMin, thermalRule };
}
function signature(route: RouteResult) { const stride = Math.max(1, Math.floor(route.geometry.length / 30)); return route.geometry.filter((_, index) => index % stride === 0).map(([lon, lat]) => `${lon.toFixed(4)},${lat.toFixed(4)}`).join('|'); }
function improvesExposure(route: RouteResult, fastest: RouteResult) {
  return route.averagePotential < fastest.averagePotential || route.peakPotential < fastest.peakPotential || route.highHeatMin < fastest.highHeatMin;
}

export async function computeRoutes(model: SpatialModel, from: LonLat, to: LonLat, options: RouteOptions): Promise<RouteResult[]> {
  const values = calculateBaseField(model, options.hour);
  const fastTrips = await requestProvider(from, to, options.mode, []);
  const fastest = fastTrips.map((trip) => metrics(model, values, trip, 'Fastest', 'No thermal exclusion; provider minimises travel cost.')).find((route): route is RouteResult => Boolean(route));
  if (!fastest) return [];
  const result: RouteResult[] = [fastest]; const seen = new Set([signature(fastest)]);
  const profiles: Array<{ label: Exclude<RouteChoice, 'Fastest'>; threshold: number; maximum: number; rule: string }> = [
    { label: 'Balanced', threshold: 77, maximum: 3, rule: 'Provider excludes up to 3 very-high-potential OSM edges sampled on the fastest path before a new search.' },
    { label: 'Coolest', threshold: 72, maximum: 4, rule: 'Provider excludes up to 4 high-potential OSM edges sampled on the fastest path before a new search.' },
  ];
  for (const profile of profiles) {
    const exclusions = exclusionLocations(model, values, fastest.geometry, from, to, profile.threshold, profile.maximum);
    if (!exclusions.length) continue;
    try {
      const trips = await requestProvider(from, to, options.mode, exclusions);
      const valid = trips.map((trip) => metrics(model, values, trip, profile.label, profile.rule)).filter((route): route is RouteResult => Boolean(route))
        .find((route) => route.durationMin <= fastest.durationMin * 1.5 && route.distanceM <= fastest.distanceM * 1.45 && (profile.label === 'Coolest' ? route.averagePotential < fastest.averagePotential : improvesExposure(route, fastest)) && !seen.has(signature(route)));
      if (valid) { seen.add(signature(valid)); result.push(valid); }
    } catch { /* A constrained route may have no feasible network path. Keep valid prior routes. */ }
  }
  return result;
}

export const fmtMin = (minutes: number) => `${Math.max(1, Math.round(minutes))} min`;
export const fmtKm = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
export function routeTagline(route: RouteResult) { return route.thermalRule; }
