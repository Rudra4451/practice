import { createClient as createBrowserClient } from './client';
import { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Signs out the current user session.
 */
export async function signOut() {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Retrieves the current session client-side.
 */
export async function getClientSession() {
  const supabase = createBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Retrieves the profile of a given user ID from public profiles.
 * Safe to call on both client (using client-passed DB instance) and server.
 */
export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error(`Error retrieving profile for user ${userId}:`, error.message);
    return null;
  }
  return data;
}
