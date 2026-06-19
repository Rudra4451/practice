'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/stores/toast-store';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgClass = 'bg-accent text-black';
          let Icon = CheckCircle;

          if (toast.type === 'error') {
            bgClass = 'bg-bauhaus-red text-white';
            Icon = AlertCircle;
          } else if (toast.type === 'info') {
            bgClass = 'bg-surface-accent text-text-primary';
            Icon = Info;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto border-3 border-border p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_var(--border)] font-sans font-black uppercase tracking-wider text-xs ${bgClass}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="p-1 hover:bg-border/20 transition-colors cursor-pointer"
                aria-label="Dismiss toast"
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
