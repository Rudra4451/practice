import { createClient } from '@/lib/supabase/client';
import { authFSM } from './auth-fsm';
import { ProfilesRepository } from '../repositories/profiles.repository';

export class AuthService {
  public static async initializeSession(): Promise<void> {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        authFSM.transition({ type: 'LOGIN_START' });
        const profile = await ProfilesRepository.getById(session.user.id);
        authFSM.transition({
          type: 'LOGIN_SUCCESS',
          payload: { session, profile },
        });
      } else {
        authFSM.transition({ type: 'LOGOUT' });
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_IN' && newSession) {
          authFSM.transition({ type: 'LOGIN_START' });
          const profile = await ProfilesRepository.getById(newSession.user.id);
          authFSM.transition({
            type: 'LOGIN_SUCCESS',
            payload: { session: newSession, profile },
          });
        } else if (event === 'SIGNED_OUT') {
          authFSM.transition({ type: 'LOGOUT' });
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          authFSM.transition({
            type: 'REFRESH_SUCCESS',
            payload: { session: newSession },
          });
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auth initialization failed';
      authFSM.transition({
        type: 'LOGIN_FAILURE',
        error: message,
      });
    }
  }

  public static async signInWithOAuth(provider: 'google' | 'github'): Promise<void> {
    const supabase = createClient();
    authFSM.transition({ type: 'LOGIN_START' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      authFSM.transition({ type: 'LOGIN_FAILURE', error: error.message });
    }
  }

  public static async signOut(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    authFSM.transition({ type: 'LOGOUT' });
  }
}
