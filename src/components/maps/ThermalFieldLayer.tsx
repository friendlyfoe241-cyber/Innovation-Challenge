import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { SpatialModel } from '../../types/domain';
import { buildDenseField, type DenseField } from '../../lib/heat/heatModel';

type Palette = 'thermal' | 'difference';

/**
 * Continuous thermal-field layer.
 *
 * Performance / correctness notes
 *  - The field is rasterised ONCE per (model, values, palette) into a small
 *    canvas that covers only the supported cells, and handed to Leaflet as an
 *    ImageOverlay. Leaflet then pans and zooms it with GPU-accelerated CSS
 *    transforms, so panning and zooming never trigger a per-frame redraw.
 *    (The previous version re-sampled every screen pixel on every
 *    moveend/zoomend, and re-ran whenever the parent re-rendered.)
 *  - Colours are produced by interpolating the scalar field (bicubic where all
 *    16 neighbours are supported, mask-normalised bilinear near the edge of
 *    the data), never by blending cell colours.
 *  - Support is honoured: pixels more than about half a source cell from a
 *    supported cell stay transparent. Nothing is extrapolated, and nothing is
 *    drawn outside the grid, so the pattern cannot repeat when zoomed out.
 *  - Contours are traced on the same interpolated field and drawn as vector
 *    lines (canvas renderer), so they stay crisp at any zoom.
 */

const PAD_CELLS = 1;
const RASTER_PX_PER_CELL = 4;
const CONTOUR_PX_PER_CELL = 3;
const CONTOUR_LEVELS = [40, 55, 70, 82];
/** Contours are hidden when zoomed far out, where they only add clutter. */
const CONTOUR_MIN_ZOOM = 9;

const thermalStops = [[48, 125, 120], [112, 151, 95], [217, 169, 78], [217, 119, 31], [180, 82, 28]];
const cold = [42, 122, 143]; const neutral = [242, 238, 223]; const hot = [189, 78, 44];

function lerpRgb(a: number[], b: number[], t: number, out: number[]) {
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
}
function colorFor(value: number, palette: Palette, out: number[]) {
  if (palette === 'difference') {
    if (value < 0) lerpRgb(cold, neutral, Math.min(1, -value / 18), out);
    else lerpRgb(neutral, hot, Math.min(1, value / 18), out);
    return;
  }
  const scaled = Math.min(0.9999, Math.max(0, value / 100)) * (thermalStops.length - 1);
  const i = Math.floor(scaled);
  lerpRgb(thermalStops[i], thermalStops[i + 1], scaled - i, out);
}

/**
 * ImageOverlay that displays a canvas directly. Leaflet's own ImageOverlay only
 * accepts an <img>, which would force a PNG encode + decode on every field update.
 * The canvas is scaled by the browser (smooth), and panned/zoomed by Leaflet's
 * normal CSS-transform overlay machinery.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CanvasOverlay = (L.ImageOverlay as any).extend({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialize(this: any, canvas: HTMLCanvasElement, bounds: L.LatLngBounds, options: L.ImageOverlayOptions) {
    this._canvas = canvas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (L.ImageOverlay.prototype as any).initialize.call(this, '', bounds, options);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _initImage(this: any) {
    const el: HTMLCanvasElement = this._canvas;
    this._image = el;
    L.DomUtil.addClass(el, 'leaflet-image-layer');
    if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
    if (this.options.className) L.DomUtil.addClass(el, this.options.className);
    el.onselectstart = L.Util.falseFn as () => false;
    el.onmousemove = L.Util.falseFn as () => false;
    if (this.options.zIndex) this._updateZIndex();
  },
}) as new (canvas: HTMLCanvasElement, bounds: L.LatLngBounds, options: L.ImageOverlayOptions) => L.ImageOverlay;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Catmull-Rom weights for fractional offset t. */
function cr(t: number, w: Float64Array) {
  const t2 = t * t; const t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
}

interface Window { r0: number; r1: number; c0: number; c1: number; }

/** Smallest cell window containing every supported cell, padded. */
function supportWindow(dense: DenseField): Window | null {
  const { rows, cols, val } = dense;
  let r0 = rows, r1 = -1, c0 = cols, c1 = -1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (Number.isNaN(val[r * cols + c])) continue;
    if (r < r0) r0 = r; if (r > r1) r1 = r; if (c < c0) c0 = c; if (c > c1) c1 = c;
  }
  if (r1 < 0) return null;
  return { r0: Math.max(0, r0 - PAD_CELLS), r1: Math.min(rows - 1, r1 + PAD_CELLS), c0: Math.max(0, c0 - PAD_CELLS), c1: Math.min(cols - 1, c1 + PAD_CELLS) };
}

/**
 * Sample the continuous field on a regular pixel grid in (lon, mercator-y)
 * space. Returns value + coverage per pixel. Coverage is 0 outside the
 * supported area.
 */
