#!/usr/bin/env bash
# =============================================================================
# fetch-modis-lst.sh — acquire numerical MODIS LST inputs for THERMO validation
#
# Purpose
#   THERMO's GIBS browse tiles are PNG imagery only; they carry no numeric
#   temperatures. This script documents (and, with an Earthdata Login token,
#   automates) retrieval of the *native numerical* MOD11A1.061 MODIS/Terra LST
#   product that a validation run needs.
#
# Product (verified against NASA LAADS / LP DAAC documentation)
#   MOD11A1.061 — MODIS/Terra Land Surface Temperature/Emissivity Daily
#   L3 Global 1 km SIN Grid. Bands: LST_Day_1km (units K, scale 0.02),
#   QC_Day (mandatory/quality flags), view time/angle, emissivity.
#   Native pixel ≈ 1 km (1200×1200 km sinusoidal tiles). Free to use and
#   redistribute (LP DAAC; MODIS data have no restriction on subsequent use).
#
# Dubai coverage
#   Dubai (≈25.2°N, 55.3°E) falls in SIN tile h23v06. Missing pixels are the
#   result of cloud, or failed/quality-filtered retrievals; they must not be
#   replaced with invented values.
#
# Access (authentication required — NOT available in the CI sandbox)
#   1. Create a free account at https://urs.earthdata.nasa.gov
#   2. Generate a bearer token at https://urs.earthdata.nasa.gov/users/tokens
#   3. Store it in $EARTHDATA_TOKEN (never commit it)
#   4. Optional: pip install h5py or GDAL to convert .hdf bands to CSV/GTiff
#
# Usage
#   export EARTHDATA_TOKEN=tok-...
#   ./scripts/data/fetch-modis-lst.sh 2025-01-01 2025-07-15 h23v06
#
# Output
#   data/source/modis-lst/  — one HDF per date downloaded (only when a token
#                             is present). The CSV conversion step is documented
#                             in the "Prepare inputs" section below and is the
#                             recommended path for the validator.
# =============================================================================
set -u

START="${1:-2025-01-01}"
END="${2:-2025-07-01}"
TILE="${3:-h23v06}"
OUT_DIR="data/source/modis-lst"
mkdir -p "$OUT_DIR"

if [[ -z "${EARTHDATA_TOKEN:-}" ]]; then
  cat >&2 <<'EOF'
No EARTHDATA_TOKEN set.

THERMO's numerical LST validation cannot be completed in this environment
because NASA LP DAAC/CMR data require an Earthdata Login bearer token. The
GIBS PNG tiles the app displays are imagery only. Do NOT attempt to convert
PNG colours into temperatures — there is no verified, reproducible decoding
path from the rendered palette.

Two supported paths once you have credentials / a download:

  Path A — token download (this script):
      export EARTHDATA_TOKEN=tok-...
      ./scripts/data/fetch-modis-lst.sh 2025-01-01 2025-07-01 h23v06

  Path B — manual export via NASA AppEEARS:
      1. https://appeears.earthdatacloud.nasa.gov  → Extracts/New
      2. Files: MOD11A1.061 for your date range
      3. Layers: LST_Day_1km, QC_Day
      4. Output format: GeoTIFF (or CSV point samples)
         — Contain GeoTIFF by export; the validator accepts CSV (lon,lat,lst_k,qc)
         — or convert HDF bands with GDAL:
             gdal_translate -of GTiff \
               "HDF4_EOS:EOS_GRID:\"file.hdf\":MODIS_Grid_Daily_1km_LST:LST_Day_1km" out.tif
  5. Place downloads under data/source/modis-lst/ then run the validator:
       node scripts/data/validate-modis-lst.mjs --csv data/source/modis-lst/lst.csv 2025-01-01
EOF
  exit 1
fi

# Convert a YYYY-MM-DD range into MOD11A1 URLs. GNU `date` is required.
D=$START
while [ "$(date -d "$D" +%Y%m%d)" -le "$(date -d "$END" +%Y%m%d)" ]; do
  YEAR=$(date -d "$D" +%Y)
  DOY=$(date -d "$D" +%j)   # 001–366
  FILE="MOD11A1.A${YEAR}${DOY}.${TILE}.061.hdf"
  URL="https://e4ftl01.cr.usgs.gov/MOLT/MOD11A1.061/${YEAR}.${DOY}/${FILE}"
  if [ ! -f "$OUT_DIR/$FILE" ]; then
    echo "downloading $URL"
    curl -L --fail --retry 2 --max-time 600 \
      -H "Authorization: Bearer ${EARTHDATA_TOKEN}" \
      -o "$OUT_DIR/$FILE" "$URL" \
      || echo "WARN: ${FILE} not retrieved (cloud-gap file may not exist)." >&2
  else
    echo "skip $FILE (exists)"
  fi
  D=$(date -d "$D + 1 day" +%F)
done
echo "done. Files in $OUT_DIR"