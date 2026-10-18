import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from 'leaflet';
import type { LonLat, SpatialModel } from '../../types/domain';
import type { RouteResult } from '../../lib/routing/routeEngine';
import { DUBAI_DEFAULT_VIEW, mapBoundsFor } from '../../data/datasets';
import { ThermalFieldLayer } from './ThermalFieldLayer';
import { calculateBaseField } from '../../lib/heat/heatModel';

function MapPick({ onMapClick }: { onMapClick: (p: LonLat) => void }) {
  useMapEvents({ click(e: { latlng: LatLng }) { onMapClick({ lon: e.latlng.lng, lat: e.latlng.lat }); } }); return null;
}
function FitRoutes({ routes }: { routes: RouteResult[] }) {
  const map = useMap();
  useEffect(() => {
    const points = routes.flatMap((route) => route.geometry.map(([lon, lat]) => [lat, lon] as [number, number]));
    if (points.length > 1) map.fitBounds(points, { padding: [54, 54], maxZoom: 15, animate: true });
  }, [map, routes]);
  return null;
}
const colors = { Fastest: '#d97a1e', Balanced: '#6d8c68', Coolest: '#2f7f9e' } as const;

export function RouteMap({ model, hour, routes, origin, destination, activeId, onSelect, onMapClick }: {
  model: SpatialModel; hour: number; routes: RouteResult[]; origin: LonLat | null; destination: LonLat | null; activeId: string | null; onSelect: (id: string) => void; onMapClick: (p: LonLat) => void;
}) {
  const values = useMemo(() => calculateBaseField(model, hour), [model, hour]);
  const bounds = useMemo(() => mapBoundsFor(model), [model]);
  return <div className="route-map-wrap continuous-map-wrap">
    <MapContainer center={[DUBAI_DEFAULT_VIEW.lat, DUBAI_DEFAULT_VIEW.lon]} zoom={DUBAI_DEFAULT_VIEW.zoom} className="thermo-map" zoomControl={false} maxZoom={18} minZoom={9} maxBounds={bounds} maxBoundsViscosity={0.8} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors' maxZoom={18} noWrap />
      <ThermalFieldLayer model={model} values={values} opacity={0.32} contours />
      {routes.map((route) => <Polyline key={route.id} positions={route.geometry.map(([lon, lat]) => [lat, lon] as [number, number])} eventHandlers={{ click: () => onSelect(route.id) }} pathOptions={{ color: colors[route.label], weight: route.id === activeId ? 6 : 3.5, opacity: route.id === activeId ? 1 : 0.7, dashArray: route.id === activeId ? undefined : '4 6' }}><Tooltip sticky>{route.label} · {Math.round(route.averagePotential)} potential</Tooltip></Polyline>)}
      {origin && <CircleMarker center={[origin.lat, origin.lon]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: '#2f7f9e', fillOpacity: 1 }}><Tooltip permanent direction="top">Start</Tooltip></CircleMarker>}
      {destination && <CircleMarker center={[destination.lat, destination.lon]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d97a1e', fillOpacity: 1 }}><Tooltip permanent direction="top">End</Tooltip></CircleMarker>}
      <MapPick onMapClick={onMapClick} />
      <FitRoutes routes={routes} />
    </MapContainer>
    <div className="field-map-note"><span className="data-label">ROUTE COST</span><span>ETA + sampled modelled potential on each OSM edge</span></div>
    {!routes.length && <div className="route-map-hint"><span className="data-label">Choose start and end from the OSM place search, or click the map to set an end point.</span></div>}
  </div>;
}
