import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { tileLoadState } from '../hooks/useData';
import { districtStatsFor, DISTRICT_DEFAULTS, type DistrictStats } from '../lib/heat/districtStats';
import { bandColor } from '../lib/heat/heatModel';

const CAMPUS_ZONES = [
  { name: 'Courtyard', exposure: 'High', index: 84 },
  { name: 'Bus pickup area', exposure: 'High', index: 81, priority: true },
  { name: 'Sports field', exposure: 'Elevated', index: 70 },
  { name: 'North garden', exposure: 'Moderate', index: 58 },
  { name: 'Covered walkways', exposure: 'Low', index: 44 },
];

export default function DashboardPage() {
  const tiles = useMemo(() => tileLoadState(), []);
  const [hour, setHour] = useState(14);
  const stats = useMemo(() => districtStatsFor(DISTRICT_DEFAULTS, hour), [tiles, hour]);
  const mean = Math.round(stats.reduce((s, d) => s + d.heatIndex, 0) / Math.max(1, stats.length));
  const hottest = [...stats].sort((a, b) => b.heatIndex - a.heatIndex)[0];
  const coolest = [...stats].sort((a, b) => a.heatIndex - b.heatIndex)[0];

  return (
    <div className="dash">
      <header className="dash-head container">
        <div className="dash-head-top">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Central Dubai corridor overview</h1>
          </div>
          <div className="explorer-solar">
            <SolarTimeline hour={hour} onChange={(h) => setHour(h)} />
          </div>
        </div>
        <div className="dash-summary">
          <div className="dash-summary-metric">
            <span className="data-label">Corridor mean index</span>
            <strong>{mean}</strong>
            <span className="mono">/100 · {hour}:00</span>
          </div>
          <div className="dash-summary-metric">
            <span className="data-label">Highest exposure</span>
            <strong className="dash-name">{hottest?.name}</strong>
            <span className="mono">{hottest?.heatIndex}/100</span>
          </div>
          <div className="dash-summary-metric">
            <span className="data-label">Lowest exposure</span>
            <strong className="dash-name">{coolest?.name}</strong>
            <span className="mono">{coolest?.heatIndex}/100</span>
          </div>
        </div>
      </header>

      <div className="container dash-body">
        <div className="dash-grid">
          {stats.map((d) => (
            <DistrictCard key={d.id} d={d} />
          ))}
        </div>

        <aside className="dash-campus">
          <p className="eyebrow">School mode · demonstration</p>
          <h2>GEMS Wellington Primary campus</h2>
          <p className="dash-campus-lede">
            A potential THERMO deployment: outdoor zones around the campus classified against the heat
            grid. Demonstration classification only — not an official GFS analysis.
          </p>
          <ul className="campus-zone-list">
            {CAMPUS_ZONES.map((z) => (
              <li key={z.name} className="campus-zone">
                <span className="campus-zone-name">
                  {z.priority && <span className="campus-priority" title="Priority area">●</span>}
                  {z.name}
                </span>
                <span className="campus-zone-exp">{z.exposure}</span>
                <span className="campus-zone-idx mono">{z.index}</span>
              </li>
            ))}
          </ul>
          <p className="campus-note">
            <strong>Potential priority:</strong> bus pickup area — high exposure at the midday drop-off peak.
            <span className="sim-label">Simulated zones</span>
          </p>
          <Link className="btn btn-ghost btn-md" to="/about#schools">See the campus use case →</Link>
        </aside>

        <ProvenanceNote kind="DERIVED" className="dash-provenance" />
      </div>
    </div>
  );
}

function DistrictCard({ d }: { d: DistrictStats }) {
  const col = bandColor(d.band);
  return (
    <article className="dash-card">
      <div className="dash-card-top">
        <span className="dash-dot" style={{ background: col }} aria-hidden="true" />
        <h2>{d.name}</h2>
        <span className="mono dash-band">{d.bandName}</span>
      </div>
      <div className="dash-heat">
        <strong>{d.heatIndex}</strong><span className="mono">/100</span>
      </div>
      <dl className="dash-meta">
        <div><dt>Surface temp</dt><dd>{d.surfaceTemp}°C <span className="sim-label">modelled</span></dd></div>
        <div><dt>Vegetation</dt><dd>{Math.round(d.vegetation * 100)}%</dd></div>
        <div><dt>Shade potential</dt><dd>{d.shadePotential}%</dd></div>
        <div><dt>Built density</dt><dd>{Math.round(d.buildingDensity * 100)}%</dd></div>
      </dl>
      <p className="dash-intervention">{d.intervention}</p>
    </article>
  );
}
