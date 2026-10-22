import { TileLayer } from 'react-leaflet';

/**
 * Global fallback layer, loaded as viewport tiles by Leaflet rather than as a
 * bundled raster. This is NASA's coloured MODIS Terra daytime land-surface
 * temperature browse product, not THERMO's Dubai modelled potential.
 *
 * The fixed date keeps the deployed build reproducible. Tiles are requested
 * only for the current map viewport and zoom, so the app does not ship a UAE
 * or world-sized raster file.
 */
export const GLOBAL_LST_DATE = '2025-01-01';
export const GLOBAL_LST_SOURCE_URL = 'https://modis.gsfc.nasa.gov/data/dataprod/mod11.php';
export const GLOBAL_LST_WMTS_URL = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${GLOBAL_LST_DATE}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;

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
    attribution='&copy; NASA MODIS LST via <a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a>'
  />;
}
