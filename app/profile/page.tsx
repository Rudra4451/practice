'use client';

import React, { useState } from 'react';
import { useUserStore } from '@/stores/user-store';
import { useToastStore } from '@/stores/toast-store';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { playKeystrokeSound } from '@/lib/audio/keystroke-sound';
import { Settings, Eye, Sliders, Volume2, ArrowRight, Play, Check } from 'lucide-react';

const FONT_OPTIONS = [
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    subtitle: 'High legibility coding mono',
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    subtitle: 'Editorial geometric mono',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    subtitle: 'Tight modern technical mono',
  },
] as const;

export default function ProfileSettingsPage() {
  const { session, profile, setProfile, preferences, updatePreferences } = useUserStore();
  const { showToast } = useToastStore();
  const [savingRemote, setSavingRemote] = useState(false);

  const syncProfilePreference = async (patch: {
    theme?: 'light' | 'dark';
    font_family?: string;
  }) => {
    if (!session?.user) return;
    setSavingRemote(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: { theme?: string; font_family?: string };
      };
      if (!response.ok) {
        showToast(
          json.error || 'Could not sync preferences to account. Kept locally.',
          'error'
        );
        return;
      }

      if (profile && json.profile) {
        setProfile({
          ...profile,
          theme: json.profile.theme ?? profile.theme,
          font_family: json.profile.font_family ?? profile.font_family,
        });
      }
      showToast('Preferences synced to your profile.');
    } catch {
      showToast('Could not sync preferences to account. Kept locally.', 'error');
    } finally {
      setSavingRemote(false);
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark') => {
    updatePreferences({ theme });
    void syncProfilePreference({ theme });
  };

  const handleFontChange = (font: string) => {
    updatePreferences({ font_family: font });
    void syncProfilePreference({ font_family: font });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    updatePreferences({ volume: vol });
  };

  const handleTestSound = () => {
    playKeystrokeSound(preferences.volume, false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 py-10 flex flex-col gap-8 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-surface-accent border border-border flex items-center justify-center text-accent-ink">
              <Settings className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary font-display">
                Practice & Display Settings
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                {session?.user
                  ? savingRemote
                    ? 'Saving preferences to account...'
                    : 'Theme and font settings sync automatically to your account.'
                  : 'Saved automatically in this browser.'}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Card */}
        <div className="p-6 md:p-8 bg-surface border border-border rounded-2xl flex flex-col gap-8 shadow-sm">
          {/* Theme Selector */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent-ink" />
              <span>Color Theme</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { id: 'dark', label: 'Dark Mode', desc: 'Carbon surface with high contrast' },
                  { id: 'light', label: 'Light Mode', desc: 'Paper surface with crisp ink' },
                ] as const
              ).map((option) => {
                const selected = preferences.theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleThemeChange(option.id)}
                    aria-pressed={selected}
                    className={`p-4 min-h-[68px] border rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      selected
                        ? 'border-accent bg-surface-accent text-text-primary shadow-xs'
                        : 'border-border bg-background hover:bg-surface-accent/60 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-text-primary">
                        {option.label}
                      </span>
                      <span className="text-xs text-text-secondary">{option.desc}</span>
                    </div>
                    {selected && (
                      <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-border" />

          {/* Monospace Font Selector */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent-ink" />
              <span>Typing Font Family</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FONT_OPTIONS.map((font) => {
                const selected = preferences.font_family === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => handleFontChange(font.id)}
                    aria-pressed={selected}
                    className={`p-4 min-h-[76px] border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      selected
                        ? 'border-accent bg-surface-accent text-text-primary shadow-xs'
                        : 'border-border bg-background hover:bg-surface-accent/60 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-sm font-semibold font-mono text-text-primary">
                        {font.label}
                      </span>
                      {selected && (
                        <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">{font.subtitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Typography Preview */}
            <div className="p-4 rounded-xl bg-background border border-border flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Live Preview</span>
              <p className="typing-font text-base md:text-lg text-text-primary tracking-wide">
                The quick brown fox jumps over 128 lazy keystrokes;
              </p>
            </div>
          </div>

          <hr className="border-border" />

          {/* Sound FX Volume */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <label
                htmlFor="sound-volume-slider"
                className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4 text-accent-ink" />
                <span>Mechanical Keystroke Audio</span>
              </label>

              <Button
                type="button"
                variant="secondary"
                onClick={handleTestSound}
                className="min-h-[38px] px-3.5 py-1.5 text-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Play Test Click</span>
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <input
                id="sound-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={preferences.volume}
                onChange={handleVolumeChange}
                className="flex-1 h-2 bg-surface-accent rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="font-mono text-xs font-semibold text-text-primary w-12 text-right tabular-nums">
                {Math.round(preferences.volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="flex justify-end">
          <Button href="/typing" variant="primary" className="px-6 py-3">
            <span>Start Practicing</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
