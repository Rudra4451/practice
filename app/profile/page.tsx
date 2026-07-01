'use client';

import React from 'react';
import { useUserStore } from '@/stores/user-store';
import { Navbar } from '@/components/navbar';
import { Settings, Eye, Sliders, Volume2, Save } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { preferences, updatePreferences } = useUserStore();

  const handleThemeChange = (theme: 'light' | 'dark') => {
    updatePreferences({ theme });
  };

  const handleFontChange = (font: string) => {
    updatePreferences({ font_family: font });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    updatePreferences({ volume: vol });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12 flex flex-col gap-8 font-sans">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 pb-6 relative">
          <div className="absolute -top-10 left-0 w-32 h-32 bg-accent/20 blur-[60px] rounded-full pointer-events-none" />
          <Settings className="w-8 h-8 text-accent drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] z-10" />
          <h1 className="text-3xl font-black uppercase tracking-tight text-text-primary z-10">Account Settings</h1>
        </div>

        {/* Configurations Box */}
        <div className="p-8 bg-surface/30 backdrop-blur-md border border-border/60 rounded-2xl flex flex-col gap-8 shadow-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-surface/50 to-transparent pointer-events-none" />
          {/* Theme Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Visual Theme</span>
            </span>
            <div className="flex gap-4 mt-1 relative z-10">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 p-5 border rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm ${
                  preferences.theme === 'dark'
                    ? 'border-accent/50 bg-accent/10 text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                    : 'border-border/60 bg-surface/40 hover:bg-surface/80 text-text-secondary'
                }`}
              >
                Dark Mode
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 p-5 border rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm ${
                  preferences.theme === 'light'
                    ? 'border-accent/50 bg-accent/10 text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                    : 'border-border/60 bg-surface/40 hover:bg-surface/80 text-text-secondary'
                }`}
              >
                Light Mode
              </button>
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Monospace Font Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Typing Font Family</span>
            </span>
            <div className="flex gap-4 mt-1 relative z-10">
              <button
                onClick={() => handleFontChange('ibm-plex-mono')}
                className={`flex-1 p-5 border rounded-xl text-xs transition-all font-mono shadow-sm ${
                  preferences.font_family === 'ibm-plex-mono'
                    ? 'border-accent/50 bg-accent/10 text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-black uppercase tracking-wider'
                    : 'border-border/60 bg-surface/40 hover:bg-surface/80 text-text-secondary font-bold uppercase tracking-wider'
                }`}
              >
                IBM Plex Mono
              </button>
              <button
                onClick={() => handleFontChange('geist-mono')}
                className={`flex-1 p-5 border rounded-xl text-xs transition-all font-mono shadow-sm ${
                  preferences.font_family === 'geist-mono'
                    ? 'border-accent/50 bg-accent/10 text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-black uppercase tracking-wider'
                    : 'border-border/60 bg-surface/40 hover:bg-surface/80 text-text-secondary font-bold uppercase tracking-wider'
                }`}
              >
                Geist Mono
              </button>
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Sound FX volume */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Audio Feedback Volume</span>
            </span>
            <div className="flex items-center gap-4 mt-1">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={preferences.volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 bg-border/40 hover:bg-border/60 rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="font-mono text-xs text-text-primary w-8 text-right">
                {Math.round(preferences.volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div className="flex justify-end relative z-10">
          <a
            href="/typing"
            className="flex items-center gap-2 px-8 py-4 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
          >
            <Save className="w-4 h-4" />
            <span>Save & Start Typing</span>
          </a>
        </div>
      </main>
    </div>
  );
}
