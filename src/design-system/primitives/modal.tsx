'use client';

import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div 
        className="w-full max-w-lg bg-surface border-[1.5px] border-border rounded-[24px] p-6 shadow-[0_12px_0_var(--border)] relative flex flex-col gap-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 id="modal-title" className="font-display text-lg font-bold text-text-primary uppercase tracking-wide">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary text-xs font-bold font-mono px-2 py-1 bg-surface-accent rounded-lg border border-border/50"
              aria-label="Close dialog"
            >
              ESC ✕
            </button>
          </div>
        )}
        <div className="py-2">{children}</div>
      </div>
    </div>
  );
};
