import type { ReactNode } from 'react';

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <header className={`section-head section-head-${align} ${className}`} data-reveal>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="section-title">{title}</h2>
      {intro ? <div className="section-intro">{intro}</div> : null}
    </header>
  );
}