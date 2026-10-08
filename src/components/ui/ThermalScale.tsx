const BANDS = [
  { label: 'Low', color: 'var(--t-cool)' },
  { label: 'Moderate', color: 'var(--t-mild)' },
  { label: 'Elevated', color: 'var(--t-warm)' },
  { label: 'High', color: 'var(--t-hot)' },
  { label: 'Extreme', color: 'var(--t-extreme)' },
];

/** Non-colour-dependent legend for the heat scale. Includes step labels. */
export function ThermalScale({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return (
    <div className="thermal-scale" aria-label="Heat exposure scale">
      {BANDS.map((b, i) => (
        <div key={b.label} className="thermal-scale-step">
          <span className="thermal-swatch" style={{ background: b.color }} />
          <span className="thermal-scale-num">{i + 1}</span>
          <span className="thermal-scale-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function BandPill({ band, label }: { band: number; label: string }) {
  return (
    <span className={`band-pill band-${band}`}>
      <span className="band-dot" aria-hidden="true" />
      {label}
    </span>
  );
}