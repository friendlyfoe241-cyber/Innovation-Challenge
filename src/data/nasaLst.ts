/**
 * Verified NASA/GIBS facts for the MODIS Terra daytime LST browse layer.
 * See DATA.md for the official sources and the "Mapping RGB to Data Values"
 * GIBS caveat. This file is the single source of truth shared by the map
 * layer and the UI notes.
 */

export const GLOBAL_LST_DATE = '2025-01-01';
export const GLOBAL_LST_PRODUCT = 'MODIS_Terra_Land_Surface_Temp_Day';
/** GIBS native product · ~1 km source pixels (MODIS MOD11A1 / MOD11_L2). */
export const GLOBAL_LST_NATIVE_KM = 1;
/**
 * GIBS GoogleMapsCompatible_Level7 tile matrix is 1222.99 m/px; the layer's
 * source observations are the ~1 km MODIS LST product. The two are not the
 * same thing and neither resolves street-level conditions.
 */
export const GLOBAL_LST_LEVEL7_M = 1222.99;
export const GLOBAL_LST_SOURCE_URL = 'https://modis.gsfc.nasa.gov/data/dataprod/mod11.php';
export const GLOBAL_LST_WMTS_URL = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GLOBAL_LST_PRODUCT}/default/${GLOBAL_LST_DATE}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;

export const NASA_LST = {
  source: 'NASA Earthdata GIBS',
  product: 'MODIS Terra daytime Land Surface Temperature (browse product)',
  productId: GLOBAL_LST_PRODUCT,
  nativeProduct: 'MODIS MOD11A1 / MOD11_L2',
  date: '1 January 2025 (configured date, 2025-01-01)',
  resolution: '≈ 1 km native pixels; ≈ 1.2 km per tile pixel at GoogleMapsCompatible_Level7',
  units: 'Kelvin in the source product; the rendered PNG colours are not a documented Celsius legend here',
  role: 'Historical satellite land-surface-temperature context only. Not used in THERMO routing, the 0–100 modelled potential, or simulations.',
  limitation:
    'Satellite pixels represent spatially aggregated surfaces. They do not resolve every street, shaded pavement, building-scale airflow pattern or small vegetation patch, and they can be absent over cloud or failed retrievals. One configured date is not a live feed.',
};