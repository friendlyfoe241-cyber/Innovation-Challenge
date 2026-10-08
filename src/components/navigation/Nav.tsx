import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Wordmark } from '../ui/Wordmark';

const ITEMS = [
  { to: '/explore', label: 'Explore' },
  { to: '/route', label: 'Routes' },
  { to: '/simulate', label: 'Simulate' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/about', label: 'Methodology' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="nav">
      <div className="nav-inner container">
        <Wordmark />
        <nav aria-label="Primary" className={`nav-menu ${open ? 'is-open' : ''}`}>
          {ITEMS.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="nav-burger"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}