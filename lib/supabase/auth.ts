import { createClient as createBrowserClient } from './client';

/**
 * Initiates sign-in using Google OAuth.
 */
export async function signInWithGoogle() {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/**
 * Initiates sign-in using GitHub OAuth.
 */
export async function signInWithGithub() {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}
