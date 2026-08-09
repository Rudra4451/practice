'use client';

import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
}) => {
  return (
    <div className="w-full p-8 bg-surface/50 border-[1.5px] border-border/80 border-dashed rounded-[24px] flex flex-col items-center justify-center text-center gap-3">
      {icon && <div className="p-3 bg-surface-accent rounded-full text-accent">{icon}</div>}
      <h3 className="font-display text-lg font-bold text-text-primary">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
