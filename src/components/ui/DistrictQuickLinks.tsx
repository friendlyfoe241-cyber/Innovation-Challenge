import type { DistrictStats } from '../../lib/heat/districtStats';

/** Compact list of district chips that focus the map on an area. */
export function DistrictQuickLinks({
  districts,
  onFocus,
}: {
  districts: DistrictStats[];
  onFocus: (lon: number, lat: number, zoom: number) => void;
}) {
  return (
    <div className="district-list">
      {districts.map((d) => (
        <button key={d.id} className="district-chip" onClick={() => onFocus(d.lon, d.lat, 14)}>
          <span className="district-chip-name">{d.name}</span>
          <span className={`district-chip-band band-pill band-${d.band}`}>
            <span className="band-dot" aria-hidden="true" />
            {d.bandName}
          </span>
          <span className="district-chip-hei">{d.heatIndex}<small> hi</small></span>
        </button>
      ))}
    </div>
  );
}