import { memo } from 'react';
import { LayerGroup, Rectangle } from 'react-leaflet';
import type { HeatTile } from '../../types/domain';
import { heatIndexFor, heatBand, bandColor } from '../../lib/heat/heatModel';

function cellSize(tiles: HeatTile[]): { x: number; y: number } {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const t of tiles) {
    if (t.lon < minLon) minLon = t.lon;
    if (t.lon > maxLon) maxLon = t.lon;
    if (t.lat < minLat) minLat = t.lat;
    if (t.lat > maxLat) maxLat = t.lat;
  }
  const n = Math.max(1, Math.sqrt(tiles.length));
  return { x: (maxLon - minLon) / n, y: (maxLat - minLat) / n };
}

/**
 * The urban heat grid: per-tile rectangles coloured by the THERMO Heat
 * Exposure Index for the selected hour. Re-computes only when hour changes.
 */
export const HeatTileGrid = memo(function HeatTileGrid({
  tiles,
  hour,
  opacity = 0.62,
}: {
  tiles: HeatTile[];
  hour: number;
  opacity?: number;
}) {
  const { x, y } = cellSize(tiles);
  return (
    <LayerGroup>
      {tiles.map((t) => {
        const hi = heatIndexFor(t, hour);
        const band = heatBand(hi);
        const col = bandColor(band);
        return (
          <Rectangle
            key={`${t.r}-${t.c}`}
            bounds={[
              [t.lat - y / 2, t.lon - x / 2],
              [t.lat + y / 2, t.lon + x / 2],
            ]}
            pathOptions={{
              color: col,
              weight: 0.6,
              opacity: 0.45,
              fillColor: col,
              fillOpacity: opacity * (0.55 + (hi / 100) * 0.4),
            }}
            interactive={false}
          />
        );
      })}
    </LayerGroup>
  );
});