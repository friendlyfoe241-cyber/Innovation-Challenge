import { useMemo, useState } from 'react';
import { RouteMap } from '../components/maps/RouteMap';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { PLACES } from '../data/places';
import { useGraph, useLayers } from '../hooks/useData';
import { computeRoutes, routeTagline, fmtMin, fmtKm, type RouteResult } from '../lib/routing/routeEngine';
import { createTileLookup, bandLabel, heatBand } from '../lib/heat/heatModel';
import type { TimeOfDay } from '../types/domain';

type Tab = 'plan' | 'result';
type Mode = 'walking' | 'cycling';

const DEFAULT_FROM = PLACES.find((p) => p.id === 'dubai-mall')!;
const DEFAULT_TO = PLACES.find((p) => p.id === 'difc')!;

export default function RoutePlannerPage() {
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [fromQ, setFromQ] = useState('');
  const [toQ, setToQ] = useState('');
  const [tab, setTab] = useState<Tab>('plan');
  const [hour, setHour] = useState<number>(14);
  const [mode, setMode] = useState<Mode>('walking');
  const [pref, setPref] = useState(0.55);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const { graph, ready: graphReady } = useGraph();
  const { layers, ready: layersReady } = useLayers();
  void graphReady;
  void layersReady;
  const tileLookup = useMemo(
    () => (layers ? createTileLookup(layers.tiles) : () => null),
    [layers],
  );

  const fromMatches = useMemo(() => PLACES.filter((p) => p.name.toLowerCase().includes(fromQ.toLowerCase())), [fromQ]);
  const toMatches = useMemo(() => PLACES.filter((p) => p.name.toLowerCase().includes(toQ.toLowerCase())), [toQ]);

  function go() {
    if (!graph || !tileLookup) return;
    const res = computeRoutes(
      graph,
      { lon: from.lon, lat: from.lat },
      { lon: to.lon, lat: to.lat },
      { preference: pref, hour: hour as TimeOfDay, walkingSpeed: mode === 'walking' ? 4.9 : 13 },
      tileLookup,
    );
    if (res.length) {
      setRoutes(res);
      setActiveIdx(0);
      setTab('result');
    }
  }

  return (
    <div className="route-page">
      <header className="route-head">
        <div className="container">
          <p className="eyebrow">Heat-Aware Route Planner</p>
          <h1>Time and distance aren&rsquo;t the whole story.</h1>
        </div>
      </header>

      <div className="route-body">
        <RouteMap
          routes={routes.map((r, i) => ({
            id: `r${i}`,
            geometry: r.geometry,
            heatScore: r.heatScore,
            selected: i === activeIdx,
          }))}
          origin={from}
          destination={to}
          onMapClick={(p) => {
            // Flip active tab to plan and set destination closest place
            const pl = PLACES.slice().sort((a, b) => Math.hypot(a.lat - p.lat, a.lon - p.lon) - Math.hypot(b.lat - p.lat, b.lon - p.lon))[0];
            setTo(pl);
            setTab('plan');
          }}
        />

        <aside className="route-side">
          {tab === 'plan' ? (
            <PlanPanel
              from={from}
              to={to}
              fromMatches={fromMatches}
              toMatches={toMatches}
              onFromQ={setFromQ}
              onToQ={setToQ}
              onPickFrom={(p) => { setFrom(p); setFromQ(''); }}
              onPickTo={(p) => { setTo(p); setToQ(''); }}
              hour={hour}
              setHour={setHour}
              mode={mode}
              setMode={setMode}
              pref={pref}
              setPref={setPref}
              onGo={go}
              loading={!graphReady || !layersReady}
            />
          ) : (
            <ResultPanel
              routes={routes}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
              onBack={() => setTab('plan')}
              pref={pref}
              setPref={setPref}
              onRecompute={go}
              fromName={from.name}
              toName={to.name}
            />
          )}
          <ProvenanceNote kind="DERIVED" className="mt" />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Plan panel ---------- */

function PlanPanel({
  from,
  to,
  fromMatches,
  toMatches,
  onFromQ,
  onToQ,
  onPickFrom,
  onPickTo,
  hour,
  setHour,
  mode,
  setMode,
  pref,
  setPref,
  onGo,
  loading,
}: {
  from: { name: string; area?: string };
  to: { name: string; area?: string };
  fromMatches: typeof PLACES;
  toMatches: typeof PLACES;
  onFromQ: (q: string) => void;
  onToQ: (q: string) => void;
  onPickFrom: (p: (typeof PLACES)[number]) => void;
  onPickTo: (p: (typeof PLACES)[number]) => void;
  hour: number;
  setHour: (h: number) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  pref: number;
  setPref: (p: number) => void;
  onGo: () => void;
  loading?: boolean;
}) {
  return (
    <div className="route-panel panel">
      <h2 className="panel-title">Plan a journey</h2>

      <div className="place-input">
        <span className="place-dot from" aria-hidden="true" />
        <label>
          <span className="data-label">From</span>
          <input value={from.name} readOnly onFocus={() => onFromQ('')} placeholder="Where are you leaving?" />
        </label>
      </div>
      {fromMatches.length > 0 && (
        <div className="place-matches">
          {fromMatches.map((p) => (
            <button key={p.id} onClick={() => onPickFrom(p)}>
              <span className="place-name">{p.name}</span>
              <span className="place-area">{p.area}</span>
            </button>
          ))}
        </div>
      )}

      <div className="place-input">
        <span className="place-dot to" aria-hidden="true" />
        <label>
          <span className="data-label">To</span>
          <input value={to.name} readOnly onFocus={() => onToQ('')} placeholder="Where are you going?" />
        </label>
      </div>
      {toMatches.length > 0 && (
        <div className="place-matches">
          {toMatches.map((p) => (
            <button key={p.id} onClick={() => onPickTo(p)}>
              <span className="place-name">{p.name}</span>
              <span className="place-area">{p.area}</span>
            </button>
          ))}
        </div>
      )}

      <div className="seg">
        <div className="seg-label">
          <span className="data-label">Travel mode</span>
        </div>
        <div className="seg-toggle" role="group" aria-label="Travel mode">
          <button className={mode === 'walking' ? 'is-active' : ''} onClick={() => setMode('walking')}>Walking</button>
          <button className={mode === 'cycling' ? 'is-active' : ''} onClick={() => setMode('cycling')}>Cycling</button>
        </div>
      </div>

      <div className="seg">
        <span className="data-label">Departure time</span>
        <SolarTimeline hour={hour} onChange={setHour} />
      </div>

      <div className="seg">
        <span className="data-label">Faster <em className="mono">←</em> <em className="mono">→</em> Cooler</span>
        <input
          type="range"
          className="pref-range"
          min={0}
          max={1}
          step={0.05}
          value={pref}
          onChange={(e) => setPref(Number(e.target.value))}
          aria-label="Route preference: faster vs cooler"
        />
        <div className="pref-labels">
          <span>Time matters more</span>
          <span>Heat matters more</span>
        </div>
      </div>

      <button className="btn btn-primary btn-md route-go" onClick={onGo} disabled={loading}>
        {loading ? 'Loading streets…' : 'Find routes'}
      </button>

      <div className="route-checks">
        <span className="prov-tag" data-prov="OBSERVED">OSM network</span>
        <span className="prov-tag" data-prov="DERIVED">THERMO exposure</span>
      </div>
    </div>
  );
}

/* ---------- Result panel ---------- */

function ResultPanel({
  routes,
  activeIdx,
  onSelect,
  onBack,
  pref,
  setPref,
  onRecompute,
  fromName,
  toName,
}: {
  routes: RouteResult[];
  activeIdx: number | null;
  onSelect: (i: number) => void;
  onBack: () => void;
  pref: number;
  setPref: (p: number) => void;
  onRecompute: () => void;
  fromName: string;
  toName: string;
}) {
  const active = activeIdx === null ? null : routes[activeIdx];
  return (
    <div className="route-panel panel">
      <div className="route-res-head">
        <div>
          <span className="data-label">Routes</span>
          <h3 className="route-res-title">
            {fromName} <span aria-hidden="true">→</span> {toName}
          </h3>
        </div>
        <button className="icon-btn" onClick={onBack} aria-label="Edit journey">
          ✎
        </button>
      </div>

      <div className="route-res-list">
        {routes.map((r, i) => (
          <button
            key={i}
            className={`route-res-item ${i === activeIdx ? 'is-active' : ''}`}
            onClick={() => onSelect(i)}
          >
            <div className="route-res-top">
              <strong>{r.label}</strong>
              <span className="route-res-time">
                {fmtMin(r.durationMin)} · {fmtKm(r.distanceM)}
              </span>
            </div>
            <div className="route-heatbar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, r.heatScore)}%`, background: r.heatScore < 40 ? 'var(--t-mild)' : r.heatScore < 60 ? 'var(--t-warm)' : 'var(--t-hot)' }} />
            </div>
            <div className="route-res-bottom">
              <span className={`route-heat ${r.heatScore < 40 ? 'is-low' : r.heatScore < 60 ? 'is-mid' : 'is-high'}`}>
                Heat {r.heatScore}/100
              </span>
              <span className="route-tagline">{routeTagline(r)}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="seg reset-m">
        <span className="data-label">Faster <em className="mono">←</em> <em className="mono">→</em> Cooler</span>
        <input
          type="range"
          className="pref-range"
          min={0}
          max={1}
          step={0.05}
          value={pref}
          onChange={(e) => setPref(Number(e.target.value))}
          aria-label="Route preference"
        />
        <button className="btn btn-ghost btn-md route-recalc" onClick={onRecompute}>
          Recalculate
        </button>
      </div>

      {active && <RouteBreakdown route={active} />}
    </div>
  );
}

function RouteBreakdown({ route }: { route: RouteResult }) {
  return (
    <div className="route-breakdown">
      <div className="breakdown-heat">
        <span className="data-label">Heat exposure</span>
        <strong>{bandLabel(heatBand(route.heatScore))}</strong>
        <span className="mono">{route.heatScore} / 100</span>
      </div>
      <dl className="breakdown-list">
        <div className="metric">
          <dt>Duration</dt>
          <dd>{fmtMin(route.durationMin)}</dd>
        </div>
        <div className="metric">
          <dt>Distance</dt>
          <dd>{fmtKm(route.distanceM)}</dd>
        </div>
        <div className="metric">
          <dt>Estimated exposed walking</dt>
          <dd>{fmtMin(route.exposedMin)}</dd>
        </div>
        <div className="metric">
          <dt>Shaded / protected</dt>
          <dd>{fmtMin(route.shadedMin)}</dd>
        </div>
      </dl>
      <p className="route-note">
        Exposure estimated from the THERMO analytical model of the street environment. It is an
        estimate of environmental heat load, not a health-risk prediction.
      </p>
    </div>
  );
}