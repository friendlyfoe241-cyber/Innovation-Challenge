import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LineFeature, LayerBundle, HeatTile } from '../../types/domain';
import { HeatTileGrid } from './HeatTileGrid';
import type { Place } from '../../data/places';
import { PLACES } from '../../data/places';

export interface LayerFlags {
  heat: boolean;
  vegetation: boolean;
  built: boolean;
  water: boolean;
  roads: boolean;
  pois: boolean;
  districts: boolean;
}

export interface SelectedPoint {
  lat: number;
  lon: number;
  label: string;
}

function MapClick({ onPick }: { onPick: (p: SelectedPoint) => void }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      const { lat, lng } = e.latlng;
      // nearest curated place within ~600 m else generic readout
      let best: Place | null = null;
      let bestD = 0.012;
      for (const p of PLACES) {
        const d = Math.hypot(p.lat - lat, p.lon - lng);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      onPick({
        lat,
        lon: lng,
        label: best
          ? `${best.name}${best.area ? ` · ${best.area}` : ''}`
          : `At ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
    },
  });
  return null;
}

/** Follows the map bounds to report a crosshair coordinate readout. */
function CrosshairReadout({ onMove }: { onMove: (c: { lat: number; lon: number }) => void }) {
  const map = useMapEvents({
    move(e: L.LeafletEvent) {
      const c = e.target.getCenter();
      onMove({ lat: c.lat, lon: c.lng });
    },
  });
  void map;
  return null;
}

function FitBounds({ fit }: { fit: number }) {
  const map = useMap();
  useEffect(() => {
    if (fit <= 0) return;
    const t = 0;
    map.flyTo([25.203, 55.279], Math.max(12, Math.min(16, 14 + t)), { duration: 1.1 });
    void t;
  }, [fit, map]);
  return null;
}

export function HeatMap({
  hour,
  layersFlags,
  onPick,
  selected,
  focusSignal,
  layers,
  gridTiles,
}: {
  hour: number;
  layersFlags: LayerFlags;
  onPick: (p: SelectedPoint) => void;
  selected: SelectedPoint | null;
  focusSignal: number;
  layers: LayerBundle | null;
  gridTiles: HeatTile[];
}) {
  const [cursor, setCursor] = useState({ lat: 25.203, lon: 55.279 });
  const heatOpacity = layersFlags.heat ? 0.6 : 0;

  return (
    <div className="thermo-map-wrap">
      <MapContainer
        center={[25.203, 55.279]}
        zoom={13.2}
        className="thermo-map"
        zoomControl={false}
        attributionControl
        maxZoom={18}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          maxZoom={18}
        />
        {layersFlags.heat && <HeatTileGrid tiles={gridTiles} hour={hour} opacity={heatOpacity} />}
        {layersFlags.built && layers?.buildings.slice(0, 6000).map((b, i) => (
            <Polygon
              key={`b-${i}`}
              positions={b.g as [number, number][]}
              pathOptions={{ color: '#3d4a44', weight: 0.5, fillColor: '#2e3833', fillOpacity: 0.55 }}
              interactive={false}
            />
          ))}
        {layersFlags.water && layers?.water.map((w, i) => (
            <Polygon
              key={`w-${i}`}
              positions={w.g as [number, number][]}
              pathOptions={{ color: '#2f7f9e', weight: 0.5, fillColor: '#5aa9bd', fillOpacity: 0.55 }}
              interactive={false}
            />
          ))}
        {layersFlags.vegetation && layers?.green.map((g, i) => (
            <Polygon
              key={`g-${i}`}
              positions={g.g as [number, number][]}
              pathOptions={{ color: '#4f7d4c', weight: 0.5, fillColor: '#5f945a', fillOpacity: 0.5 }}
              interactive={false}
            />
          ))}
        {layersFlags.roads && layers?.roads.slice(0, 2600).map((r: LineFeature, i) => (
            <Polyline
              key={`r-${i}`}
              positions={r.g as [number, number][]}
              pathOptions={{ color: 'rgba(35,42,38,0.16)', weight: r.cls === 'primary' || r.cls === 'motorway' ? 2.6 : 1.4 }}
              interactive={false}
            />
          ))}
        {layersFlags.pois && (
          <>
            {PLACES.filter((p) => p.kind === 'school').map((p, i) => (
              <CircleMarker
                key={`school-${i}`}
                center={[p.lat, p.lon]}
                radius={9}
                pathOptions={{ color: '#7a4a1f', weight: 1.4, fillColor: '#d9a94e', fillOpacity: 0.9 }}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
              </CircleMarker>
            ))}
          </>
        )}

        {selected && (
          <CircleMarker center={[selected.lat, selected.lon]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d97a1e', fillOpacity: 1 }} />
        )}

        <MapClick onPick={onPick} />
        <CrosshairReadout onMove={(c) => setCursor(c)} />
        <FitBounds fit={focusSignal} />
      </MapContainer>
      <div className="map-crosshair" aria-hidden="true">
        <span className="crosshair-dot" />
      </div>
      <div className="map-cursor-readout">
        <span className="data-label">Cursor</span>
        <span className="mono">
          {cursor.lat.toFixed(4)}°N · {cursor.lon.toFixed(4)}°E
        </span>
        <span className="prov-tag" data-prov="OBSERVED">
          OSM base
        </span>
      </div>
    </div>
  );
}