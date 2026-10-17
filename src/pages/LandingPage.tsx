import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroField } from '../components/hero/HeroField';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Button } from '../components/ui/Button';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { daylightFactor } from '../lib/heat/heatModel';

export default function LandingPage() {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      // Hero sequencing
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .fromTo(
          '.hero-copy > *',
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.09, duration: 0.9, delay: 0.15 },
        )
        .fromTo(
          '.hero-cta > *',
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.1, duration: 0.7 },
          '-=0.55',
        );

      // Scroll-triggered reveals
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 26, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 82%', once: true },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>('.reveal-group > *').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 22, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power2.out',
            stagger: 0.08,
            scrollTrigger: { trigger: el.parentElement, start: 'top 80%', once: true },
          },
        );
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [reduced]);

  return (
    <div className="landing">
      <Hero />
      <ProblemSection />
      <HeatSection />
      <RouteSection />
      <ChangeSection />
      <PlatformSection />
      <FinalCta />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="hero">
      <div className="hero-field-wrap" aria-hidden="true">
        <HeroField />
        <div className="hero-field-veil" />
      </div>
      <div className="container hero-content">
        <p className="eyebrow hero-eyebrow">THERMO · Dubai urban heat intelligence</p>
        <div className="hero-copy">
          <h1>
            Cities don&rsquo;t heat evenly.
            <br />
            <em>Neither should your route.</em>
          </h1>
          <p className="hero-lede">
            THERMO combines environmental data, urban characteristics and route analysis to help
            people understand urban heat, navigate it more safely, and test how cities could reduce
            it.
          </p>
        </div>
        <div className="hero-cta">
          <Button to="/explore" variant="primary" size="lg">
            Explore the Heat
          </Button>
          <Button to="/route" variant="ghost" size="lg">
            Plan a Cooler Route
          </Button>
        </div>
        <div className="hero-readouts">
          <div className="hero-readout">
            <span className="data-label">City</span>
            <strong>Dubai, UAE</strong>
          </div>
          <div className="hero-readout">
            <span className="data-label">Coverage</span>
            <strong>OSM-supported urban Dubai</strong>
          </div>
          <div className="hero-readout">
            <span className="data-label">Data</span>
            <strong>OpenStreetMap + THERMO model</strong>
          </div>
        </div>
      </div>
      <a className="scroll-hint" href="#problem" aria-label="Scroll to the problem section">
        <span />
        Scroll
      </a>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ProblemSection() {
  return (
    <section id="problem" className="landing-section problem">
      <div className="container problem-grid">
        <div>
          <SectionHeading
            eyebrow="The problem"
            title={
              <>
                A city doesn&rsquo;t have one exposure pattern. It has thousands.
              </>
            }
          />
          <div className="reveal-group">
            <p>
              Street surfaces, building density, vegetation and water shape urban thermal exposure.
              THERMO uses the mapped geometry that supports a location and makes its coverage limits
              visible instead of filling every district with invented values.
            </p>
            <p>
              Most navigation tools optimise for distance or time. Neither tells you what the sun and
              the street are doing to you.
            </p>
          </div>
        </div>
        <div className="problem-stats reveal-group">
          <div className="stat-tile">
            <span className="stat-num">750 m</span>
            <span className="stat-cap">
              Source-cell resolution; smooth display does not add observations
            </span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">Masks</span>
            <span className="stat-cap">Keep scenarios on eligible mapped surfaces</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">Real streets</span>
            <span className="stat-cap">
              THERMO starts from actual urban geometry, not averages
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function HeatSection() {
  const [hour, setHour] = useState<number>(12);
  const reduced = usePrefersReducedMotion();
  const daylight = Math.round(daylightFactor(hour) * 100);

  return (
    <section className="landing-section heat-showcase">
      <div className="container">
        <SectionHeading
          eyebrow="See the heat"
          title={<>Watch exposure move through the city as the day turns.</>}
          intro={
            <>
              <p>
                Starting with real street geometry from OpenStreetMap, THERMO models how surfaces
                retain and re-radiate heat hour by hour.
              </p>
              <Link to="/explore" className="text-link">
                Open the Heat Explorer {`\u2192`}
              </Link>
            </>
          }
        />
        <div className="heat-demo reveal-group">
          <div className="heat-demo-panel">
            <div className={`heat-pulse ${reduced ? '' : 'is-anim'}`}>
              <span className="data-label">Model · relative daylight signature</span>
              <div className="heat-pulse-bars" aria-hidden="true">
                {Array.from({ length: 42 }, (_, i) => {
                  const amp = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + hour));
                  return (
                    <span
                      key={i}
                      className="hp-bar"
                      style={{
                        height: `${10 + amp * 56}%`,
                        background: `hsl(${Math.min(38, 8 + amp * 30)} ${50 + amp * 30}% ${
                          46 + amp * 6
                        }%)`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="heat-demo-controls">
            <p className="data-label">Move through the day</p>
            <SolarTimeline hour={hour} onChange={(h) => setHour(h)} />
            <div className="heat-demo-readouts">
              <div>
                <span className="data-label">Daylight factor</span>
                <strong className={daylight > 70 ? 'is-hot' : ''}>{daylight}/100</strong>
              </div>
              <div>
                <span className="data-label">Field resolution</span>
                <strong>750 m</strong>
              </div>
            </div>
            <ProvenanceNote kind="SIMULATED" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function RouteSection() {
  return (
    <section className="landing-section route-showcase">
      <div className="container route-grid">
        <div className="route-copy">
          <SectionHeading
            eyebrow="Move through it"
            title={<>The same journey. Very different heat.</>}
          />
          <div className="reveal-group">
            <p>
              THERMO requests real walk/cycle paths from an OSM network. The heat-aware options make
              selected high-potential source cells unavailable before the network search begins.
            </p>
            <p>
              THERMO shows you the trade-off — time, distance and heat exposure — instead of picking
              a single &ldquo;correct&rdquo; answer.
            </p>
            <Button to="/route" variant="ghost">
              Plan a cooler route {`\u2192`}
            </Button>
          </div>
        </div>
        <div className="route-demo reveal-group">
          <div className="route-card">
            <div className="route-card-head">
              <span className="data-label">Live OSM route search</span>
              <span className="prov-tag" data-prov="DERIVED">
                Derived
              </span>
            </div>
            <ul className="route-list">
              <li className="route-item route-item-fast">
                <div className="route-meta">
                  <strong>Fastest</strong>
                  <span>no thermal exclusion</span>
                </div>
                <div className="route-bar">
                  <span className="bar-fill" style={{ width: '88%' }} />
                </div>
                <span className="route-heat is-high">Travel-time baseline</span>
              </li>
              <li className="route-item route-item-bal">
                <div className="route-meta">
                  <strong>Balanced</strong>
                  <span>very-high cells avoided</span>
                </div>
                <div className="route-bar">
                  <span className="bar-fill" style={{ width: '55%' }} />
                </div>
                <span className="route-heat is-mid">Pre-search constraint</span>
              </li>
              <li className="route-item route-item-cool route-recommended">
                <div className="route-meta">
                  <strong>Coolest</strong>
                  <span>high cells avoided</span>
                </div>
                <div className="route-bar">
                  <span className="bar-fill" style={{ width: '24%' }} />
                </div>
                <span className="route-heat is-low">Guardrails on detours</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ChangeSection() {
  return (
    <section className="landing-section change-showcase">
      <div className="container">
        <SectionHeading
          eyebrow="Change the city"
          title={<>What changes on eligible surfaces?</>}
          align="center"
          intro={
            <>
              <p>
                THERMO doesn&rsquo;t only show the problem. It lets you test interventions and see
                where they matter most.
              </p>
            </>
          }
        />
        <div className="sim-demo reveal-group">
          <div className="sim-demo-stack">
            <div className="sim-current">
              <span className="data-label">Baseline · shared source field</span>
              <div className="sim-heatnum is-mid">BASE</div>
              <div className="sim-heatbar">
                <span style={{ width: '72%' }} />
              </div>
            </div>
            <div className="sim-arrow" aria-hidden="true">
              {`\u2193`}
            </div>
            <div className="sim-scenario">
              <span className="data-label">Scenario · masked intervention</span>
              <div className="sim-heatnum is-low">SIM</div>
              <div className="sim-heatbar">
                <span style={{ width: '49%' }} />
              </div>
            </div>
          </div>
          <div className="sim-demo-copy">
            <div className="sim-delta">
              <span className="data-label">Modelled difference</span>
              <strong>Local</strong>
              <p>
                A scenario, not a measurement: vegetation, walkway shade, cool surfaces and depaving
                operate only where the OSM-supported land-cover masks allow them.
              </p>
              <ProvenanceNote kind="SIMULATED" />
              <Button to="/simulate" variant="ghost" className="sim-cta">
                Open the intervention simulator {`\u2192`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PlatformSection() {
  const steps = [
    { n: '01', t: 'Observe', d: 'See where heat concentrates and why, street by street.' },
    { n: '02', t: 'Navigate', d: 'Choose routes that respect both your time and your exposure.' },
    { n: '03', t: 'Improve', d: 'Test interventions and compare scenarios before anything is built.' },
  ];
  return (
    <section className="landing-section platform">
      <div className="container">
        <SectionHeading eyebrow="One platform" title="Observe. Navigate. Improve." align="center" />
        <div className="platform-steps reveal-group">
          {steps.map((s, i) => (
            <div className="platform-step" key={s.n}>
              <span className="platform-stepnum">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              {i < steps.length - 1 ? <span className="platform-connector" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="landing-section final-cta">
      <div className="container final-cta-inner">
        <h2>Find the hotter streets. Take the cooler route.</h2>
        <p>Built for Dubai — from real street geometry and an honest analytical model.</p>
        <div className="hero-cta">
          <Button to="/explore" variant="primary" size="lg">
            Explore THERMO
          </Button>
          <Button to="/about" variant="ghost" size="lg">
            Read the methodology
          </Button>
        </div>
      </div>
    </section>
  );
}
