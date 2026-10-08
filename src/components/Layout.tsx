import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Nav } from './navigation/Nav';
import { Footer } from './navigation/Footer';
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  useSmoothScroll();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    // Re-initialise scroll on route change.
    window.dispatchEvent(new Event('resize'));
  }, [location.pathname, reduced]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}