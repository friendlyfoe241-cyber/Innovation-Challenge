import { Link } from 'react-router-dom';

export function SunMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="14" cy="17" r="7" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="14" cy="17" r="2.1" fill="currentColor" />
      <path
        d="M14 3v3M14 25v3M4 17h3M21 17h3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect
        x="24.5"
        y="22"
        width="6"
        height="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.85"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="THERMO — home">
      <span className="wordmark-mark">
        <SunMark size={24} />
      </span>
      <span className="wordmark-text">THERMO</span>
    </Link>
  );
}