function sampleField(model: SpatialModel, dense: DenseField, win: Window, pxPerCell: number) {
  const { grid } = model;
  const { rows, cols, val } = dense;
  const west = grid.w + (win.c0 - 0.5) * grid.cellLon;
  const east = grid.w + (win.c1 + 1.5) * grid.cellLon;
  const south = grid.s + (win.r0 - 0.5) * grid.cellLat;
  const north = grid.s + (win.r1 + 1.5) * grid.cellLat;
  const W = Math.round((win.c1 - win.c0 + 2) * pxPerCell);
  const H = Math.round((win.r1 - win.r0 + 2) * pxPerCell);
  const yTop = mercY(north); const yBot = mercY(south);
  const values = new Float32Array(W * H);
  const cover = new Float32Array(W * H);
  const wx = new Float64Array(4); const wy = new Float64Array(4);
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= rows || c >= cols ? NaN : val[r * cols + c]);

  for (let j = 0; j < H; j++) {
    const lat = invMercY(yTop + ((j + 0.5) / H) * (yBot - yTop));
    const gy = (lat - grid.s) / grid.cellLat - 0.5;
    const r0 = Math.floor(gy); const fy = gy - r0;
    cr(fy, wy);
    for (let i = 0; i < W; i++) {
      const lon = west + ((i + 0.5) / W) * (east - west);
      const gx = (lon - grid.w) / grid.cellLon - 0.5;
      const c0 = Math.floor(gx); const fx = gx - c0;
      const v00 = at(r0, c0); const v01 = at(r0, c0 + 1); const v10 = at(r0 + 1, c0); const v11 = at(r0 + 1, c0 + 1);
      // Bilinear support (mask-weighted) decides whether this pixel is drawn.
      let num = 0; let den = 0;
      if (!Number.isNaN(v00)) { const w = (1 - fx) * (1 - fy); num += v00 * w; den += w; }
      if (!Number.isNaN(v01)) { const w = fx * (1 - fy); num += v01 * w; den += w; }
      if (!Number.isNaN(v10)) { const w = (1 - fx) * fy; num += v10 * w; den += w; }
      if (!Number.isNaN(v11)) { const w = fx * fy; num += v11 * w; den += w; }
      const p = j * W + i;
      if (den <= 0) continue;
      cover[p] = smoothstep(0.42, 0.72, den);
      let v = num / den;
      if (den > 0.999) {
        // All four inner neighbours present: try bicubic when the full 4x4 is supported.
        cr(fx, wx);
        let sum = 0; let ok = true;
        for (let m = 0; m < 4 && ok; m++) for (let n = 0; n < 4; n++) {
          const s = at(r0 - 1 + m, c0 - 1 + n);
          if (Number.isNaN(s)) { ok = false; break; }
          sum += s * wy[m] * wx[n];
        }
        if (ok) v = sum;
      }
      values[p] = v;
    }
  }
  return { W, H, west, east, south, north, yTop, yBot, values, cover };
}

