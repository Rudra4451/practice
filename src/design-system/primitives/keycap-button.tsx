'use client';

import React, { forwardRef } from 'react';

export interface KeycapButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isPressed?: boolean;
  children: React.ReactNode;
}

export const KeycapButton = forwardRef<HTMLButtonElement, KeycapButtonProps>(({
  variant = 'primary',
  size = 'md',
  isPressed = false,
  className = '',
  children,
  disabled,
  onClick,
  onKeyDown,
  ...props
}, ref) => {
  const baseStyles = "relative inline-flex items-center justify-center font-bold tracking-wide transition-all duration-140 ease-out select-none cursor-pointer rounded-[18px] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const variantStyles = {
    primary: "bg-surface border-[1.5px] border-border text-text-primary shadow-[0_6px_0_var(--border)] hover:bg-surface-elevated active:translate-y-[3px] active:shadow-[0_3px_0_var(--border)]",
    secondary: "bg-surface-accent border-[1.5px] border-border/60 text-text-secondary shadow-[0_6px_0_var(--border)] hover:bg-surface-elevated hover:text-text-primary active:translate-y-[3px] active:shadow-[0_3px_0_var(--border)]",
    accent: "bg-accent text-white border-[1.5px] border-accent/80 shadow-[0_6px_0_rgba(255,92,0,0.4)] hover:bg-accent-secondary active:translate-y-[3px] active:shadow-[0_3px_0_rgba(255,92,0,0.4)]",
    danger: "bg-error text-white border-[1.5px] border-error/80 shadow-[0_6px_0_rgba(224,62,62,0.4)] hover:bg-error/90 active:translate-y-[3px] active:shadow-[0_3px_0_rgba(224,62,62,0.4)]",
    ghost: "bg-transparent text-text-secondary border-[1.5px] border-transparent hover:border-border hover:bg-surface/50 hover:text-text-primary shadow-none active:translate-y-[1px]",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[36px]",
    md: "px-5 py-2.5 text-sm gap-2 min-h-[44px]",
    lg: "px-7 py-3.5 text-base gap-2.5 min-h-[52px]",
  };

  const pressedStyles = isPressed ? "translate-y-[3px] shadow-[0_3px_0_var(--border)]" : "";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Allow keyboard activation
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${pressedStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

KeycapButton.displayName = 'KeycapButton';
