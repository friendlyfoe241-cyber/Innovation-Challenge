/**
 * validate-modis-lst.mjs
 * =============================================================================
 * Offline validation workflow: compare THERMO's modelled 0–100 thermal
 * potential against *numerical* NASA MODIS Terra LST observations.
 *
 * CRITICAL scientific constraints honoured by this script:
 *  – LST and THERMO's dimensionless index are DIFFERENT quantities. This script
 *    never computes RMSE between °C and the index, and never invents a
 *    conversion.
 *  – It compares the *spatial pattern* only: rank correlations, thermal-band
 *    summaries and quartile agreement between matched cells.
 *  – GIBS PNG browse tiles (the app's visual layer) carry no reliable numeric
 *    temperature. Numerical input therefore comes as a CSV exported from the
 *    native MOD11A1.061 product (see scripts/data/fetch-modis-lst.sh).
 *  – Cloud / failed retrievals: missing pixels are excluded via QC_Day; the
 *    script refuses to fill gaps with invented values.
 *
 * Input CSV format (header optional; recognised by column header names):
 *   lon,lat,lst_k,qc[,date]
 *   or:  longitude,latitude,LST_Day_1km,QC_Day[,date]
 *   lst_k  – LST in Kelvin (already scaled; if your HDF value is DN, apply the
 *            documented 0.02 scale before exporting).
 *   qc     – MOD11A1 QC_Day integer (mandatory-flag bits 0–1; see the MODIS
 *            LST user guide section on QC bits).
 *   date   – optional ISO date for the observation.
 *
 * Usage:
 *   node scripts/data/validate-modis-lst.mjs \
 *     --csv data/source/modis-lst/lst-2025-winter.csv \
 *     [--out public/data/modis-lst-validation.json] \
 *     [--qc-mode mandatory] [--date 2025-01-01]
 *
 * Exit code 0 = report written; 2 = no usable data (never invent numbers).
 * =============================================================================
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

function parseArgs(argv) {
  const args = { csv: null, out: null, qcMode: 'mandatory', date: null, minPixelsPerCell: 1, hour: 14 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--csv') args.csv = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--qc-mode') args.qcMode = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--min-pixels-per-cell') args.minPixelsPerCell = Number(argv[++i]);
    else if (a === '--hour') args.hour = Number(argv[++i]);
    else if (a === '--help') args.help = true;
  }
  return args;
}

/** MOD11 QC_Day bits 0–1 mandatory-quality flag (MODIS LST user guide). */
function qcMandatoryGood(qc) {
  if (qc === undefined || qc === null || Number.isNaN(qc)) return false;
  const v = Number(qc) & 0b11;
  return v === 0; // 0 = good quality (LST produced); 1..3 = other/error
}

/** Parse CSV: supports header detection and comment lines. */
function parseCsv(text, cols) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (!lines.length) throw new Error('CSV is empty.');
  let header = lines[0].toLowerCase().split(',');
  let body = lines;
  const looksHeader = header.some((h) => /lon|lat|lst|qc|date/.test(h));
  if (looksHeader && cols.length) {
    cols.forEach((c) => {
      const idx = header.findIndex((h) => h.includes(c.header));
      if (idx < 0) throw new Error(`CSV is missing required column ${c.header}; got: ${header.join(',')}`);
      c.idx = idx;
    });
    body = lines.slice(1);
  } else {
    cols.forEach((c, i) => { c.idx = i; });
  }
  const rows = [];
  for (const line of body) {
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const lon = Number(parts[cols.find((c) => c.header === 'lon').idx]);
    const lat = Number(parts[cols.find((c) => c.header === 'lat').idx]);
    const lst = Number(parts[cols.find((c) => c.header === 'lst').idx]);
    const qc = parts[cols.find((c) => c.header === 'qc').idx]?.trim();
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(lst)) continue;
    rows.push({ lon, lat, lst, qc: qc === undefined || qc === '' ? NaN : Number(qc), date: undefined });
  }
  return rows;
}

