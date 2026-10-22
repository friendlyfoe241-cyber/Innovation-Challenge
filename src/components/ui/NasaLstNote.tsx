/**
 * NASA satellite LST context note.
 *
 * The GIBS tiles are a historical NASA browse product (visual context only).
 * They are NOT a live temperature map and NOT THERMO's Dubai modelled
 * potential index. The facts below are verified against NASA/GIBS and
 * LAADS documentation (see DATA.md); the colour scale has no reliable
 * degree-Celsius interpretation in this implementation, so no Celsius
 * legend is drawn.
 */
import { useState } from 'react';
import { NASA_LST } from '../../data/nasaLst';

/** Compact map-overlay note (used on Explorer / Route / Simulate maps). */
export function NasaLstMapNote({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`nasa-lst-note ${className}`} data-open={open ? 'true' : 'false'}>
      <button
        className="nasa-lst-note-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="nasa-lst-note-details"
      >
        <span className="data-label">NASA LST · VIEW ONLY</span>
        <span className="nasa-lst-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div id="nasa-lst-note-details" className="nasa-lst-note-body">
          <p>{NASA_LST.product}. Configured date: {NASA_LST.date}. Native source resolution {NASA_LST.resolution}.</p>
          <p>This layer is <strong>visual satellite context only</strong>. It is not used in THERMO's modelled potential (0–100), routing costs or simulations, and it does not measure air temperature or human heat exposure. Cloud and retrieval gaps may leave areas transparent.</p>
          <p className="small-note">Colours are a browse-product palette; no Celsius legend is implied. <a href="https://modis.gsfc.nasa.gov/data/dataprod/mod11.php" target="_blank" rel="noreferrer">MODIS MOD11</a> · <a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata</a></p>
        </div>
      )}
    </div>
  );
}

/** Expanded sidebar note for the Explorer page. */
export function NasaLstPanelNote() {
  return (
    <section className="panel">
      <h2 className="panel-title">Satellite context layer</h2>
      <dl className="data-card-meta nasa-lst-meta">
        <div><dt>Source</dt><dd>{NASA_LST.source}</dd></div>
        <div><dt>Product</dt><dd>{NASA_LST.product}</dd></div>
        <div><dt>Units / value</dt><dd>{NASA_LST.units}</dd></div>
        <div><dt>Configured date</dt><dd>{NASA_LST.date}</dd></div>
        <div><dt>Resolution</dt><dd>{NASA_LST.resolution}</dd></div>
        <div><dt>Role</dt><dd>{NASA_LST.role}</dd></div>
      </dl>
      <p className="panel-copy">{NASA_LST.limitation}</p>
      <div className="prov-key">
        <span className="prov-tag" data-prov="OBSERVED">OBSERVED</span>
        <span className="prov-key-text">NASA browse imagery; visual context only</span>
      </div>
      <p className="mono small-note">
        <a href="https://modis.gsfc.nasa.gov/data/dataprod/mod11.php" target="_blank" rel="noreferrer">MODIS MOD11</a> ·{' '}
        <a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata</a> ·{' '}
        <a href="https://data.humdata.org/dataset/cod-ab-are" target="_blank" rel="noreferrer">HDX Dubai boundary</a>
      </p>
    </section>
  );
}