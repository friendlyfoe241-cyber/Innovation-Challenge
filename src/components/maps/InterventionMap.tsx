import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import type { HeatTile } from '../../types/domain';
import { HeatTileGrid } from './HeatTileGrid';
import { heatIndexFor } from '../../lib/heat/heatModel';
import { heatIndexAfter } from '../../lib/simulation/scenarioModel';

/**
 * Intervention Simulator map: renders the baseline heat grid and, when a
 * scenario is active, the same grid re-scored with the intervention offsets.
 * The study zone is highlighted with a ring so the comparison is legible.
 */
export function InterventionMap({
  tiles,
  applied,
  hour,
  active,
  center = [25.203, 55.28],
  radius = 900,
}: {
  tiles: HeatTile[];
  applied: HeatTile[];
  hour: number;
  active: boolean;
  center?: [number, number];
  radius?: number;
}) {
  return (
    <div className="thermo-map-wrap sim-map-wrap">
      <MapContainer center={center} zoom={14.2} className="thermo-map sim-map" zoomControl={false} attributionControl>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OSM contributors"
          maxZoom={18}
        />
        {/* Baseline grid — fades when a scenario is active. */}
        <HeatTileGrid tiles={tiles} hour={hour} opacity={active ? 0.22 : 0.55} />
        {/* Scenario grid scored with post-intervention offsets. */}
        {active && (
          <HeatTileGrid
            tiles={applied}
            hour={hour}
            opacity={0.6}
            heatFn={(t, h) => heatIndexAfter(t, h)}
          />
        )}
        <Circle
          center={center}
          radius={radius}
          pathOptions={{
            color: '#232a26',
            weight: 1.2,
            dashArray: '6 6',
            opacity: 0.65,
            fill: false,
          }}
          interactive={false}
        />
        {/* Reference readout for the study zone */}
        <BaselineBadge tiles={tiles} applied={applied} hour={hour} active={active} />
      </MapContainer>
    </div>
  );
}

function BaselineBadge({
  tiles,
  applied,
  hour,
  active,
}: {
  tiles: HeatTile[];
  applied: HeatTile[];
  hour: number;
  active: boolean;
}) {
  const zone = tiles.filter((t) => withinRadius(t, 55.28, 25.203, 900));
  const zoneApplied = applied.filter((t) => withinRadius(t, 55.28, 25.203, 900));
  const mean = (ts: HeatTile[], fn: (t: HeatTile, h: number) => number) =>
    Math.round(ts.reduce((s, t) => s + fn(t, hour), 0) / Math.max(1, ts.length));
  const base = mean(zone, heatIndexFor);
  const scen = active ? mean(zoneApplied, heatIndexAfter) : base;
  return (
    <div className="sim-badge">
      <span className="data-label">Study zone · Downtown core</span>
      <span className="mono">
        {base} → {scen} · {active ? `${Math.round(((base - scen) / base) * 100)}%` : 'baseline'}
      </span>
    </div>
  );
}

function withinRadius(t: HeatTile, lon: number, lat: number, radiusM: number): boolean {
  const d = Math.hypot((t.lon - lon) * 111320, (t.lat - lat) * 110540);
  return d <= radiusM;
}