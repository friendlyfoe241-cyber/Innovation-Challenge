import { useDeferredValue, useMemo, useState } from 'react';
import { InterventionMap } from '../components/maps/InterventionMap';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { useSpatialModel } from '../hooks/useData';
import { EMPTY_INTERVENTION, MAX_SLIDER, buildScenarioField, scenarioSummary, type InterventionSliders } from '../lib/simulation/scenarioModel';

type SliderKey = keyof InterventionSliders; type View = 'baseline' | 'scenario' | 'difference';
const SLIDERS: { key: SliderKey; label: string; hint: string }[] = [
  { key: 'vegetation', label: 'Vegetation', hint: 'Eligible road-edge and bare-land cells only' },
  { key: 'shade', label: 'Walkway shade', hint: 'Eligible cells with mapped pedestrian network support' },
  { key: 'reflective', label: 'Cool surfaces', hint: 'Eligible building, road and bare surfaces only' },
  { key: 'depave', label: 'Depave roads', hint: 'Eligible mapped road cells only; never runway cells' },
];

export default function SimulatePage() {
  const { value: model, ready, error } = useSpatialModel(); const [hour, setHour] = useState(14); const [sliders, setSliders] = useState<InterventionSliders>(EMPTY_INTERVENTION); const [view, setView] = useState<View>('scenario');
  const deferredSliders = useDeferredValue(sliders); const field = useMemo(() => model ? buildScenarioField(model, hour, deferredSliders) : null, [model, hour, deferredSliders]); const summary = useMemo(() => field ? scenarioSummary(field) : null, [field]);
  if (!ready || !model || !field || !summary) return <div className="map-loading"><span className="data-label">Loading intervention surface masks…</span>{error && <p>{error}</p>}</div>;
  const set = (key: SliderKey, value: number) => setSliders((current) => ({ ...current, [key]: value }));
  const eligible = [...field.masks.values()].reduce((total, mask) => total + (mask.vegetation > 0 || mask.shade > 0 || mask.reflective > 0 || mask.depave > 0 ? 1 : 0), 0);
  return <div className="explorer sim-page"><header className="explorer-head"><div className="container explorer-head-inner"><div><p className="eyebrow">Urban Intervention Simulator</p><h1>Change only the surfaces that qualify.</h1></div><div className="explorer-solar"><SolarTimeline hour={hour} onChange={setHour} /></div></div></header>
    <div className="explorer-body"><InterventionMap model={model} values={field} view={view} />
      <aside className="explorer-side">
        <section className="panel"><h2 className="panel-title">View</h2><div className="seg-toggle scenario-toggle" role="group" aria-label="Scenario map view">{(['baseline','scenario','difference'] as View[]).map((option) => <button key={option} className={view === option ? 'is-active' : ''} onClick={() => setView(option)}>{option}</button>)}</div><p className="panel-copy">Baseline and scenario use the same continuous field. Difference is scenario minus baseline.</p></section>
        <section className="panel"><h2 className="panel-title">Interventions</h2>{SLIDERS.map(({ key, label, hint }) => <label key={key} className="sim-slider"><span className="sim-slider-head"><span className="sim-slider-name">{label}</span><span className="sim-slider-val mono">{Math.round(sliders[key] * 100)}%</span></span><input type="range" min={0} max={MAX_SLIDER} step={0.01} value={sliders[key]} onChange={(event) => set(key, Number(event.target.value))} aria-label={label} /><span className="sim-slider-hint">{hint}</span></label>)}<button className="btn btn-ghost btn-md sim-reset" onClick={() => setSliders(EMPTY_INTERVENTION)}>Reset scenario</button></section>
        <section className="panel"><h2 className="panel-title">Model outcome</h2><div className="sim-outcome"><div className="sim-metric"><span className="data-label">Baseline</span><strong>{summary.baseline.toFixed(1)}</strong><span className="mono sim-metric-sub">/100</span></div><span className="sim-arrow" aria-hidden="true">→</span><div className="sim-metric is-scenario"><span className="data-label">Scenario</span><strong>{summary.scenario.toFixed(1)}</strong><span className="mono sim-metric-sub">/100</span></div><div className="sim-delta"><span className="data-label">Modelled reduction</span><span className="sim-delta-num mono">−{summary.reduction.toFixed(1)} · {summary.improvementPct}%</span></div></div><p className="sim-note">{eligible.toLocaleString()} OSM-supported cells have at least one eligible mask. Vegetation spill-over is limited to 1.2 km and never reaches water or runways.</p></section>
        <ProvenanceNote kind="SIMULATED" className="mt" />
      </aside>
    </div>
  </div>;
}
