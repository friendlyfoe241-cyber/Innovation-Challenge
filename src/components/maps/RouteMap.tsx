import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import type { LatLng } from 'leaflet';

export interface PickedRoute {
  geometry: [number, number][];
  id: string;
  heatScore: number;
  selected: boolean;
}

/** Picks a point on the map and reports it for origin/destination editing. */
function MapPick({ onMapClick }: { onMapClick: (p: { lon: number; lat: number }) => void }) {
  useMapEvents({
    click(e: { latlng: LatLng }) {
      onMapClick({ lon: e.latlng.lng, lat: e.latlng.lat });
    },
  });
  return null;
}

export function RouteMap({
  routes,
  origin,
  destination,
  onMapClick,
}: {
  routes: PickedRoute[];
  origin: { lon: number; lat: number } | null;
  destination: { lon: number; lat: number } | null;
  onMapClick: (p: { lon: number; lat: number }) => void;
}) {
  return (
    <div className="route-map-wrap">
      <MapContainer center={[25.203, 55.279]} zoom={13.2} className="thermo-map" zoomControl={false} maxZoom={18}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        />
        {/* faint heat backdrop intentionally omitted for route clarity */}
        {routes
          .filter((r) => r.selected)
          .map((r) => (
            <Polyline
              key={r.id}
              positions={r.geometry as [number, number][]}
              pathOptions={{
                color: '#d97a1e',
                weight: 5,
                opacity: 0.95,
              }}
            />
          ))}
        {routes
          .filter((r) => !r.selected)
          .map((r) => (
            <Polyline key={r.id} positions={r.geometry as [number, number][]} pathOptions={{ color: '#8a9a5b', weight: 3, opacity: 0.5, dashArray: '2 6' }} />
          ))}
        {origin && <CircleMarker center={[origin.lat, origin.lon]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#2f7f9e', fillOpacity: 1 }} />}
        {destination && <CircleMarker center={[destination.lat, destination.lon]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d97a1e', fillOpacity: 1 }} />}
        <MapPick onMapClick={onMapClick} />
      </MapContainer>
      {routes.length === 0 && (
        <div className="route-map-hint">
          <span className="data-label">Pick two points to find a cooler way</span>
        </div>
      )}
    </div>
  );
}