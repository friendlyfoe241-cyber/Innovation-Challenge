import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroField } from '../components/hero/HeroField';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Button } from '../components/ui/Button';
import { SolarTimeline } from '../components/ui/SolarTimeline';
import { ProvenanceNote } from '../components/ui/Provenance';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { timeFactor } from '../lib/heat/heatModel';

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
            <span className="data-label">Demonstration</span>
            <strong>Downtown · DIFC · Zabeel</strong>
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
                A city doesn&rsquo;t have one temperature. It has thousands.
              </>
            }
          />
          <div className="reveal-group">
            <p>
              Street surfaces, building density, vegetation and shade can push the heat felt in two
              nearby streets several degrees apart. On a hot Dubai day, the difference between an
              open car park and a shaded avenue can be the difference between a comfortable walk and
              an unsafe one.
            </p>
            <p>
              Most navigation tools optimise for distance or time. Neither tells you what the sun and
              the street are doing to you.
            </p>
          </div>
        </div>
        <div className="problem-stats reveal-group">
          <div className="stat-tile">
            <span className="stat-num">10–15 °C</span>
            <span className="stat-cap">
              Modelled surface temperature can vary within a single district
            </span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">Shade</span>
            <span className="stat-cap">Is the most effective street-level intervention</span>
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
  const [probe, setProbe] = useState({ upfield: 0, downfield: 0 });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const f = timeFactor(hour);
    setProbe({ upfield: Math.round(f * 100), downfield: Math.round(38.6 - (1 - f) * 6.4) });
  }, [hour]);

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
              <span className="data-label">Model · surface heat signature</span>
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
                <span className="data-label">Modelled peak exposure</span>
                <strong className={probe.upfield > 70 ? 'is-hot' : ''}>{probe.upfield}/100</strong>
              </div>
              <div>
                <span className="data-label">Normative air temp (model)</span>
                <strong>{probe.downfield} °C</strong>
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
              From Dubai Mall to DIFC at 2:30 PM, the fastest route follows open plazas and exposed
              service roads. A route barely longer stays in shade and alongside vegetation.
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
              <span className="data-label">Dubai Mall → DIFC · 14:30</span>
              <span className="prov-tag" data-prov="DERIVED">
                Derived
              </span>
            </div>
            <ul className="route-list">
              <li className="route-item route-item-fast">
                <div className="route-meta">
                  <strong>Fastest</strong>
                  <span>12 min · 1.0 km</span>
                </div>
                <div className="route-bar">
                  <span className="bar-fill" style={{ width: '88%' }} />
                </div>
                <span className="route-heat is-high">High exposure</span>
              </li>
              <li className="route-item route-item-bal">
                <div className="route-meta">
                  <strong>Balanced</strong>
                  <span>14 min · 1.1 km</span>
                </div>
                <div className="route-bar">
                  <span className="bar-fill" style={{ width: '55%' }} />
                </div>
                <span className="route-heat is-mid">Moderate exposure</span>
              </li>
              <li className="route-item route-item-cool route-recommended">
                <div className="route-meta">
                  <strong>Cooler</strong>
                  <span>17 min · 1.3 km</span>
                </div>
                <div className="route-bar">
                  <span className="bar-fill" style={{ width: '24%' }} />
                </div>
                <span className="route-heat is-low">Low exposure</span>
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
          title={<>What happens when the city gets more shade?</>}
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
              <span className="data-label">Baseline · exposed plaza</span>
              <div className="sim-heatnum is-mid">78</div>
              <div className="sim-heatbar">
                <span style={{ width: '78%' }} />
              </div>
            </div>
            <div className="sim-arrow" aria-hidden="true">
              {`\u2193`}
            </div>
            <div className="sim-scenario">
              <span className="data-label">Scenario · +shade · +vegetation</span>
              <div className="sim-heatnum is-low">61</div>
              <div className="sim-heatbar">
                <span style={{ width: '61%' }} />
              </div>
            </div>
          </div>
          <div className="sim-demo-copy">
            <div className="sim-delta">
              <span className="data-label">Modelled improvement</span>
              <strong>−22%</strong>
              <p>
                A modelled scenario, not a measurement. Adding shade structures over the walkways and
                tree cover across open ground reduces the prototype heat index.
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