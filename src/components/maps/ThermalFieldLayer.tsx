import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { SpatialModel } from '../../types/domain';
import { createFieldSampler } from '../../lib/heat/heatModel';

type Palette = 'thermal' | 'difference';

const thermalStops = [[48, 125, 120], [112, 151, 95], [217, 169, 78], [217, 119, 31], [180, 82, 28]];
const cold = [42, 122, 143]; const neutral = [242, 238, 223]; const hot = [189, 78, 44];
function lerp(a: number[], b: number[], t: number) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function rgbFor(value: number, palette: Palette) {
  if (palette === 'difference') return value < 0 ? lerp(cold, neutral, Math.min(1, -value / 18)) : lerp(neutral, hot, Math.min(1, value / 18));
  const scaled = Math.min(0.9999, Math.max(0, value / 100)) * (thermalStops.length - 1); const i = Math.floor(scaled);
  return lerp(thermalStops[i], thermalStops[i + 1], scaled - i);
}
function edgePoint(level: number, a: [number, number, number], b: [number, number, number]) {
  const t = (level - a[2]) / (b[2] - a[2] || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as [number, number];
}

/** Canvas raster with source-grid contours; transparent where source support is absent. */
export function ThermalFieldLayer({
  model, values, opacity = 0.7, palette = 'thermal', contours = true,
}: { model: SpatialModel; values: Map<number, number>; opacity?: number; palette?: Palette; contours?: boolean }) {
  const map = useMap();
  const sampler = useMemo(() => createFieldSampler(model, values), [model, values]);

  useEffect(() => {
    const paneName = 'thermo-thermal-field';
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.zIndex = '360'; pane.style.pointerEvents = 'none';
    const canvas = L.DomUtil.create('canvas', 'thermo-field-canvas') as HTMLCanvasElement;
    pane.appendChild(canvas);

    const redraw = () => {
      const size = map.getSize(); if (!size.x || !size.y) return;
      canvas.width = size.x; canvas.height = size.y; canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      const context = canvas.getContext('2d'); if (!context) return;
      const renderW = Math.max(180, Math.min(520, Math.round(size.x * 0.48)));
      const renderH = Math.max(140, Math.round(renderW * size.y / size.x));
      const buffer = document.createElement('canvas'); buffer.width = renderW; buffer.height = renderH;
      const bctx = buffer.getContext('2d')!; const image = bctx.createImageData(renderW, renderH); const pixels = image.data;
      for (let y = 0; y < renderH; y++) for (let x = 0; x < renderW; x++) {
        const point = map.containerPointToLatLng([((x + 0.5) / renderW) * size.x, ((y + 0.5) / renderH) * size.y]);
        const sample = sampler(point.lng, point.lat); if (!sample) continue;
        const [r, g, b] = rgbFor(sample.value, palette); const i = (y * renderW + x) * 4;
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = Math.round(255 * opacity);
      }
      bctx.putImageData(image, 0, 0); context.imageSmoothingEnabled = true; context.clearRect(0, 0, size.x, size.y); context.drawImage(buffer, 0, 0, size.x, size.y);
      if (contours && palette === 'thermal') drawContours(context, map, model, values);
    };
    redraw(); map.on('moveend zoomend resize', redraw);
    return () => { map.off('moveend zoomend resize', redraw); canvas.remove(); };
  }, [map, model, values, sampler, opacity, palette, contours]);
  return null;
}

function drawContours(ctx: CanvasRenderingContext2D, map: L.Map, model: SpatialModel, values: Map<number, number>) {
  const byId = new Map(model.cells.map((cell) => [cell.id, cell]));
  const lookup = (r: number, c: number) => byId.get(r * model.grid.cols + c);
  const cases: Record<number, Array<[number, number]>> = {
    1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [0, 1]], 6: [[0, 2]], 7: [[3, 2]],
    8: [[2, 3]], 9: [[0, 2]], 10: [[0, 3], [1, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
  };
  ctx.save(); ctx.strokeStyle = 'rgba(24,31,28,0.52)'; ctx.lineWidth = 0.7;
  for (const level of [40, 55, 70, 82]) {
    ctx.beginPath();
    for (let r = 0; r < model.grid.rows - 1; r++) for (let c = 0; c < model.grid.cols - 1; c++) {
      const tl = lookup(r, c); const tr = lookup(r, c + 1); const br = lookup(r + 1, c + 1); const bl = lookup(r + 1, c);
      if (!tl || !tr || !br || !bl) continue;
      const vals = [values.get(tl.id), values.get(tr.id), values.get(br.id), values.get(bl.id)]; if (vals.some((v) => v === undefined)) continue;
      const mask = (vals[0]! >= level ? 1 : 0) | (vals[1]! >= level ? 2 : 0) | (vals[2]! >= level ? 4 : 0) | (vals[3]! >= level ? 8 : 0);
      const segments = cases[mask]; if (!segments) continue;
      const p = [
        [tl.lon, tl.lat, vals[0]!], [tr.lon, tr.lat, vals[1]!], [br.lon, br.lat, vals[2]!], [bl.lon, bl.lat, vals[3]!],
      ] as [number, number, number][];
      const edges = [edgePoint(level, p[0], p[1]), edgePoint(level, p[1], p[2]), edgePoint(level, p[2], p[3]), edgePoint(level, p[3], p[0])];
      for (const [a, b] of segments) { const pa = map.latLngToContainerPoint([edges[a][1], edges[a][0]]); const pb = map.latLngToContainerPoint([edges[b][1], edges[b][0]]); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); }
    }
    ctx.stroke();
  }
  ctx.restore();
}
