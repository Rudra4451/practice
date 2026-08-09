// TyProX Design System Tokens (Design Bible Specification)

export const DESIGN_TOKENS = {
  keycap: {
    radius: '18px',
    travel: '4px',
    elevationShadow: '6px',
    pressedOffset: '3px',
    pressedShadow: '3px',
  },
  blueprint: {
    strokeWidth: '1.5px',
    gridSize: '24px',
  },
  motion: {
    durationFast: '140ms',
    durationNormal: '200ms',
    durationSlow: '300ms',
    easingMechanical: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    hoverScale: 1.02,
  },
  typography: {
    fonts: {
      display: 'var(--font-space-grotesk), system-ui, sans-serif',
      mono: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      sans: 'var(--font-inter), system-ui, sans-serif',
    },
  },
  colors: {
    accent: '#FF5C00',
    accentSecondary: '#FF7A00',
    error: '#E03E3E',
    success: '#2ECC71',
    warning: '#F39C12',
    dark: {
      background: '#0F0F10',
      surface: '#171717',
      surfaceElevated: '#222222',
      surfaceAccent: '#2E2E2E',
      textPrimary: '#F5F5F5',
      textSecondary: '#A5A5A5',
      textTertiary: '#6C6C6C',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    light: {
      background: '#F5F5F7',
      surface: '#FFFFFF',
      surfaceElevated: '#EAEAEA',
      surfaceAccent: '#DFDFDF',
      textPrimary: '#0F0F10',
      textSecondary: '#555555',
      textTertiary: '#888888',
      border: 'rgba(0, 0, 0, 0.08)',
    },
  },
} as const;
