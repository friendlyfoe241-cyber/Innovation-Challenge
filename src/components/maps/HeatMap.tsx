import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LonLat, SpatialModel } from '../../types/domain';
import { DUBAI_DEFAULT_VIEW } from '../../data/datasets';
import { ThermalFieldLayer } from './ThermalFieldLayer';
import { calculateBaseField } from '../../lib/heat/heatModel';

export interface SelectedPoint extends LonLat { label: string; }

function MapClick({ onPick }: { onPick: (p: SelectedPoint) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onPick({ lon: e.latlng.lng, lat: e.latlng.lat, label: `Dropped pin · ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}` }); } });
  return null;
}
function FocusPoint({ point }: { point: SelectedPoint | null }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 13), { duration: 0.8 }); }, [map, point]);
  return null;
}

export function HeatMap({ model, hour, selected, onPick }: { model: SpatialModel; hour: number; selected: SelectedPoint | null; onPick: (p: SelectedPoint) => void }) {
  const [cursor, setCursor] = useState<LonLat>({ lon: DUBAI_DEFAULT_VIEW.lon, lat: DUBAI_DEFAULT_VIEW.lat });
  const values = calculateBaseField(model, hour);
  return <div className="thermo-map-wrap continuous-map-wrap">
    <MapContainer center={[DUBAI_DEFAULT_VIEW.lat, DUBAI_DEFAULT_VIEW.lon]} zoom={DUBAI_DEFAULT_VIEW.zoom} className="thermo-map" zoomControl={false} maxZoom={18} minZoom={9} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors' maxZoom={18} />
      <ThermalFieldLayer model={model} values={values} opacity={0.72} contours />
      {selected && <CircleMarker center={[selected.lat, selected.lon]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d97a1e', fillOpacity: 1 }} />}
      <MapClick onPick={onPick} />
      <FocusPoint point={selected} />
      <MapCenter onMove={setCursor} />
    </MapContainer>
    <div className="field-map-note"><span className="data-label">MODELLED FIELD</span><span>smooth display · {model.grid.cellSizeM} m source cells · contours 40 / 55 / 70 / 82</span></div>
    <div className="map-cursor-readout"><span className="data-label">Cursor</span><span className="mono">{cursor.lat.toFixed(4)}°N · {cursor.lon.toFixed(4)}°E</span><span className="prov-tag" data-prov="DERIVED">OSM-derived</span></div>
  </div>;
}
function MapCenter({ onMove }: { onMove: (p: LonLat) => void }) {
  useMapEvents({ move(e: L.LeafletEvent) { const center = e.target.getCenter(); onMove({ lon: center.lng, lat: center.lat }); } });
  return null;
}
