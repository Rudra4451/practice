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
        <div className="flex items-center gap-2 border-b border-border/10 pb-4">
          <Settings className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-bold">Account Settings & Preferences</h1>
        </div>

        {/* Configurations Box */}
        <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col gap-6 shadow-sm">
          {/* Theme Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Visual Theme</span>
            </span>
            <div className="flex gap-4 mt-1">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 p-4 border rounded-xl font-semibold text-sm transition-all ${
                  preferences.theme === 'dark'
                    ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent/15'
                    : 'border-border hover:border-border/80 text-text-secondary'
                }`}
              >
                Dark Mode
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 p-4 border rounded-xl font-semibold text-sm transition-all ${
                  preferences.theme === 'light'
                    ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent/15'
                    : 'border-border hover:border-border/80 text-text-secondary'
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
            <div className="flex gap-4 mt-1">
              <button
                onClick={() => handleFontChange('ibm-plex-mono')}
                className={`flex-1 p-4 border rounded-xl text-sm transition-all font-mono ${
                  preferences.font_family === 'ibm-plex-mono'
                    ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent/15 font-bold'
                    : 'border-border hover:border-border/80 text-text-secondary'
                }`}
              >
                IBM Plex Mono
              </button>
              <button
                onClick={() => handleFontChange('geist-mono')}
                className={`flex-1 p-4 border rounded-xl text-sm transition-all font-mono ${
                  preferences.font_family === 'geist-mono'
                    ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent/15 font-bold'
                    : 'border-border hover:border-border/80 text-text-secondary'
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
        <div className="flex justify-end">
          <a
            href="/typing"
            className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-accent/25"
          >
            <Save className="w-4 h-4" />
            <span>Save & Start Typing</span>
          </a>
        </div>
      </main>
    </div>
  );
}
