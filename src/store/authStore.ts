import { create } from 'zustand';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthStatus = 'disabled' | 'loading' | 'ready';

export interface AuthActionResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
}

let authSubscription: { unsubscribe: () => void } | null = null;
let subscriberCount = 0;
let sessionRequested = false;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  status: supabase === null ? 'disabled' : 'loading',

  initialize: () => {
    const client = supabase;
    if (client === null) {
      set({ status: 'disabled' });
      return () => undefined;
    }

    subscriberCount += 1;
    if (authSubscription === null) {
      const { data } = client.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          set({ session, user: session?.user ?? null, status: 'ready' });
        },
      );
      authSubscription = data.subscription;
    }

    if (!sessionRequested) {
      sessionRequested = true;
      void client.auth
        .getSession()
        .then(({ data }) => {
          set({ session: data.session, user: data.session?.user ?? null, status: 'ready' });
        })
        .catch(() => {
          set({ session: null, user: null, status: 'ready' });
        });
    }

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0 && authSubscription !== null) {
        authSubscription.unsubscribe();
        authSubscription = null;
        sessionRequested = false;
      }
    };
  },

  signIn: async (email, password) => {
    const client = supabase;
    if (client === null) {
      return { error: 'Cloud features are not configured.' };
    }
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (error: unknown) {
      return { error: toMessage(error) };
    }
  },

  signUp: async (email, password) => {
    const client = supabase;
    if (client === null) {
      return { error: 'Cloud features are not configured.' };
    }
    try {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error !== null) {
        return { error: error.message };
      }
      return { error: null, needsEmailConfirmation: data.session === null };
    } catch (error: unknown) {
      return { error: toMessage(error) };
    }
  },

  signOut: async () => {
    const client = supabase;
    if (client === null) {
      return { error: 'Cloud features are not configured.' };
    }
    try {
      const { error } = await client.auth.signOut();
      if (error !== null) {
        return { error: error.message };
      }
      set({ session: null, user: null });
      return { error: null };
    } catch (error: unknown) {
      return { error: toMessage(error) };
    }
  },
}));
