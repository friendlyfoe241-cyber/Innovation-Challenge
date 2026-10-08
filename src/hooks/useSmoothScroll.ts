import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface SmoothScrollOptions {
  enabled?: boolean;
}

/**
 * Initialises Lenis smooth scrolling and keeps GSAP ScrollTrigger in
 * sync. Respects prefers-reduced-motion: when enabled, Lenis and all GSAP
 * scroll animations are skipped.
 */
export function useSmoothScroll({ enabled = true }: SmoothScrollOptions = {}) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduced) {
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Anchors handled by Lenis
    const onClickAnchor = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      if (!target) return;
      const href = (target as HTMLAnchorElement).getAttribute('href');
      if (!href) return;
      const el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -72 });
    };
    document.addEventListener('click', onClickAnchor);

    return () => {
      document.removeEventListener('click', onClickAnchor);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [enabled]);
}

/** Helper for pages that want to scroll to a specific element id. */
export function scrollToId(id: string) {
  const el = document.querySelector(id);
  if (!el) return;
  (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
}