function spearman(ax, ay) {
  // Rank arrays (average ranks for ties), then Pearson on ranks.
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(ax); const ry = rank(ay);
  const n = rx.length;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / n;
  const mx = mean(rx); const my = mean(ry);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

function quantile(arr, q) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

function distanceM(lon1, lat1, lon2, lat2) {
  return Math.hypot((lon1 - lon2) * 100_800, (lat1 - lat2) * 110_540);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/data/validate-modis-lst.mjs --csv FILE [--out FILE] [--qc-mode mandatory] [--date DATE] [--min-pixels-per-cell N] [--hour 14]');
    process.exit(0);
  }
  if (!args.csv) { console.error('ERROR: --csv is required.'); process.exit(2); }

  // ---- Load THERMO model ---------------------------------------------------
  const modelPath = resolve(repoRoot, 'public/data/dubai-spatial-model.json');
  const model = JSON.parse(readFileSync(modelPath, 'utf8'));
  const cells = model.cells;

  // ---- Load numerical LST CSV ----------------------------------------------
  const cols = [
    { header: 'lon' }, { header: 'lat' }, { header: 'lst' }, { header: 'qc' },
  ];
  const csvPath = resolve(repoRoot, args.csv);
  const rows = parseCsv(readFileSync(csvPath, 'utf8'), cols);

  console.log(`Loaded ${rows.length} numerical LST samples; CSV ${basename(csvPath)}.`);

  // ---- QC filter (documented mandatory-quality flags) ---------------------
  const good = [];
  const excluded = { missingQc: 0, qcNotGood: 0 };
  for (const r of rows) {
    if (!Number.isFinite(r.lst) || r.lst < 150 || r.lst > 400) { continue; } // physical sanity (K)
    const qc = Number(r.qc);
    if (Number.isNaN(qc)) { excluded.missingQc++; continue; }
    if (args.qcMode === 'mandatory' && !qcMandatoryGood(qc)) { excluded.qcNotGood++; continue; }
    good.push(r);
  }
  console.log(`After QC filter: ${good.length} valid samples (excluded: ${JSON.stringify(excluded)}).`);
  if (good.length < 10) {
    console.error('ERROR: too few valid LST samples to compare. Do not fabricate a validation result.');
    process.exit(2);
  }

  // ---- Spatial aggregation: each THERMO cell -> mean of valid LST pixels ----
  // MODIS is ~1 km; the THERMO cell is 750 m. Each cell is matched to all valid
  // pixels within one MODIS pixel (~1 km) of its centre, then averaged.
  const cellLst = new Map(); // cell.id -> { sum, n }
  for (const p of good) {
    let best = null; let bestD = Infinity;
    for (const cell of cells) {
      const d = distanceM(cell.lon, cell.lat, p.lon, p.lat);
      if (d < bestD) { bestD = d; best = cell; }
    }
    if (best && bestD <= 1000) { // within one MODIS pixel radius
      const rec = cellLst.get(best.id) ?? { sum: 0, n: 0 };
      rec.sum += p.lst; rec.n += 1;
      cellLst.set(best.id, rec);
    }
  }
  const matched = [];
  // Recompute the documented thermal potential (mirrors src/lib/heat/heatModel.ts)
  // at the requested reference hour so LST is compared against the same model
  // values the app displays at that time of day.
  const phase = Math.cos(((args.hour - 15) / 12) * Math.PI);
  const solar = 0.22 + 0.78 * Math.max(0, (phase + 1) / 2);
  for (const cell of cells) {
    const rec = cellLst.get(cell.id);
    const imp = Math.max(0, Math.min(1, cell.b * 1.15 + cell.road * 0.82 + cell.bare * 0.48 + cell.runway * 0.9));
    const cool = Math.max(0, Math.min(1, cell.g * 0.86 + cell.water * 1.05));
    const form = Math.max(0, Math.min(1, cell.b * 0.75 + cell.road * 0.28));
    const act = Math.max(0, Math.min(1, cell.poi / 24));
    const potential = Math.round(Math.max(0, Math.min(100, 16 + 30 * solar + 25 * imp + 11 * form + 4 * act - 22 * cool)) * 10) / 10;
    if (rec && rec.n >= args.minPixelsPerCell) {
      matched.push({ lon: cell.lon, lat: cell.lat, id: cell.id, potential, lstK: rec.sum / rec.n, pixels: rec.n });
    }
  }
  console.log(`Matched ${matched.length} THERMO cells with >= ${args.minPixelsPerCell} valid LST pixel(s) (radius 1 km).`);

  // ---- Rank-based comparisons (NOT raw-Celsius-vs-index error) --------------
  const potential = matched.map((m) => m.potential);
  const lstC = matched.map((m) => m.lstK - 273.15);

  const bandGroups = { Low: [], Moderate: [], Elevated: [], High: [], 'Very high': [] };
  for (const m of matched) {
    const label = m.potential < 40 ? 'Low' : m.potential < 55 ? 'Moderate' : m.potential < 70 ? 'Elevated' : m.potential < 82 ? 'High' : 'Very high';
    bandGroups[label].push(m.lstK - 273.15);
  }
  const bandSummary = Object.fromEntries(Object.entries(bandGroups).map(([k, v]) => [k, v.length ? { n: v.length, meanC: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), q50C: +quantile(v, 0.5).toFixed(2) } : { n: 0 }]));

  const report = {
    schema: 'thermo-modis-lst-validation-v1',
    generatedAt: new Date().toISOString(),
    product: 'MOD11A1.061 MODIS/Terra LST&Emissivity Daily L3 Global 1km SIN Grid',
    source: args.csv,
    configuredDate: args.date ?? 'from CSV rows',
    referenceHour: args.hour,
    qcMode: args.qcMode,
    inputs: { thermallySupportedCells: cells.length, matchedCells: matched.length, validLstSamples: good.length },
    units: 'LST in Kelvin (converted to °C for display); THERMO potential is a dimensionless 0–100 index',
    method: 'Matched each THERMO 750 m cell to valid MODIS LST pixels within 1 km of the cell centre (mean). QC_Day mandatory-quality bits 0–1 == 0. Rank-based spatial comparison only; no raw Celsius-vs-index error, no invented conversion, no gap-filling.',
    spearmanRankCorrelation: +spearman(potential, lstC).toFixed(4),
    lstQuantiles: { minC: +Math.min(...lstC).toFixed(2), q25C: +quantile(lstC, 0.25).toFixed(2), q50C: +quantile(lstC, 0.5).toFixed(2), q75C: +quantile(lstC, 0.75).toFixed(2), maxC: +Math.max(...lstC).toFixed(2) },
    meanLstC: +(lstC.reduce((a, b) => a + b, 0) / lstC.length).toFixed(2),
    thermalBandLst_C: bandSummary,
    interpretation: 'Spearman correlation describes spatial-pattern agreement between the modelled index and satellite LST. It does not validate the index as a temperature or health metric, and cannot be used to infer °C from the index.',
    limitations: ['Pixels absent over cloud or failed retrievals are excluded, not filled.', 'Approx. 1 km LST pixels are aggregated, so thermal patterns below ~1 km are not validated.', 'A single date or season does not represent annual behaviour.', 'MODIS LST is a radiative surface temperature, not near-surface air temperature or thermal comfort.'],
  };

  const outPath = resolve(repoRoot, args.out ?? 'public/data/modis-lst-validation.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote validation report: ${outPath}\n`);
  console.log(`  matched cells      : ${report.inputs.matchedCells}`);
  console.log(`  valid LST samples  : ${report.inputs.validLstSamples}`);
  console.log(`  mean observed LST  : ${report.meanLstC} °C`);
  console.log(`  Spearman rank corr : ${report.spearmanRankCorrelation}`);
  console.log(`  band mean LST      : ${JSON.stringify(Object.fromEntries(Object.entries(report.thermalBandLst_C).map(([k, v]) => [k, v.meanC ?? v.n])))}`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(2);
}