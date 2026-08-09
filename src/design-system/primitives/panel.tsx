'use client';

import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'blueprint' | 'glass';
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    default: "bg-surface border-[1.5px] border-border rounded-[18px]",
    blueprint: "bg-surface/90 border-[1.5px] border-accent/30 rounded-[18px] relative overflow-hidden shadow-xs",
    glass: "glass border-[1.5px] border-border/80 rounded-[18px]",
  };

  return (
    <div className={`${variantStyles[variant]} p-6 ${className}`} {...props}>
      {variant === 'blueprint' && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(var(--accent) 1px, transparent 1px)`,
            backgroundSize: `24px 24px`
          }}
        />
      )}
      {children}
    </div>
  );
};
