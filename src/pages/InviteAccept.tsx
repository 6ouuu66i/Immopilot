import { Building2 } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { clearCapturedInviteToken, getCapturedInviteToken } from '../lib/inviteToken';
import { agentsService } from '../lib/services/agentsService';

// F-002: this page is rendered outside ProtectedRoute (see src/main.tsx) because an
// invitee is not authenticated yet on first visit. It self-contains both the
// unauthenticated (sign in / create account) and authenticated (accept) states rather
// than redirecting to the standalone #login route, so the invitation token -- captured
// once into memory by captureAndStripInviteToken() before this component ever mounts --
// never needs to be persisted to any storage to survive a route change. See
// src/lib/inviteToken.ts for the token-capture design and src/lib/posthog.ts for the
// analytics-side redaction.
//
// Deliberate scope decision: this page does not look up or display the invitation's
// target email before authentication (that would require a new, unauthenticated RLS
// read path on agency_invitations, which is out of scope for this fix). The user simply
// signs in / signs up with the email their invitation was sent to; a mismatch is caught
// by accept_invitation() server-side and surfaced as a clear error.

type FlowState =
  | { kind: 'missing-token' }
  | { kind: 'loading' }
  | { kind: 'need-auth' }
  | { kind: 'accepting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; canRetryWithDifferentAccount: boolean };

type AuthMode = 'sign-in' | 'sign-up';

function redirectToDashboard() {
  window.history.replaceState(null, '', `${window.location.pathname}#dashboard`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function InviteAccept() {
  const { isAuthenticated, isLoading, signIn, signUp, signOut, refreshProfile } = useAuth();
  const [token] = useState<string | null>(() => getCapturedInviteToken());
  const [flow, setFlow] = useState<FlowState>(() => (token ? { kind: 'loading' } : { kind: 'missing-token' }));
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const hasAttemptedAcceptRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setFlow({ kind: 'missing-token' });
      return;
    }
    if (isLoading) {
      setFlow({ kind: 'loading' });
      return;
    }
    if (!isAuthenticated) {
      setFlow({ kind: 'need-auth' });
      return;
    }

    // Authenticated: attempt acceptance exactly once per mount, even under
    // React.StrictMode's double-invoke of effects in development.
    if (hasAttemptedAcceptRef.current) return;
    hasAttemptedAcceptRef.current = true;

    setFlow({ kind: 'accepting' });

    agentsService
      .acceptInvitation(token)
      .then(async () => {
        await refreshProfile();
        clearCapturedInviteToken();
        setFlow({ kind: 'success' });
        redirectToDashboard();
      })
      .catch((error: unknown) => {
        clearCapturedInviteToken();
        const message = error instanceof Error ? error.message : "Une erreur est survenue lors de l'acceptation de l'invitation.";
        const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
        setFlow({
          kind: 'error',
          message,
          canRetryWithDifferentAccount: code === 'email_mismatch',
        });
      });
  }, [token, isLoading, isAuthenticated, refreshProfile]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      if (authMode === 'sign-in') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      // On success, isAuthenticated flips via onAuthStateChange and the effect above
      // re-runs to attempt acceptance. If email confirmation is required for new
      // accounts, isAuthenticated stays false here -- surface that explicitly.
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentification impossible.');
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleSwitchAccount() {
    await signOut();
    setEmail('');
    setPassword('');
    setAuthMode('sign-in');
  }

  return (
    <main className="ip-login-page">
      <section className="ip-login-panel" aria-labelledby="invite-title">
        <div className="ip-login-brand">
          <span className="ip-brand-mark" aria-hidden="true">
            <Building2 size={19} strokeWidth={1.9} />
          </span>
          <div>
            <strong>ImmoPilot</strong>
            <span>Rejoindre une agence</span>
          </div>
        </div>

        {flow.kind === 'missing-token' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Lien d'invitation invalide</h1>
            <p>Ce lien ne contient pas de jeton d'invitation valide. Demandez à votre administrateur de vous renvoyer une invitation.</p>
          </div>
        )}

        {flow.kind === 'loading' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Chargement...</h1>
          </div>
        )}

        {flow.kind === 'accepting' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Acceptation de l'invitation...</h1>
            <p>Merci de patienter.</p>
          </div>
        )}

        {flow.kind === 'success' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Invitation acceptée</h1>
            <p>Redirection vers votre tableau de bord...</p>
          </div>
        )}

        {flow.kind === 'error' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Impossible d'accepter l'invitation</h1>
            <p>{flow.message}</p>
            {flow.canRetryWithDifferentAccount && (
              <button className="ip-login-submit" onClick={handleSwitchAccount} type="button">
                Se connecter avec un autre compte
              </button>
            )}
          </div>
        )}

        {flow.kind === 'need-auth' && (
          <>
            <div className="ip-login-heading">
              <h1 id="invite-title">{authMode === 'sign-in' ? 'Connexion' : 'Créer un compte'}</h1>
              <p>Connectez-vous ou créez un compte avec l'adresse e-mail à laquelle l'invitation a été envoyée.</p>
            </div>

            <form className="ip-login-form" onSubmit={handleAuthSubmit}>
              <label>
                <span>Email</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="agent@agence.be"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label>
                <span>Mot de passe</span>
                <input
                  autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  type="password"
                  value={password}
                />
              </label>

              {authError && <p className="ip-login-error">{authError}</p>}

              <button className="ip-login-submit" disabled={isSubmittingAuth} type="submit">
                {isSubmittingAuth
                  ? 'Veuillez patienter...'
                  : authMode === 'sign-in'
                    ? 'Se connecter et accepter'
                    : 'Créer le compte et accepter'}
              </button>
            </form>

            <button
              className="ip-login-switch"
              onClick={() => setAuthMode((mode) => (mode === 'sign-in' ? 'sign-up' : 'sign-in'))}
              type="button"
            >
              {authMode === 'sign-in' ? "Pas encore de compte ? Créez-en un" : 'Déjà un compte ? Connectez-vous'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
