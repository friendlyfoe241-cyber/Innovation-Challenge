import { useMemo, useState } from 'react';
import { InterventionMap } from '../components/maps/InterventionMap';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { tileLoadState } from '../hooks/useData';
import {
  EMPTY_INTERVENTION,
  MAX_SLIDER,
  applyIntervention,
  scenarioSummary,
  isolatedImpacts,
  type InterventionSliders,
} from '../lib/simulation/scenarioModel';

type SliderKey = keyof InterventionSliders;

const SLIDERS: { key: SliderKey; label: string; hint: string }[] = [
  { key: 'vegetation', label: 'Vegetation', hint: 'Street trees & planted ground' },
  { key: 'shade', label: 'Shaded walkways', hint: 'Canopies & arcades over paths' },
  { key: 'reflective', label: 'Reflective surfaces', hint: 'High-albedo pavements & roofs' },
  { key: 'depave', label: 'Less exposed pavement', hint: 'Depaving & permeable ground' },
];

export default function SimulatePage() {
  const tiles = useMemo(() => tileLoadState(), []);
  const [hour, setHour] = useState<number>(14);
  const [sliders, setSliders] = useState<InterventionSliders>(EMPTY_INTERVENTION);

  const applied = useMemo(() => tiles.map((t) => applyIntervention(t, sliders)), [tiles, sliders]);
  const summary = useMemo(() => scenarioSummary(tiles, sliders, hour), [tiles, sliders, hour]);
  const impacts = useMemo(() => isolatedImpacts(tiles, hour), [tiles, hour]);
  const active = Object.values(sliders).some((v) => v > 0.005);

  const set = (k: SliderKey, v: number) => setSliders((s) => ({ ...s, [k]: v }));

  return (
    <div className="explorer sim-page">
      <header className="explorer-head">
        <div className="container explorer-head-inner">
          <div>
            <p className="eyebrow">Urban Intervention Simulator</p>
            <h1>What if the city had more shade?</h1>
          </div>
          <div className="explorer-solar">
            <SolarTimeline hour={hour} onChange={(h) => setHour(h)} />
          </div>
        </div>
      </header>

      <div className="explorer-body">
        <InterventionMap tiles={tiles} applied={applied} hour={hour} active={active} />
        <aside className="explorer-side">
          <section className="panel">
            <h2 className="panel-title">Interventions</h2>
            {SLIDERS.map(({ key, label, hint }) => (
              <label key={key} className="sim-slider">
                <span className="sim-slider-head">
                  <span className="sim-slider-name">{label}</span>
                  <span className="sim-slider-val mono">{Math.round(sliders[key] * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={MAX_SLIDER}
                  step={0.01}
                  value={sliders[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                  aria-label={label}
                />
                <span className="sim-slider-hint">{hint}</span>
              </label>
            ))}
            <button className="btn btn-ghost btn-md sim-reset" onClick={() => setSliders(EMPTY_INTERVENTION)}>
              Reset scenario
            </button>
          </section>

          <section className="panel">
            <h2 className="panel-title">Model outcome</h2>
            <div className="sim-outcome">
              <div className="sim-metric">
                <span className="data-label">Current</span>
                <strong>{Math.round(summary.baselineIndex)}</strong>
                <span className="mono sim-metric-sub">/100</span>
              </div>
              <span className="sim-arrow" aria-hidden="true">→</span>
              <div className="sim-metric is-scenario">
                <span className="data-label">Scenario</span>
                <strong>{Math.round(summary.scenarioIndex)}</strong>
                <span className="mono sim-metric-sub">/100</span>
              </div>
              <div className="sim-delta">
                <span className="data-label">Potential improvement</span>
                <span className="sim-delta-num mono">−{summary.improvementPct}%</span>
              </div>
            </div>
            <p className="sim-note">
              Modelled outcome for the study zone. Not a measurement — see methodology.
            </p>
          </section>

          <section className="panel">
            <h2 className="panel-title">What matters most</h2>
            <div className="sim-impacts">
              {impacts.map((it) => (
                <div key={it.label} className="sim-impact-row">
                  <div className="sim-impact-head">
                    <span>{it.label}</span>
                    <span className="mono">−{Math.max(0, it.impact)}%</span>
                  </div>
                  <div className="sim-impact-bar"><span style={{ width: `${Math.min(100, Math.max(0, it.impact))}%` }} /></div>
                  <span className="sim-impact-detail">{it.detail}</span>
                </div>
              ))}
            </div>
          </section>

          <ProvenanceNote kind="SIMULATED" className="mt" />
        </aside>
      </div>
    </div>
  );
}
