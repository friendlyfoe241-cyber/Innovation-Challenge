import { useMemo, useState } from 'react';
import { HeatMap, type SelectedPoint } from '../components/maps/HeatMap';
import { ThermalScale } from '../components/ui/ThermalScale';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { useSpatialModel } from '../hooks/useData';
import { bandLabel, calculateBaseField, createFieldSampler, heatBand } from '../lib/heat/heatModel';

export default function ExplorerPage() {
  const [hour, setHour] = useState(14); const [selected, setSelected] = useState<SelectedPoint | null>(null);
  const { value: model, ready, error } = useSpatialModel();
  if (!ready || !model) return <div className="map-loading"><span className="data-label">Loading spatial field…</span>{error && <p>{error}</p>}</div>;
  return <div className="explorer">
    <header className="explorer-head"><div className="container explorer-head-inner"><div><p className="eyebrow">Urban Heat Explorer</p><h1>One field, explicit coverage limits.</h1></div><div className="explorer-solar"><SolarTimeline hour={hour} onChange={setHour} /></div></div></header>
    <div className="explorer-body">
      <HeatMap model={model} hour={hour} selected={selected} onPick={setSelected} />
      <aside className="explorer-side">
        <section className="panel"><h2 className="panel-title">Coverage</h2><p className="panel-copy">{model.metadata.coverage.description}</p><p className="panel-copy"><strong>Global satellite layer:</strong> NASA MODIS Terra daytime land-surface temperature tiles load only for the visible map area. UAE and worldwide tiles are available, but they are a separate observed satellite product rather than the Dubai modelled potential.</p><div className="coverage-chips">{model.metadata.coverage.requiredAreas.map((name) => <span className="coverage-chip" key={name}>{name}</span>)}</div><p className="mono small-note">{model.metadata.coverage.observedCells.toLocaleString()} supported Dubai cells · {model.grid.cellSizeM} m local analysis · global tile source approx. 1 km</p></section>
        <section className="panel"><h2 className="panel-title">Thermal field</h2><ThermalScale /><p className="panel-copy">The smooth coloured field and contours are the Dubai model only where supported cells exist. Outside that footprint, the map shows NASA MODIS land-surface temperature tiles with cloud and observation gaps. These products are not interchangeable.</p><ProvenanceNote kind="DERIVED" className="mt" /></section>
        <section className="panel"><h2 className="panel-title">Land-cover inputs</h2><ul className="method-list"><li>Mapped buildings, roads, vegetation, water, runways and bare land</li><li>Transparent daylight multiplier, not a weather feed</li><li>No shade layer: shade is not shown as observed data</li></ul></section>
      </aside>
      {selected && <LocationPanel model={model} point={selected} hour={hour} onClose={() => setSelected(null)} />}
    </div>
  </div>;
}

function LocationPanel({ model, point, hour, onClose }: { model: NonNullable<ReturnType<typeof useSpatialModel>['value']>; point: SelectedPoint; hour: number; onClose: () => void }) {
  const field = useMemo(() => calculateBaseField(model, hour), [model, hour]); const sample = useMemo(() => createFieldSampler(model, field)(point.lon, point.lat), [model, field, point]);
  if (!sample) return <div className="loc-panel panel" role="dialog"><div className="loc-panel-head"><div><span className="data-label">Selected location</span><h3>{point.label}</h3></div><button className="icon-btn" onClick={onClose} aria-label="Close panel">×</button></div><p>This point is outside the Dubai OSM-supported modelled field. THERMO does not extrapolate a local potential or land-cover scenario here. The global NASA MODIS layer is visual context only.</p></div>;
  const { cell, value, interpolated } = sample; const band = heatBand(value);
  return <div className="loc-panel panel" role="dialog" aria-label={`Thermal analysis: ${point.label}`}><div className="loc-panel-head"><div><span className="data-label">Selected location</span><h3>{point.label}</h3></div><button className="icon-btn" onClick={onClose} aria-label="Close panel">×</button></div>
    <div className="loc-band"><span className="data-label">Modelled thermal potential</span><div className="loc-band-main"><strong>{bandLabel(band)}</strong><span className="loc-band-num">{Math.round(value)}<small>/100</small></span></div><div className="loc-band-bar" aria-hidden="true"><span style={{ width: `${value}%` }} /></div></div>
    <dl className="loc-metrics"><div className="metric"><dt>Dominant mapped cover</dt><dd>{cell.cover}</dd></div><div className="metric"><dt>Vegetation support</dt><dd>{Math.round(cell.g * 100)}%</dd></div><div className="metric"><dt>Road support</dt><dd>{Math.round(cell.road * 100)}%</dd></div><div className="metric"><dt>Building cover</dt><dd>{Math.round(cell.b * 100)}%</dd></div></dl>
    <p className="loc-why"><span className="data-label">Resolution note</span><span className="loc-why-text">{interpolated ? 'Display value interpolated from nearby supported 750 m cells.' : 'Nearest supported 750 m source cell.'} It is not an observed temperature.</span></p><ProvenanceNote kind="DERIVED" />
  </div>;
}
