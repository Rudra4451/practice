'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/stores/toast-store';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          let toneClass = 'bg-accent text-accent-foreground border border-border';
          let Icon = CheckCircle;

          if (toast.type === 'error') {
            toneClass = 'bg-error text-error-foreground border border-border';
            Icon = AlertCircle;
          } else if (toast.type === 'info') {
            toneClass = 'bg-surface-elevated text-text-primary border border-border';
            Icon = Info;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              className={`pointer-events-auto rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg font-sans font-semibold text-xs ${toneClass}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="min-w-[36px] min-h-[36px] -mr-1.5 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
