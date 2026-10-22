/**
 * Global fallback layer, loaded as viewport tiles by Leaflet rather than as a
 * bundled raster. This is NASA's coloured MODIS Terra daytime land-surface
 * temperature browse product, not THERMO's Dubai modelled potential.
 *
 * Layer and product constants live in src/data/nasaLst.ts (single source of
 * truth, shared with the UI notes). The fixed date keeps the deployed build
 * reproducible. Tiles are requested only for the current map viewport and
 * zoom, so the app does not ship a UAE or world-sized raster file.
 */
import { TileLayer } from 'react-leaflet';
import { GLOBAL_LST_WMTS_URL } from '../../data/nasaLst';

export function GlobalThermalLayer({ opacity = 0.38 }: { opacity?: number }) {
  return <TileLayer
    url={GLOBAL_LST_WMTS_URL}
    opacity={opacity}
    minZoom={2}
    maxZoom={18}
    maxNativeZoom={7}
    tileSize={256}
    keepBuffer={2}
    updateWhenIdle
    attribution='NASA MODIS LST <a href="https://modis.gsfc.nasa.gov/data/dataprod/mod11.php" target="_blank" rel="noreferrer">MOD11</a> &copy; NASA Earthdata <a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">GIBS</a>'
  />;
}
