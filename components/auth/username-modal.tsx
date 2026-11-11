'use client';

import React, { useState } from 'react';
import { useUserStore } from '@/stores/user-store';
import { useToastStore } from '@/stores/toast-store';
import { Button } from '@/components/ui/button';
import {
  isReservedUsername,
  isTemporaryGeneratedUsername,
  normalizeUsername,
  USERNAME_PATTERN,
} from '@/lib/security/username';
import { AlertCircle, User, Check } from 'lucide-react';

export const UsernameModal = () => {
  const { session, profile, setProfile } = useUserStore();
  const { showToast } = useToastStore();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const needsUsername = Boolean(
    session && profile && isTemporaryGeneratedUsername(profile.username)
  );

  if (!needsUsername || !session || !profile) return null;

  const metaDisplayName =
    (typeof session.user?.user_metadata?.full_name === 'string' &&
      session.user.user_metadata.full_name) ||
    (typeof session.user?.user_metadata?.display_name === 'string' &&
      session.user.user_metadata.display_name) ||
    '';
  const resolvedDisplayName = displayName ?? metaDisplayName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = normalizeUsername(username);
    const cleanDisplayName = resolvedDisplayName.trim() || cleanUsername;

    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    if (cleanUsername.length > 24) {
      setErrorMsg('Username cannot exceed 24 characters.');
      return;
    }

    if (!USERNAME_PATTERN.test(cleanUsername)) {
      setErrorMsg('Username can only contain lowercase letters, numbers, and underscores.');
      return;
    }

    if (isTemporaryGeneratedUsername(cleanUsername)) {
      setErrorMsg('This username format is reserved. Please choose a different name.');
      return;
    }

    if (isReservedUsername(cleanUsername)) {
      setErrorMsg('This username is reserved. Please choose a different name.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: cleanUsername,
          displayName: cleanDisplayName,
        }),
      });

      const json = (await response.json()) as {
        success?: boolean;
        error?: string;
        profile?: typeof profile;
      };

      if (!response.ok || !json.profile) {
        setErrorMsg(json.error || 'An error occurred. Please try again.');
        return;
      }

      setProfile({
        ...profile,
        username: json.profile.username,
        display_name: json.profile.display_name,
      });

      showToast('Profile updated successfully!');
    } catch (err: unknown) {
      console.error('Failed to set username:', err);
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
    >
      <div className="w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-xl relative flex flex-col gap-6 animate-fade-in font-sans">
        <div className="flex flex-col gap-2 border-b border-border pb-4">
          <h2 id="username-modal-title" className="text-xl font-bold tracking-tight text-text-primary font-display">
            Choose Your Handle
          </h2>
          <p className="text-xs font-medium text-text-secondary">
            Set up your unique public profile handle for leaderboards and 1v1 challenges.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-error/10 border border-error/40 text-error text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username-input" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Unique Username *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-semibold font-mono text-text-secondary select-none">
                u/
              </span>
              <input
                id="username-input"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                required
                maxLength={24}
                disabled={loading}
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border focus:border-accent rounded-xl text-sm font-semibold font-mono transition-colors outline-none text-text-primary"
              />
            </div>
            <span className="text-xs text-text-secondary">
              Lowercase letters, numbers, and underscores. 3 to 24 characters.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="displayname-input" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Display Name (Optional)
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-text-secondary" />
              <input
                id="displayname-input"
                type="text"
                placeholder="Your Name"
                value={resolvedDisplayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-accent rounded-xl text-sm font-semibold transition-colors outline-none text-text-primary"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !username}
            variant="primary"
            className="w-full mt-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Handle</span>
          </Button>
        </form>
      </div>
    </div>
  );
};
