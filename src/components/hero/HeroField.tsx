import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

/**
 * HeroField — a living "environmental map" rendered on <canvas>.
 *
 * Visual language: warm sunlight + asphalt + shade + urban geometry.
 * Layers (composited deliberately, nothing flashy):
 *   1. deep warm-charcoal ground with a faint urban grid
 *   2. slow-moving thermal contours (isotherms)
 *   3. simplified city blocks (buildings) that cast shade
 *   4. a solar arc sweeping a sun marker across the day
 *   5. a small route polyline that draws itself along a shaded street
 * Motion honours prefers-reduced-motion.
 */
export function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * DPR));
      canvas.height = Math.max(1, Math.floor(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Deterministic seeded noise for contours
    const rand = mulberry32(7);
    const seeds = Array.from({ length: 6 }, () => ({
      x: rand() * 1.4,
      y: rand() * 0.6 + 0.1,
      r: 0.12 + rand() * 0.22,
      heat: 0.25 + rand() * 0.65,
      phase: rand() * Math.PI * 2,
    }));

    function valueAt(nx: number, ny: number, t: number): number {
      let v = 0;
      for (const s of seeds) {
        const dx = nx - s.x;
        const dy = ny - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const pulse = 0.08 * Math.sin(t * 0.5 + s.phase + d * 6);
        v += (s.heat + pulse) * Math.exp(-(d * d) / (2 * s.r * s.r));
      }
      return v;
    }

    // Static city blocks (buildings) in a pseudo-Dubai fabric
    const blocks = Array.from({ length: 42 }, () => ({
      x: rand() * 1.15 - 0.08,
      y: rand() * 0.9 + 0.05,
      w: 0.012 + rand() * 0.035,
      ht: 0.008 + rand() * 0.02,
      rise: 0.25 + rand() * 0.6,
    }));

    // Route polyline (a cool street through the fabric)
    const route: [number, number][] = [
      [0.06, 0.82],
      [0.16, 0.74],
      [0.3, 0.72],
      [0.44, 0.76],
      [0.58, 0.68],
      [0.72, 0.66],
      [0.84, 0.58],
      [0.95, 0.5],
    ];

    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;

      ctx.clearRect(0, 0, w, h);

      // --- ground
      const grad = ctx.createLinearGradient(0, 0, w * 0.7, h);
      grad.addColorStop(0, '#141a17');
      grad.addColorStop(0.6, '#1b231e');
      grad.addColorStop(1, '#211f18');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // --- faint grid (urban fabric)
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = '#c8a76a';
      ctx.lineWidth = 1;
      const gridS = Math.max(34, w / 22);
      ctx.beginPath();
      for (let x = 0; x < w + gridS; x += gridS) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h * 0.12, h);
      }
      for (let y = 0; y < h + gridS; y += gridS) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y - w * 0.08);
      }
      ctx.stroke();
      // second finer grid
      ctx.globalAlpha = 0.05;
      const g2 = gridS / 4;
      ctx.beginPath();
      for (let x = 0; x < w + g2; x += g2) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h * 0.12, h);
      }
      ctx.stroke();
      ctx.restore();

      // --- thermal contours (heat field) via marching squares
      const cols = 64;
      const rows = 40;
      const data: number[][] = [];
      for (let j = 0; j <= rows; j++) {
        const row: number[] = [];
        for (let i = 0; i <= cols; i++) {
          row.push(valueAt(i / cols, j / rows, t));
        }
        data.push(row);
      }
      const levels = [0.12, 0.2, 0.3, 0.4, 0.5, 0.62, 0.75, 0.9, 1.05];
      ctx.save();
      for (let li = 0; li < levels.length; li++) {
        const level = levels[li];
        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const corners = [
              data[j][i],
              data[j][i + 1],
              data[j + 1][i + 1],
              data[j + 1][i],
            ];
            const crossing = corners.some((c) => c >= level);
            if (!crossing) continue;
            // linear interpolation across cell edges for x/y
            const x0 = (i / cols) * w;
            const y0 = (j / rows) * h;
            const x1 = ((i + 1) / cols) * w;
            const y1 = ((j + 1) / rows) * h;
            const pts: [number, number][] = [];
            const cN = corners[0];
            const cE = corners[1];
            const cS = corners[2];
            const cW = corners[3];
            if ((cN - level) * (cE - level) < 0) {
              const f = (level - cN) / (cE - cN || 1e-9);
              pts.push([x0 + (x1 - x0) * f, y0]);
            }
            if ((cE - level) * (cS - level) < 0) {
              const f = (level - cE) / (cS - cE || 1e-9);
              pts.push([x1, y0 + (y1 - y0) * f]);
            }
            if ((cS - level) * (cW - level) < 0) {
              const f = (level - cS) / (cW - cS || 1e-9);
              pts.push([x0 + (x1 - x0) * f, y1]);
            }
            if ((cW - level) * (cN - level) < 0) {
              const f = (level - cW) / (cN - cW || 1e-9);
              pts.push([x0, y0 + (y1 - y0) * f]);
            }
            if (pts.length === 2) {
              ctx.moveTo(...pts[0]);
              ctx.lineTo(...pts[1]);
            }
          }
        }
        // warm line, increasing in intensity
        ctx.strokeStyle = `rgba(214, 122, 34, ${0.05 + li * 0.012})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // --- heat glow (soft)
      const glow = ctx.createRadialGradient(w * 0.62, h * 0.32, 10, w * 0.62, h * 0.32, w * 0.5);
      glow.addColorStop(0, 'rgba(217,122,30,0.16)');
      glow.addColorStop(1, 'rgba(217,122,30,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // --- buildings as simple boxes with a sun-side highlight
      const sunX = w * (0.15 + Math.sin(t * 0.12) * 0.06);
      for (const b of blocks) {
        const bx = b.x * w;
        const by = b.y * h;
        const bw = Math.max(3, b.w * w);
        const bh = Math.max(2, b.ht * h);
        // shade cast away from the sun
        ctx.fillStyle = '#262f2a';
        ctx.fillRect(bx + (sunX > bx ? bw * 0.15 : -bw * 0.15), by + bh * 0.12, bw, bh);
        ctx.fillStyle = `hsl(38, 18%, ${18 + b.rise * 16}%)`;
        ctx.fillRect(bx, by, bw, bh);
        // sun-lit edge
        ctx.fillStyle = 'rgba(236, 190, 110, 0.35)';
        if (sunX > bx + bw / 2) ctx.fillRect(bx + bw - 1.4, by, 1.4, bh);
        else ctx.fillRect(bx, by, 1.4, bh);
      }

      // --- route polyline drawing itself
      const routeProg = reduced ? 1 : Math.min(1, Math.max(0, Math.sin(t * 0.08) * 1.8 - 0.4));
      if (routeProg > 0) {
        const n = Math.floor(routeProg * route.length);
        const partial = routeProg * route.length;
        ctx.save();
        ctx.beginPath();
        const ctx2 = ctx;
        for (let i = 0; i < n; i++) {
          const [px, py] = route[i];
          const cx = px * w;
          const cy = py * h;
          if (i === 0) ctx2.moveTo(cx, cy);
          else ctx2.lineTo(cx, cy);
        }
        if (n < route.length) {
          const prev = route[Math.max(0, n - 1)];
          const next = route[Math.min(route.length - 1, n)];
          const f = partial - Math.floor(partial);
          ctx2.lineTo(
            prev[0] * w + (next[0] - prev[0]) * w * f,
            prev[1] * h + (next[1] - prev[1]) * h * f,
          );
        }
        ctx2.strokeStyle = 'rgba(226, 168, 92, 0.9)';
        ctx2.lineWidth = 2.2;
        ctx2.lineCap = 'round';
        ctx2.stroke();
        // softer underlay
        ctx2.strokeStyle = 'rgba(226, 168, 92, 0.25)';
        ctx2.lineWidth = 6;
        ctx2.stroke();
        ctx2.restore();
        // endpoint dot
        const [ex, ey] = route[route.length - 1];
        ctx.beginPath();
        ctx.arc(ex * w, ey * h, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f0c57e';
        ctx.fill();
        ctx.strokeStyle = '#683a13';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // --- solar arc + sun marker
      const arcX0 = w * 0.08;
      const arcX1 = w * 0.92;
      const arcTop = h * 0.24;
      const arcBot = h * 0.72;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(arcX0, arcBot);
      ctx.quadraticCurveTo((arcX0 + arcX1) / 2, arcTop, arcX1, arcBot);
      ctx.strokeStyle = 'rgba(232, 206, 150, 0.28)';
      ctx.setLineDash([2, 7]);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      const st = reduced ? 0.4 : (Math.sin(t * 0.07 + 0.6) + 1) / 2;
      const sx = arcX0 + (arcX1 - arcX0) * st;
      const sy = arcBot - Math.sin(st * Math.PI) * (arcBot - arcTop);
      // halo
      const halo = ctx.createRadialGradient(sx, sy, 1, sx, sy, 34);
      halo.addColorStop(0, 'rgba(247, 190, 100, 0.35)');
      halo.addColorStop(1, 'rgba(247, 190, 100, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(sx - 34, sy - 34, 68, 68);
      ctx.beginPath();
      ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f3c77c';
      ctx.fill();
      ctx.restore();

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    if (reduced) {
      draw(start);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced]);

  return <canvas ref={ref} className="hero-field" aria-hidden="true" />;
}

/** Tiny PRNG for stable, reproducible placement. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}