import { useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { SpatialModel } from '../../types/domain';
import { DUBAI_DEFAULT_VIEW, mapBoundsFor } from '../../data/datasets';
import { ThermalFieldLayer } from './ThermalFieldLayer';
import { GlobalThermalLayer } from './GlobalThermalLayer';

type ScenarioView = 'baseline' | 'scenario' | 'difference';
export function InterventionMap({ model, values, view }: { model: SpatialModel; values: { baseline: Map<number, number>; scenario: Map<number, number>; difference: Map<number, number> }; view: ScenarioView }) {
  const bounds = useMemo(() => mapBoundsFor(model), [model]);
  const field = view === 'baseline' ? values.baseline : view === 'scenario' ? values.scenario : values.difference;
  return <div className="thermo-map-wrap sim-map-wrap continuous-map-wrap">
    <MapContainer center={[DUBAI_DEFAULT_VIEW.lat, DUBAI_DEFAULT_VIEW.lon]} zoom={DUBAI_DEFAULT_VIEW.zoom} className="thermo-map sim-map" zoomControl={false} minZoom={9} maxZoom={18} maxBounds={bounds} maxBoundsViscosity={0.8} attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM contributors" maxZoom={18} noWrap />
      <GlobalThermalLayer opacity={0.22} />
      <ThermalFieldLayer model={model} values={field} opacity={0.72} palette={view === 'difference' ? 'difference' : 'thermal'} contours={view !== 'difference'} />
    </MapContainer>
    <div className="field-map-note"><span className="data-label">{view === 'difference' ? 'SCENARIO − BASELINE' : view.toUpperCase()}</span><span>{view === 'difference' ? 'blue = lower modelled potential; red = higher' : `${model.grid.cellSizeM} m source cells; smooth rendering does not add observations`}</span></div>
  </div>;
}
