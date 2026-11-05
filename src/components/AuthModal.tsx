import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

type PendingAction = 'signin' | 'signup' | null;

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const user = useAuthStore((state) => state.user);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signOut = useAuthStore((state) => state.signOut);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pending === null) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, pending]);

  useEffect(() => {
    if (open) {
      setError(null);
      setNotice(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const busy = pending !== null || signingOut;
  const configured = isSupabaseConfigured;

  const handleBackdropClick = () => {
    if (!busy) {
      onClose();
    }
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !configured) {
      return;
    }
    setPending('signin');
    setError(null);
    setNotice(null);
    const result = await signIn(email.trim(), password);
    setPending(null);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setPassword('');
    onClose();
  };

  const handleSignUp = async () => {
    if (busy || !configured) {
      return;
    }
    setPending('signup');
    setError(null);
    setNotice(null);
    const result = await signUp(email.trim(), password);
    setPending(null);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setPassword('');
    if (result.needsEmailConfirmation === true) {
      setNotice('Account created. Check your email to confirm the address, then sign in.');
      return;
    }
    onClose();
  };

  const handleSignOut = async () => {
    if (busy) {
      return;
    }
    setSigningOut(true);
    setError(null);
    const result = await signOut();
    setSigningOut(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleBackdropClick();
        }
      }}
    >
      <div
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="modal-header">
          <h2 id="auth-modal-title">Account</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        {!configured && (
          <p className="auth-message auth-message-warning" role="status">
            Cloud sync is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
          </p>
        )}

        {user !== null ? (
          <div className="auth-account">
            <p className="auth-account-label">Signed in as</p>
            <p className="auth-account-email" title={user.email ?? undefined}>
              {user.email ?? 'Unknown user'}
            </p>
            {error !== null && (
              <p className="auth-message auth-message-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="auth-submit auth-submit-secondary"
              onClick={handleSignOut}
              disabled={busy}
            >
              {signingOut ? 'Signing Out…' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={!configured || busy}
                autoFocus
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                disabled={!configured || busy}
              />
            </label>

            {error !== null && (
              <p className="auth-message auth-message-error" role="alert">
                {error}
              </p>
            )}
            {notice !== null && (
              <p className="auth-message auth-message-notice" role="status">
                {notice}
              </p>
            )}

            <div className="auth-actions">
              <button
                type="submit"
                className="auth-submit"
                disabled={!configured || busy}
              >
                {pending === 'signin' ? 'Signing In…' : 'Sign In'}
              </button>
              <button
                type="button"
                className="auth-submit auth-submit-secondary"
                onClick={handleSignUp}
                disabled={!configured || busy}
              >
                {pending === 'signup' ? 'Signing Up…' : 'Sign Up'}
              </button>
            </div>
            <p className="auth-hint">
              Accounts are managed by Supabase. If email confirmation is enabled in your project,
              confirm the address before signing in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
