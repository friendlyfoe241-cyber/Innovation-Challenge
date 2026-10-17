const BANDS = [
  { label: 'Low', range: '<40', color: 'var(--t-cool)' }, { label: 'Moderate', range: '40–54', color: 'var(--t-mild)' },
  { label: 'Elevated', range: '55–69', color: 'var(--t-warm)' }, { label: 'High', range: '70–81', color: 'var(--t-hot)' }, { label: 'Very high', range: '82+', color: 'var(--t-extreme)' },
];
/** Non-colour-dependent legend for modelled thermal potential, not temperature. */
export function ThermalScale({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return <div className="thermal-scale" aria-label="Modelled thermal potential scale">{BANDS.map((band) => <div key={band.label} className="thermal-scale-step"><span className="thermal-swatch" style={{ background: band.color }} /><span className="thermal-scale-num">{band.range}</span><span className="thermal-scale-label">{band.label}</span></div>)}</div>;
}
export function BandPill({ band, label }: { band: number; label: string }) { return <span className={`band-pill band-${band}`}><span className="band-dot" aria-hidden="true" />{label}</span>; }
