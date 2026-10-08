import { DIURNAL_TIMES } from '../../lib/heat/heatModel';

/**
 * Solar timeline widget: shows the sun moving along an arc as the
 * selected time of day changes. Semantic labels for accessibility.
 */
export function SolarTimeline({
  hour,
  onChange,
  disabled = false,
}: {
  hour: number;
  onChange: (h: number) => void;
  disabled?: boolean;
}) {
  const idx = DIURNAL_TIMES.indexOf(hour as (typeof DIURNAL_TIMES)[number]);
  const t = idx === -1 ? 0 : idx / (DIURNAL_TIMES.length - 1);

  const x = 20 + t * 160;
  const y = 74 - Math.sin(t * Math.PI) * 56;

  return (
    <div className={`solar-timeline ${disabled ? 'is-disabled' : ''}`}>
      <svg viewBox="0 0 200 88" role="img" aria-label="Sun position over the day" className="solar-svg">
        <path d="M 20 74 Q 100 4 180 74" fill="none" stroke="var(--line-2)" strokeWidth="1.5" strokeDasharray="3 5" />
        <defs>
          <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7d9a0" />
            <stop offset="100%" stopColor="#f6f2ea" />
          </linearGradient>
        </defs>
        <path d="M 20 74 Q 100 4 180 74 Z" fill="url(#sky-grad)" opacity="0.28" />
        {/* time ticks */}
        <g className="solar-ticks">
          {DIURNAL_TIMES.map((h, i) => {
            const tx = 20 + (i / (DIURNAL_TIMES.length - 1)) * 160;
            const ty = 74 - Math.sin((i / (DIURNAL_TIMES.length - 1)) * Math.PI) * 56;
            return <circle key={h} cx={tx} cy={ty} r="2" fill={h === hour ? 'none' : 'var(--ink-3)'} stroke={h === hour ? 'var(--ember)' : 'none'} />;
          })}
        </g>
        <g>
          <circle cx={x} cy={y} r="9" fill="var(--sun)" stroke="var(--ember)" strokeWidth="1.4" className="solar-disc" />
          <line x1={x - 13} y1={y} x2={x + 13} y2={y} stroke="var(--ember)" strokeWidth="1" className="solar-rays" />
        </g>
      </svg>
      <div className="solar-time" aria-live="polite">
        <span className="data-label">Time of day</span>
        <output className="solar-clock">
          {String(Math.floor(hour / 1)).padStart(2, '0')}:00
        </output>
      </div>
      <div className="solar-control" role="group" aria-label="Hour of day">
        {DIURNAL_TIMES.map((h) => (
          <button
            key={h}
            className={h === hour ? 'is-active' : ''}
            onClick={() => onChange(h)}
            disabled={disabled}
            aria-pressed={h === hour}
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}