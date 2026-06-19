'use client';

import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  href?: string;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  href,
  className = '',
}) => {
  const baseClass =
    'inline-flex items-center justify-center gap-2 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer select-none border-3 border-border';

  const variantClasses = {
    primary:
      'bg-accent text-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_var(--border)] active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:pointer-events-none',
    secondary:
      'bg-surface-accent text-text-primary hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_var(--border)] active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:pointer-events-none',
    danger:
      'bg-error text-white hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_var(--border)] active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:pointer-events-none',
  };

  const combinedClass = `${baseClass} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={combinedClass} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={combinedClass}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
