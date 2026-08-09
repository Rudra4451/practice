'use client';

import React from 'react';

export interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'data' | 'code';
  className?: string;
  children: React.ReactNode;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  className = '',
  children,
}) => {
  switch (variant) {
    case 'h1':
      return <h1 className={`font-display text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary ${className}`}>{children}</h1>;
    case 'h2':
      return <h2 className={`font-display text-2xl md:text-3xl font-bold tracking-tight text-text-primary ${className}`}>{children}</h2>;
    case 'h3':
      return <h3 className={`font-display text-xl md:text-2xl font-semibold text-text-primary ${className}`}>{children}</h3>;
    case 'h4':
      return <h4 className={`font-display text-lg font-semibold text-text-primary ${className}`}>{children}</h4>;
    case 'caption':
      return <span className={`font-sans text-xs font-semibold uppercase tracking-wider text-text-tertiary ${className}`}>{children}</span>;
    case 'data':
      return <span className={`typing-font font-mono text-base font-bold text-accent ${className}`}>{children}</span>;
    case 'code':
      return <code className={`typing-font font-mono text-sm px-1.5 py-0.5 rounded bg-surface-accent border border-border text-text-primary ${className}`}>{children}</code>;
    case 'body':
    default:
      return <p className={`font-sans text-sm md:text-base leading-relaxed text-text-secondary ${className}`}>{children}</p>;
  }
};
