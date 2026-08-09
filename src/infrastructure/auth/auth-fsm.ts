import type { Session } from '@supabase/supabase-js';
import type { ProfileRecord } from '../repositories/profiles.repository';

export type AuthState =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'REFRESHING'
  | 'EXPIRED'
  | 'ERROR';

export type AuthEvent =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { session: Session | Record<string, unknown> | null; profile: ProfileRecord | Record<string, unknown> | null } }
  | { type: 'LOGIN_FAILURE'; error: string }
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; payload: { session: Session | Record<string, unknown> | null } }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'LOGOUT' };

export class AuthFSM {
  private currentState: AuthState = 'UNAUTHENTICATED';
  private session: Session | Record<string, unknown> | null = null;
  private profile: ProfileRecord | Record<string, unknown> | null = null;
  private error: string | null = null;
  private listeners: Array<(state: AuthState) => void> = [];

  public getState(): AuthState {
    return this.currentState;
  }

  public getSession() {
    return this.session;
  }

  public getProfile() {
    return this.profile;
  }

  public getError() {
    return this.error;
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public transition(event: AuthEvent): AuthState {
    const prev = this.currentState;

    switch (event.type) {
      case 'LOGIN_START':
        this.currentState = 'AUTHENTICATING';
        this.error = null;
        break;

      case 'LOGIN_SUCCESS':
        this.currentState = 'AUTHENTICATED';
        this.session = event.payload.session;
        this.profile = event.payload.profile;
        this.error = null;
        break;

      case 'LOGIN_FAILURE':
        this.currentState = 'ERROR';
        this.error = event.error;
        break;

      case 'REFRESH_START':
        this.currentState = 'REFRESHING';
        break;

      case 'REFRESH_SUCCESS':
        this.currentState = 'AUTHENTICATED';
        this.session = event.payload.session;
        break;

      case 'SESSION_EXPIRED':
        this.currentState = 'EXPIRED';
        this.session = null;
        break;

      case 'LOGOUT':
        this.currentState = 'UNAUTHENTICATED';
        this.session = null;
        this.profile = null;
        this.error = null;
        break;
    }

    if (prev !== this.currentState) {
      this.listeners.forEach((l) => l(this.currentState));
    }

    return this.currentState;
  }
}

export const authFSM = new AuthFSM();
