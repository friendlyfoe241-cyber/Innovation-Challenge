import type { DataProvenance } from '../../types/domain';

const META: Record<DataProvenance, { label: string; title: string; body: string }> = {
  OBSERVED: {
    label: 'Observed data',
    title: 'Observed data',
    body: 'Sourced from a documented public dataset (OpenStreetMap, via the Overpass API).',
  },
  DERIVED: {
    label: 'Derived',
    title: 'Derived metric',
    body: 'Calculated from observed data using THERMO\u2019s documented formulas.',
  },
  SIMULATED: {
    label: 'Simulation',
    title: 'Modelled estimate',
    body: 'Generated for demonstration with the prototype model. Not a live measurement.',
  },
};

/** Small provenance tag shown next to values. */
export function ProvenanceTag({ kind }: { kind: DataProvenance }) {
  const m = META[kind];
  return (
    <span className="prov-tag" data-prov={kind} title={`${m.title}. ${m.body}`}>
      {m.label}
    </span>
  );
}

/** Standalone provenance note with full explanation. */
export function ProvenanceNote({ kind, className = '' }: { kind: DataProvenance; className?: string }) {
  const m = META[kind];
  return (
    <div className={`prov-note prov-note-${kind} ${className}`} role="note">
      <strong>{m.title}</strong>
      <span>{m.body}</span>
    </div>
  );
}