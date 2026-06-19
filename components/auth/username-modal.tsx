'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/user-store';
import { useToastStore } from '@/stores/toast-store';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertCircle, User, Check } from 'lucide-react';

export const UsernameModal = () => {
  const { session, profile, setProfile } = useUserStore();
  const { showToast } = useToastStore();
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check if current username is the default auto-generated pattern: user_[8 hex characters]
  useEffect(() => {
    if (session && profile) {
      const isDefault = /^user_[0-9a-f]{8}$/i.test(profile.username);
      setIsOpen(isDefault);
      if (isDefault) {
        // Pre-fill display name from metadata if available
        const metaName = session.user?.user_metadata?.full_name || session.user?.user_metadata?.display_name || '';
        setDisplayName(metaName);
      }
    } else {
      setIsOpen(false);
    }
  }, [session, profile]);

  if (!isOpen || !session || !profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim() || cleanUsername;

    // 1. Validation
    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    if (cleanUsername.length > 30) {
      setErrorMsg('Username cannot exceed 30 characters.');
      return;
    }

    // Only alphanumeric and underscores
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setErrorMsg('Username can only contain lowercase letters, numbers, and underscores.');
      return;
    }

    // Prevent using the auto-generated template pattern
    if (/^user_[0-9a-f]{8}$/i.test(cleanUsername)) {
      setErrorMsg('This username format is reserved. Please choose a different name.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // 2. Check for duplicate names (uniqueness check)
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        setErrorMsg('Username is already taken. Please try another one.');
        setLoading(false);
        return;
      }

      // 3. Update profile in Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: cleanUsername,
          display_name: cleanDisplayName,
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      // 4. Update local Zustand state
      setProfile({
        ...profile,
        username: cleanUsername,
        display_name: cleanDisplayName,
      });

      showToast('Profile updated successfully!');
      setIsOpen(false);

    } catch (err: any) {
      console.error('Failed to set username:', err);
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      {/* Neobrutalist Modal Card */}
      <div className="w-full max-w-md bg-surface border-3 border-border p-6 shadow-[8px_8px_0px_0px_var(--border)] relative flex flex-col gap-6 animate-fade-in font-sans">
        
        {/* Accent decorations */}
        <div className="absolute -top-3 -right-3 w-6 h-6 bg-bauhaus-yellow border-2 border-border" />
        <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-bauhaus-red border-2 border-border rounded-full" />

        <div className="flex flex-col gap-2 border-b-2 border-border pb-4">
          <h2 className="text-xl font-black uppercase tracking-tight text-text-primary">
            Choose Your Username
          </h2>
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Set up your public profile handle. This cannot be duplicated.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-error/15 border-2 border-error text-error text-xs font-bold uppercase tracking-wide flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username Field */}
          <div className="flex flex-col gap-2">
            <label htmlFor="username-input" className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Unique Username *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs font-bold font-mono text-text-secondary select-none">u/</span>
              <input
                id="username-input"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                required
                disabled={loading}
                className="w-full pl-8 pr-4 py-3 bg-background border-2 border-border focus:border-accent text-sm font-bold font-mono transition-all outline-none text-text-primary"
              />
            </div>
            <span className="text-[10px] text-text-secondary/80 font-bold uppercase">
              Lowercase letters, numbers, and underscores. Min 3 characters.
            </span>
          </div>

          {/* Display Name Field */}
          <div className="flex flex-col gap-2">
            <label htmlFor="displayname-input" className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Display Name (Optional)
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-text-secondary" />
              <input
                id="displayname-input"
                type="text"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-background border-2 border-border focus:border-accent text-sm font-bold transition-all outline-none text-text-primary"
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
            <span>Save Profile</span>
          </Button>
        </form>
      </div>
    </div>
  );
};
