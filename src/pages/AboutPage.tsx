import { HEAT_MODEL_DEFAULTS } from '../lib/heat/heatModel';
import { DATASETS, DEMO_BOUNDS } from '../data/datasets';

const W = HEAT_MODEL_DEFAULTS.heatIndexWeights;

const STEPS = [
  { n: '01', title: 'Collect observed urban data', text: 'OpenStreetMap geometry for a ~44 km² corridor of central Dubai — buildings, roads and paths, green space, water, POIs and schools — fetched through the public Overpass API.' },
  { n: '02', title: 'Rasterise into a tile grid', text: 'Each ~250 m × 250 m cell stores normalised fractions of built cover, pavement proxy, vegetation, water, activity density and mean building height (OBSERVED → DERIVED).' },
  { n: '03', title: 'Estimate heat exposure', text: 'The THERMO Heat Exposure Index combines surface-temperature factors, vegetation deficit, built density and time of day into a 0–100 prototype analytical index.' },
  { n: '04', title: 'Score the street network', text: 'Every road/path edge inherits heat from the tiles it crosses. The route engine blends distance or time with exposure to produce Fastest / Balanced / Cooler alternatives.' },
  { n: '05', title: 'Simulate interventions', text: 'Vegetation, shaded walkways, reflective surfaces and depaving are applied to the tile model to show a modelled before/after comparison.' },
];

const FUTURE = [
  'Live weather and air-temperature feeds (e.g. NCM / WMO stations)',
  'Higher-resolution land-surface temperature from NASA/ESA/Copernicus satellites',
  'IoT micro-climate sensors on real campuses and streets',
  'Municipal datasets: Dubai open-data portals, district energy, traffic counts',
  'Real-time shade detection from sky-view-factor geometry',
  'Crowd-sourced heat observations and comfort reports',
  'School sensor deployments for a validated campus mode',
];

const LIMITATIONS = [
  'Temperatures and heat indices are MODELLED estimates, not official measurements.',
  'The diurnal temperature curve is a normative simulation, not a weather feed.',
  'Tile resolution (~250 m) cannot capture fine street-level shading from individual trees or towers.',
  'The route graph is a demonstration simplification of the street network and is not commercial navigation.',
  'Intervention impacts are analytical scenarios with transparent sensitivity coefficients, not empirical predictions.',
  'The Heat Exposure Index is a prototype analytical index, not a medically validated heat-risk system.',
  'This is not a departmental heat-warning or planning tool.',
];

