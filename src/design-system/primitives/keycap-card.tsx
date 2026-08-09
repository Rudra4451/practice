'use client';

import React from 'react';

export interface KeycapCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'sm' | 'md' | 'lg';
  isHoverable?: boolean;
  children: React.ReactNode;
}

export const KeycapCard: React.FC<KeycapCardProps> = ({
  elevation = 'md',
  isHoverable = true,
  className = '',
  children,
  ...props
}) => {
  const elevationStyles = {
    sm: "shadow-[0_4px_0_var(--border)]",
    md: "shadow-[0_6px_0_var(--border)]",
    lg: "shadow-[0_8px_0_var(--border)]",
  };

  const hoverStyles = isHoverable
    ? "hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-140 ease-out"
    : "";

  return (
    <div
      className={`bg-surface/80 backdrop-blur-md border-[1.5px] border-border rounded-[18px] p-6 text-text-primary ${elevationStyles[elevation]} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
