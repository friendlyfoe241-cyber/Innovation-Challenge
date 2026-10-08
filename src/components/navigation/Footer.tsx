import { Link } from 'react-router-dom';
import { Wordmark } from '../ui/Wordmark';

const LINKS = [
  { to: '/explore', label: 'Heat Explorer' },
  { to: '/route', label: 'Route Planner' },
  { to: '/simulate', label: 'Intervention Simulator' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/about', label: 'Methodology' },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Wordmark />
          <p>
            See the heat. Find the shade. Shape cooler cities.
            <br />
            Heat-aware urban intelligence, built for Dubai.
          </p>
          <p className="footer-note">
            Demonstration prototype for the GEMS Global Innovation Challenge 2026–27.
            All temperatures and heat indices are modelled estimates.
          </p>
        </div>
        <div className="footer-col">
          <h3>Product</h3>
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-col">
          <h3>Data</h3>
          <ul>
            <li>
              <Link to="/about#data">Data sources</Link>
            </li>
            <li>
              <Link to="/about#model">Heat model</Link>
            </li>
            <li>
              <Link to="/about#limits">Limitations</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 THERMO</span>
        <span>
          OpenStreetMap data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM contributors (ODbL)</a>
        </span>
        <span>Not intended as a medical heat-warning system.</span>
      </div>
    </footer>
  );
}