export default function AboutPage() {
  const observed = DATASETS.filter((d) => d.category === 'OBSERVED');
  const derived = DATASETS.filter((d) => d.category === 'DERIVED');

  return (
    <div className="page-hero-wrap">
      <header className="page-hero container">
        <p className="eyebrow">Methodology &amp; data</p>
        <h1>How THERMO sees the heat</h1>
        <p className="page-lede">
          THERMO combines observed urban geometry with a documented analytical model. Every value on
          this site is labelled by provenance — what is measured, what is derived, and what is simulated.
        </p>
        <p className="page-lede-sub">
          Demonstration prototype for the GEMS Global Innovation Challenge 2026–27.
        </p>
      </header>

      <div className="container prose">
        <section className="info-section">
          <h2>The problem</h2>
          <p>
            A city doesn&rsquo;t have one temperature. Sun angle, building mass, pavement, trees and water
            create differences of several degrees between adjacent streets — and those differences are
            exactly what people experience when they walk, wait at a bus stop or play outside. Understanding
            where heat concentrates is the first step toward moving differently and designing better.
          </p>
        </section>

        <section className="info-section">
          <h2>Our approach</h2>
          <p>
            THERMO is built around one loop: <strong>Observe → Navigate → Improve</strong>. Individuals find
            routes that reduce heat exposure; schools and organisations understand the outdoor spaces they
            manage; planners and researchers see where interventions matter most. The same data model powers
            all three views.
          </p>
        </section>

        <section className="info-section">
          <h2>How it works</h2>
          <ol className="step-list">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <span className="step-n mono">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="info-section" id="data">
          <h2>Data sources</h2>
          <p>
            The demo corridor spans {DEMO_BOUNDS.s}°S–{DEMO_BOUNDS.n}°N, {DEMO_BOUNDS.w}°W–{DEMO_BOUNDS.e}°E
            (Downtown Dubai, Business Bay, DIFC, Zabeel and Al Safa). Geometry comes from OpenStreetMap
            contributors under the ODbL licence, retrieved via the public Overpass API.
          </p>
          <div className="prov-key">
            <span className="prov-tag" data-prov="OBSERVED">OBSERVED</span>
            <span className="prov-key-text">directly from a documented dataset</span>
            <span className="prov-tag" data-prov="DERIVED">DERIVED</span>
            <span className="prov-key-text">computed by THERMO from observed data</span>
            <span className="prov-tag" data-prov="SIMULATED">SIMULATED</span>
            <span className="prov-key-text">generated for demonstration</span>
          </div>
          <div className="data-grid">
            {[...observed, ...derived].map((d) => (
              <article key={d.id} className="data-card">
                <div className="data-card-head">
                  <span className="prov-tag" data-prov={d.category}>{d.category}</span>
                  <span className="mono">{d.resolution}</span>
                </div>
                <h3>{d.name}</h3>
                <p>{d.description}</p>
                <dl className="data-card-meta">
                  <div><dt>Source</dt><dd>{d.source}</dd></div>
                  <div><dt>Licence</dt><dd>{d.license}</dd></div>
                  <div><dt>Accessed</dt><dd>{d.accessDate}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="prov-note">
            Air temperatures and land-surface temperatures shown anywhere in THERMO are normative model
            estimates. No satellite or weather observation feed is integrated yet.
          </p>
        </section>

        <section className="info-section" id="model">
          <h2>The THERMO Heat Exposure Index</h2>
          <p>
            The heat layer is a <strong>prototype analytical index</strong> (0–100), not a health-warning
            system. It is a transparent weighted combination of four tile-scale factors plus the time of day.
          </p>
          <div className="formula">
            <pre>
{`Heat Exposure = W_t · temperature   (${(W.temperature * 100).toFixed(0)})
              + W_a · surface variation (${(W.surfaceAlt * 100).toFixed(0)})
              + W_v · vegetation deficit (${(W.vegetationAbs * 100).toFixed(0)})
              + W_b · built density     (${(W.buildingDensity * 100).toFixed(0)})
              + W_t · time of day       (${(W.timeOfDay * 100).toFixed(0)})`}
            </pre>
          </div>
          <ul className="weight-list">
            <li><strong>Temperature ({(W.temperature * 100).toFixed(0)}%)</strong> — modelled surface temperature, scaled 30–48°C.</li>
            <li><strong>Surface variation ({(W.surfaceAlt * 100).toFixed(0)}%)</strong> — deviation from a bare reference surface.</li>
            <li><strong>Vegetation deficit ({(W.vegetationAbs * 100).toFixed(0)}%)</strong> — 0 at ~40% cover, 1 for bare ground.</li>
            <li><strong>Built density ({(W.buildingDensity * 100).toFixed(0)}%)</strong> — mass that traps heat and shades inward.</li>
            <li><strong>Time of day ({(W.timeOfDay * 100).toFixed(0)}%)</strong> — diurnal stress curve peaking mid-afternoon.</li>
          </ul>
          <p>
            Every input is normalised to 0–1 before weighting. The weights are deliberate prototype choices
            documented here so the model is inspectable and re-configurable — they are not scientifically
            validated risk coefficients.
          </p>
          <div className="callout">
            <strong>Land-surface temperature ≠ air temperature.</strong> THERMO models surface heating; the
            felt air temperature near a person depends additionally on shade, wind and humidity, which the
            current tile grid represents only approximately.
          </div>
        </section>

        <section className="info-section" id="schools">
          <h2>School &amp; campus mode</h2>
          <p>
            For GEMS, THERMO supports a campus view: select a campus footprint and inspect outdoor gathering
            areas, walking routes, entrances, sports zones and bus-pickup points against the same heat grid.
            The demo includes GEMS Wellington Primary (Al Safa 2) as a highlighted area. This is a potential
            deployment use case — it is not an official analysis of any GFS campus unless survey and sensor
            data is later obtained.
          </p>
        </section>

        <section className="info-section" id="limits">
          <h2>Limitations</h2>
          <ul className="limit-list">
            {LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>

        <section className="info-section">
          <h2>Future development</h2>
          <ul className="roadmap-list">
            {FUTURE.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="prov-note">None of these are yet available in the prototype.</p>
        </section>

        <section className="info-section">
          <h2>Why transparency is a feature</h2>
          <p>
            THERMO deliberately refuses to invent measurements. If a number cannot be traced to a documented
            observation, a documented derivation, or a clearly labelled simulation, it is not shown. This
            keeps the prototype honest while it grows toward a real-data pilot.
          </p>
        </section>
      </div>
    </div>
  );
}
