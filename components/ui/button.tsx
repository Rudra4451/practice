'use client';

import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  href?: string;
  className?: string;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  href,
  className = '',
  loading = false,
}) => {
  const baseClass =
    'relative inline-flex items-center justify-center gap-2 px-5 py-2.5 font-sans text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer select-none rounded-xl active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-accent text-white hover:brightness-110 shadow-sm shadow-accent/20 hover:shadow-md hover:shadow-accent/25',
    secondary:
      'bg-surface border border-border text-text-primary hover:bg-surface-accent hover:border-border/80 shadow-xs',
    ghost:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-accent',
    danger:
      'bg-error text-white hover:brightness-110 shadow-sm shadow-error/20',
  };

  const combinedClass = `${baseClass} ${variantClasses[variant]} ${className}`;

  const content = loading ? (
    <>
      <svg className="w-4 h-4 animate-spin-smooth" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {children}
    </>
  ) : (
    children
  );

  if (href) {
    return (
      <Link href={href} className={combinedClass} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={combinedClass}
      onClick={onClick}
    >
      {content}
    </button>
  );
};