function renderRaster(sampled: ReturnType<typeof sampleField>, palette: Palette) {
  const { W, H, values, cover } = sampled;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(W, H);
  const px = image.data; const rgb = [0, 0, 0];
  for (let p = 0; p < W * H; p++) {
    const a = cover[p];
    if (a <= 0.003) continue;
    colorFor(values[p], palette, rgb);
    const o = p * 4;
    px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = Math.round(255 * a);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type LngLat = [number, number];
type EdgePoint = [number, number, string];

/** Marching squares on the sampled field; returns chained polylines in [lat, lon]. */
function traceContours(sampled: ReturnType<typeof sampleField>, level: number): [number, number][][] {
  const { W, H, values, cover, west, east, yTop, yBot } = sampled;
  const lonAt = (x: number) => west + (x / W) * (east - west);
  const latAt = (y: number) => invMercY(yTop + (y / H) * (yBot - yTop));
  const valid = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && cover[j * W + i] > 0.5;
  const v = (i: number, j: number) => values[j * W + i];
  // Edge points keyed so adjoining cells share endpoints: h = horizontal edge, v = vertical edge.
  const point = (kind: 0 | 1, i: number, j: number): EdgePoint => {
    if (kind === 0) { // between (i,j) and (i+1,j)
      const a = v(i, j); const b = v(i + 1, j); const t = (level - a) / (b - a || 1e-9);
      return [lonAt(i + 0.5 + t), latAt(j + 0.5), `h${i},${j}`];
    }
    const a = v(i, j); const b = v(i, j + 1); const t = (level - a) / (b - a || 1e-9);
    return [lonAt(i + 0.5), latAt(j + 0.5 + t), `v${i},${j}`];
  };
  const segs: Array<[EdgePoint, EdgePoint]> = [];
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    if (!valid(i, j) || !valid(i + 1, j) || !valid(i, j + 1) || !valid(i + 1, j + 1)) continue;
    const tl = v(i, j) >= level; const tr = v(i + 1, j) >= level; const br = v(i + 1, j + 1) >= level; const bl = v(i, j + 1) >= level;
    const m = (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0);
    if (m === 0 || m === 15) continue;
    const top = () => point(0, i, j); const bottom = () => point(0, i, j + 1);
    const left = () => point(1, i, j); const right = () => point(1, i + 1, j);
    switch (m) {
      case 1: case 14: segs.push([left(), top()]); break;
      case 2: case 13: segs.push([top(), right()]); break;
      case 3: case 12: segs.push([left(), right()]); break;
      case 4: case 11: segs.push([right(), bottom()]); break;
      case 6: case 9: segs.push([top(), bottom()]); break;
      case 7: case 8: segs.push([left(), bottom()]); break;
      case 5: segs.push([left(), top()], [right(), bottom()]); break;
      case 10: segs.push([top(), right()], [left(), bottom()]); break;
    }
  }
  // Chain segments that share an endpoint key.
  const byKey = new Map<string, number[]>();
  segs.forEach((s, idx) => { for (const end of s) { const list = byKey.get(end[2]); if (list) list.push(idx); else byKey.set(end[2], [idx]); } });
  const used = new Uint8Array(segs.length);
  const lines: [number, number][][] = [];
  const extend = (chain: LngLat[], key: string) => {
    let cur = key;
    for (;;) {
      const next = (byKey.get(cur) ?? []).find((idx) => !used[idx]);
      if (next === undefined) return;
      used[next] = 1;
      const [a, b] = segs[next];
      const other = a[2] === cur ? b : a;
      chain.push([other[0], other[1]]);
      cur = other[2];
    }
  };
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const [a, b] = segs[s];
    const chain: LngLat[] = [[a[0], a[1]], [b[0], b[1]]];
    extend(chain, b[2]);
    const head: LngLat[] = [[a[0], a[1]]];
    extend(head, a[2]);
    const full = head.slice(1).reverse().concat(chain);
    if (full.length >= 4) lines.push(full.map(([lon, lat]) => [lat, lon] as [number, number]));
  }
  return lines;
}

export function ThermalFieldLayer({
  model, values, opacity = 0.7, palette = 'thermal', contours = true,
}: { model: SpatialModel; values: Map<number, number>; opacity?: number; palette?: Palette; contours?: boolean }) {
  const map = useMap();
  const dense = useMemo(() => buildDenseField(model, values), [model, values]);

  // Rasterise and (optionally) trace contours only when the field itself changes.
  const prepared = useMemo(() => {
    const win = supportWindow(dense);
    if (!win) return null;
    const raster = sampleField(model, dense, win, RASTER_PX_PER_CELL);
    const canvas = renderRaster(raster, palette);
    let lines: [number, number][][][] = [];
    if (contours && palette === 'thermal') {
      const coarse = sampleField(model, dense, win, CONTOUR_PX_PER_CELL);
      lines = CONTOUR_LEVELS.map((level) => traceContours(coarse, level));
    }
    return {
      canvas,
      bounds: L.latLngBounds([raster.south, raster.west], [raster.north, raster.east]),
      lines,
    };
  }, [model, dense, palette, contours]);

  useEffect(() => {
    if (!prepared) return;
    const paneName = 'thermo-thermal-field'; const contourPane = 'thermo-thermal-contours';
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.zIndex = '360'; pane.style.pointerEvents = 'none';
    const cPane = map.getPane(contourPane) ?? map.createPane(contourPane);
    cPane.style.zIndex = '365'; cPane.style.pointerEvents = 'none';

    const overlay = new CanvasOverlay(prepared.canvas, prepared.bounds, { pane: paneName, opacity, interactive: false, className: 'thermo-field-image' });
    overlay.addTo(map);

    const renderer = L.canvas({ pane: contourPane, padding: 0.3 });
    const group = L.layerGroup();
    prepared.lines.forEach((levelLines, k) => {
      const major = k === 1 || k === 3;
      for (const line of levelLines) {
        L.polyline(line, { renderer, interactive: false, color: '#181f1c', weight: major ? 0.9 : 0.6, opacity: major ? 0.6 : 0.42, smoothFactor: 1.5 }).addTo(group);
      }
    });
    const syncContours = () => {
      const show = map.getZoom() >= CONTOUR_MIN_ZOOM;
      if (show && !map.hasLayer(group)) group.addTo(map);
      if (!show && map.hasLayer(group)) group.remove();
    };
    syncContours();
    map.on('zoomend', syncContours);
    return () => { map.off('zoomend', syncContours); overlay.remove(); group.remove(); renderer.remove(); };
  }, [map, prepared, opacity]);
  return null;
}
