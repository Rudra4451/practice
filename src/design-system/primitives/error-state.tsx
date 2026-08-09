'use client';

import React from 'react';
import { KeycapButton } from './keycap-button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => {
  return (
    <div className="w-full p-6 bg-error/10 border-[1.5px] border-error/30 rounded-[20px] flex flex-col items-center justify-center text-center gap-3">
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-error">System Alert</span>
      <h3 className="font-display text-base font-bold text-text-primary">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm">{message}</p>
      {onRetry && (
        <KeycapButton variant="danger" size="sm" onClick={onRetry} className="mt-2">
          Retry Action
        </KeycapButton>
      )}
    </div>
  );
};
