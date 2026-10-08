import { useMemo, useState } from 'react';
import { HeatMap, type LayerFlags, type SelectedPoint } from '../components/maps/HeatMap';
import { ThermalScale } from '../components/ui/ThermalScale';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { DistrictQuickLinks } from '../components/ui/DistrictQuickLinks';
import { DISTRICTS } from '../data/places';
import { layers } from '../data/datasets';
import { heatIndexFor, surfaceTempFor, airTempAtTile, bandLabel, heatBand, shadePotential } from '../lib/heat/heatModel';
import { districtStatsFor } from '../lib/heat/districtStats';
import { type LonLat } from '../types/domain';

const DEFAULT_FLAGS: LayerFlags = {
  heat: true,
  vegetation: false,
  built: true,
  water: true,
  roads: false,
  pois: false,
  districts: true,
};

export default function ExplorerPage() {
  const [hour, setHour] = useState<number>(14);
  const [flags, setFlags] = useState<LayerFlags>(DEFAULT_FLAGS);
  const [selected, setSelected] = useState<SelectedPoint | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const allTiles = layers.tiles;
  const districts = useMemo(() => districtStatsFor(DISTRICTS, hour), [hour]);

  const toggle = (k: keyof LayerFlags) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  return (
    <div className="explorer">
      <header className="explorer-head">
        <div className="container explorer-head-inner">
          <div>
            <p className="eyebrow">Urban Heat Explorer</p>
            <h1>Where does the city feel hottest?</h1>
          </div>
          <div className="explorer-solar">
            <SolarTimeline hour={hour} onChange={(h) => setHour(h)} />
          </div>
        </div>
      </header>

      <div className="explorer-body">
        <HeatMap
          hour={hour}
          layersFlags={flags}
          onPick={(p) => setSelected(p)}
          selected={selected}
          focusSignal={focusSignal}
        />
        <aside className="explorer-side">
          <section className="panel">
            <h2 className="panel-title">Layers</h2>
            <LayerToggleRow label="Heat exposure" active={flags.heat} onToggle={() => toggle('heat')} />
            <LayerToggleRow label="Vegetation" active={flags.vegetation} onToggle={() => toggle('vegetation')} />
            <LayerToggleRow label="Built-up density" active={flags.built} onToggle={() => toggle('built')} />
            <LayerToggleRow label="Water" active={flags.water} onToggle={() => toggle('water')} />
            <LayerToggleRow label="Roads" active={flags.roads} onToggle={() => toggle('roads')} />
            <LayerToggleRow label="Schools (POI)" active={flags.pois} onToggle={() => toggle('pois')} />
          </section>

          <section className="panel">
            <h2 className="panel-title">Neighbourhoods</h2>
            <DistrictQuickLinks
              districts={districts}
              onFocus={(lon, lat, z) => {
                setSelected({ lon, lat, label: '' });
                setFocusSignal((s) => s + 1);
                void z;
              }}
            />
          </section>

          <section className="panel">
            <h2 className="panel-title">Heat scale</h2>
            <ThermalScale />
            <ProvenanceNote kind="DERIVED" className="mt" />
          </section>
        </aside>

        {selected && <LocationPanel point={selected} hour={hour} onClose={() => setSelected(null)} tiles={allTiles} />}
      </div>
    </div>
  );
}

function LayerToggleRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button className={`layer-row ${active ? 'is-on' : ''}`} onClick={onToggle} role="switch" aria-checked={active}>
      <span className="layer-dot" aria-hidden="true" />
      <span>{label}</span>
      <span className="layer-switch" aria-hidden="true" />
    </button>
  );
}

function LocationPanel({
  point,
  hour,
  onClose,
  tiles,
}: {
  point: SelectedPoint;
  hour: number;
  onClose: () => void;
  tiles: { lon: number; lat: number; r: number; c: number; b: number; p: number; g: number; wt: number; pd: number; h: number }[];
}) {
  const tile = useMemo(() => {
    const pt: LonLat = { lon: point.lon, lat: point.lat };
    let best: (typeof tiles)[number] | null = null;
    let bestD = Infinity;
    for (const t of tiles) {
      const d = Math.hypot(t.lat - pt.lat, t.lon - pt.lon);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }, [point, tiles]);

  if (!tile) return null;
  const hi = Math.round(heatIndexFor(tile, hour));
  const band = heatBand(hi);
  const st = surfaceTempFor(tile, hour);
  const air = airTempAtTile(tile, hour);
  const shade = Math.round(shadePotential(tile) * 100);
  const name = point.label || `${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`;

  return (
    <div className="loc-panel panel" role="dialog" aria-label={`Heat analysis: ${name}`}>
      <div className="loc-panel-head">
        <div>
          <span className="data-label">Selected location</span>
          <h3>{name}</h3>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      <div className="loc-band">
        <span className="data-label">Heat Exposure</span>
        <div className="loc-band-main">
          <strong>{bandLabel(band)}</strong>
          <span className="loc-band-num">{hi}<small>/100</small></span>
        </div>
        <div className="loc-band-bar" aria-hidden="true">
          <span style={{ width: `${hi}%` }} />
        </div>
      </div>

      <dl className="loc-metrics">
        <div className="metric">
          <dt>Surface temperature (model)</dt>
          <dd>{st.toFixed(1)} °C</dd>
        </div>
        <div className="metric">
          <dt>Air temperature (model)</dt>
          <dd>{air.toFixed(1)} °C</dd>
        </div>
        <div className="metric">
          <dt>Vegetation</dt>
          <dd>{Math.round(tile.g * 100)}%</dd>
        </div>
        <div className="metric">
          <dt>Shade potential</dt>
          <dd>{shade}%</dd>
        </div>
        <div className="metric">
          <dt>Built density</dt>
          <dd>{Math.round(tile.b * 100)}%</dd>
        </div>
      </dl>

      <p className="loc-why">
        <span className="data-label">Why this score</span>
        <span className="loc-why-text">
          {hi >= 64 ? 'Intense built-up geometry and sparse vegetation raise modelled heat retention.' : ''}
          {hi >= 50 && hi < 64 ? 'Moderate density with limited shade keeps exposure elevated.' : ''}
          {hi < 50 ? 'Leafy cover and/or water bring the modelled exposure down.' : ''}
        </span>
      </p>
      <ProvenanceNote kind="DERIVED" />
    </div>
  );
}