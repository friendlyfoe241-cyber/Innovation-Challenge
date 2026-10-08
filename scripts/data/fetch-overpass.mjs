#!/usr/bin/env node
/**
 * Fetch real Dubai geography from OpenStreetMap via the Overpass API.
 *
 * Data categories fetched from the OSM/Overpass database:
 *   buildings · roads · green space · water · points of interest · schools
 *
 * Output: data/raw/<category>.json  (Overpass JSON, `elements` only)
 *
 * All output is OBSERVED data (OpenStreetMap contributors, ODbL).
 * Usage: node scripts/data/fetch-overpass.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bbox = JSON.parse(readFileSync(join(__dirname, 'bbox.json'), 'utf8'));
const OUT_DIR = join(__dirname, '..', '..', 'data', 'raw');

const [s, w, n, e] = [bbox.s, bbox.w, bbox.n, bbox.e];
const BB = `${s},${w},${n},${e}`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const QUERIES = {
  buildings: `[out:json][timeout:120];way["building"](${BB});out tags geom;`,
  buildings2: `[out:json][timeout:120];relation["building"](${BB});out tags geom;`,
  roads: `[out:json][timeout:120];way["highway"]["highway"!~"^(footway|path|steps|service|track|cycleway)$"](${BB});out tags geom;`,
  paths: `[out:json][timeout:120];way["highway"~"^(footway|path|steps|cycleway|pedestrian)$"](${BB});out tags geom;`,
  green: `[out:json][timeout:120];(way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|flowerbed)$"](${BB});way["leisure"~"^(park|garden|nature_reserve)$"](${BB});way["natural"~"^(wood|scrub|grassland|tree_row)$"](${BB}););out tags geom;`,
  water: `[out:json][timeout:120];(way["natural"="water"](${BB});way["landuse"="basin"](${BB});way["landuse"="reservoir"](${BB});way["leisure"="swimming_pool"](${BB});way["amenity"="fountain"](${BB});way["waterway"~"^(canal|river|stream)$"](${BB}););out tags geom;`,
  pois: `[out:json][timeout:120];(node["amenity"~"^(restaurant|cafe|bank|pharmacy|supermarket|fuel)$"](${BB});node["tourism"="hotel"](${BB});node["shop"](${BB});node["leisure"~"^(fitness_centre|sports_centre)$"](${BB});node["building"="yes"](${BB}););out tags geom;`,
  schools: `[out:json][timeout:120];(node["amenity"~"^(school|kindergarten|college|university)$"](${BB});way["amenity"~"^(school|kindergarten|college|university)$"](${BB}););out tags geom;`,
  parks: `[out:json][timeout:120];relation["leisure"="park"](${BB});out tags center;`,
};

async function postOverpass(query) {
  const body = new URLSearchParams({ data: query });
  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'User-Agent': 'THERMO-development/0.3 (innovation prototype)' },
        body,
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.elements) return json.elements;
      throw new Error('no elements in response');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

mkdirSync(OUT_DIR, { recursive: true });

const ONLY = process.argv[2]; // optional: fetch a single category

for (const [name, q] of Object.entries(QUERIES)) {
  if (ONLY && ONLY !== name) continue;
  const out = join(OUT_DIR, `${name}.json`);
  process.stdout.write(`Fetching ${name} … `);
  let elements;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      elements = await postOverpass(q);
      break;
    } catch (err) {
      if (attempt < 3) {
        process.stdout.write(`(${err.message}; retry ${attempt + 1}) `);
        await new Promise((r) => setTimeout(r, 4000 * attempt));
      } else {
        console.log(`FAILED ${err.message}`);
        elements = null;
      }
    }
  }
  if (elements) {
    writeFileSync(out, JSON.stringify(elements));
    const flat = JSON.stringify(elements).length;
    console.log(`OK (${elements.length} elements, ${(flat / 1024).toFixed(0)} kB)`);
  }
}