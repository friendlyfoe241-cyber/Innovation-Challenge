import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LonLat, SpatialModel } from '../../types/domain';
import { DUBAI_DEFAULT_VIEW, GLOBAL_MAP_BOUNDS } from '../../data/datasets';
import { ThermalFieldLayer } from './ThermalFieldLayer';
import { GlobalThermalLayer } from './GlobalThermalLayer';
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
  const readout = useRef<HTMLSpanElement>(null);
  const values = useMemo(() => calculateBaseField(model, hour), [model, hour]);
  return <div className="thermo-map-wrap continuous-map-wrap">
    <MapContainer center={[DUBAI_DEFAULT_VIEW.lat, DUBAI_DEFAULT_VIEW.lon]} zoom={DUBAI_DEFAULT_VIEW.zoom} className="thermo-map" zoomControl={false} maxZoom={18} minZoom={2} maxBounds={GLOBAL_MAP_BOUNDS} maxBoundsViscosity={0.8} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors' maxZoom={18} noWrap />
      <GlobalThermalLayer />
      <ThermalFieldLayer model={model} values={values} opacity={0.72} contours />
      {selected && <CircleMarker center={[selected.lat, selected.lon]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d97a1e', fillOpacity: 1 }} />}
      <MapClick onPick={onPick} />
      <FocusPoint point={selected} />
      <CenterTracker target={readout} />
    </MapContainer>
    <div className="field-map-note"><span className="data-label">GLOBAL + LOCAL FIELD</span><span>NASA MODIS LST tiles load by viewport · Dubai modelled field remains {model.grid.cellSizeM} m · contours 40 / 55 / 70 / 82</span></div>
    <div className="map-cursor-readout"><span className="data-label">Cursor</span><span className="mono" ref={readout}>{DUBAI_DEFAULT_VIEW.lat.toFixed(4)}°N · {DUBAI_DEFAULT_VIEW.lon.toFixed(4)}°E</span><span className="prov-tag" data-prov="DERIVED">OSM-derived</span></div>
  </div>;
}
/**
 * Writes the map centre straight into the readout element. It used to call
 * setState on every `move` event, which re-rendered the whole map tree (and
 * rebuilt the thermal layer) on every pan frame.
 */
function CenterTracker({ target }: { target: React.RefObject<HTMLSpanElement | null> }) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const c = map.getCenter();
      if (target.current) target.current.textContent = `${c.lat.toFixed(4)}°N · ${c.lng.toFixed(4)}°E`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    map.on('move', schedule);
    return () => { map.off('move', schedule); if (frame) cancelAnimationFrame(frame); };
  }, [map, target]);
  return null;
}
