/** Curated checkpoints and landmark areas within the demo corridor. */

export interface Place {
  id: string;
  name: string;
  area?: string;
  lon: number;
  lat: number;
  kind: 'poi' | 'district' | 'school';
  note: string;
}

export const PLACES: Place[] = [
  { id: 'dubai-mall', name: 'Dubai Mall', area: 'Downtown Dubai', lon: 55.2798, lat: 25.1952, kind: 'poi', note: 'Level 1 entrance, Fashion Avenue' },
  { id: 'burj-khalifa', name: 'Burj Khalifa', area: 'Downtown Dubai', lon: 55.2742, lat: 25.1972, kind: 'poi', note: 'Tower base concourse' },
  { id: 'difc', name: 'DIFC', area: 'DIFC / Gate Village', lon: 55.2653, lat: 25.2087, kind: 'district', note: 'Gate Village, Al Mustaqbal Street' },
  { id: 'fountain', name: 'Dubai Fountain', area: 'Downtown Dubai', lon: 55.2773, lat: 25.1944, kind: 'poi', note: 'Promenade, lake-side walk' },
  { id: 'souq-al-bahar', name: 'Souk Al Bahar', area: 'Downtown Dubai', lon: 55.2755, lat: 25.1934, kind: 'poi', note: 'Lakeside piazza' },
  { id: 'business-bay', name: 'Business Bay', area: 'Business Bay', lon: 55.2861, lat: 25.2004, kind: 'district', note: 'Al Abraj Street' },
  { id: 'world-trade', name: 'World Trade Centre', area: 'Trade Centre', lon: 55.2825, lat: 25.2253, kind: 'poi', note: 'Convention Roundabout' },
  { id: 'zabeel-park', name: 'Zabeel Park', area: 'Zabeel', lon: 55.2959, lat: 25.2352, kind: 'poi', note: 'South gate, garden walk' },
  { id: 'sheikh-zayed', name: 'Sheikh Zayed Road', area: 'Sheikh Zayed', lon: 55.2772, lat: 25.2199, kind: 'district', note: 'Median pedestrian crossing' },
  { id: 'gems-wellington', name: 'GEMS Wellington Primary', area: 'Al Safa 2', lon: 55.27148, lat: 25.21137, kind: 'school', note: 'Campus entrance (OSM)' },
  { id: 'al-manhal', name: 'Al-Manhal Kindergarten', area: 'Al Safa', lon: 55.26882, lat: 25.21817, kind: 'school', note: 'Campus (OSM)' },
  { id: 'ue-europe', name: 'University of Europe (Dubai)', area: 'Zabeel', lon: 55.28556, lat: 25.22106, kind: 'school', note: 'Campus (OSM)' },
];

/** District polygons (approx) for area-level queries. */
export interface District {
  id: string;
  name: string;
  lon: number;
  lat: number;
  radiusM: number;
}

export const DISTRICTS: District[] = [
  { id: 'downtown', name: 'Downtown Dubai', lon: 55.2765, lat: 25.1965, radiusM: 700 },
  { id: 'difc', name: 'DIFC', lon: 55.2653, lat: 25.2087, radiusM: 550 },
  { id: 'business-bay', name: 'Business Bay', lon: 55.286, lat: 25.201, radiusM: 800 },
  { id: 'zabeel', name: 'Zabeel', lon: 55.2959, lat: 25.2352, radiusM: 750 },
  { id: 'gems-wellington', name: 'GEMS Wellington Campus', lon: 55.27148, lat: 25.21137, radiusM: 320 },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

export function findPlace(query: string): Place[] {
  const q = query.toLowerCase().trim();
  if (!q) return PLACES;
  return PLACES.filter(
    (p) => p.name.toLowerCase().includes(q) || p.area?.toLowerCase().includes(q),
  );
}