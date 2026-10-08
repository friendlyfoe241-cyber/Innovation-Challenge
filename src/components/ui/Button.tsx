import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps {
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'light';
  size?: 'md' | 'lg';
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaLabel?: string;
}

export function Button({
  to,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  type = 'button',
  disabled,
  ariaLabel,
}: ButtonProps) {
  const cls = `btn btn-${variant} btn-${size} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}