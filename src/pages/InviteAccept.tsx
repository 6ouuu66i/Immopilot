import { Building2 } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { clearCapturedInviteToken, getCapturedInviteToken } from '../lib/inviteToken';
import { isInvitationResumeRequest } from '../lib/invitationSignUp';
import { agentsService } from '../lib/services/agentsService';

// F-002: this page is rendered outside ProtectedRoute (see src/main.tsx) because an
// invitee is not authenticated yet on first visit. It self-contains both the
// unauthenticated (sign in / create account) and authenticated (accept) states rather
// than redirecting to the standalone #login route. Before signup, the invitation token
// is captured only in memory. If email confirmation is required, a server-only,
// auth.uid()-bound context resumes the flow without copying the bearer token into any
// browser storage. See src/lib/inviteToken.ts and the F-006 resume migration.
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
  | { kind: 'signing-up' }
  | { kind: 'email-sent' }
  | { kind: 'awaiting-confirmation' }
  | { kind: 'resuming' }
  | { kind: 'accepting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; canRetryWithDifferentAccount: boolean };

type AuthMode = 'sign-in' | 'sign-up';

function redirectToDashboard() {
  window.history.replaceState(null, '', `${window.location.pathname}#dashboard`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function clearInvitationCallbackUrl() {
  window.history.replaceState(null, '', `${window.location.pathname}#invite`);
}

export function InviteAccept() {
  const { isAuthenticated, isLoading, signIn, signUpWithInvitation, signOut, refreshProfile } = useAuth();
  const [token] = useState<string | null>(() => getCapturedInviteToken());
  const [isResumeRequest] = useState(() => isInvitationResumeRequest());
  const [flow, setFlow] = useState<FlowState>(() => (
    isResumeRequest ? { kind: 'resuming' } : token ? { kind: 'loading' } : { kind: 'missing-token' }
  ));
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const hasAttemptedAcceptRef = useRef(false);
  const authSubmissionRef = useRef(false);
  const acceptanceModeRef = useRef<'direct' | 'resume'>(isResumeRequest ? 'resume' : 'direct');

  useEffect(() => {
    if (!token && !isResumeRequest) {
      setFlow({ kind: 'missing-token' });
      return;
    }
    if (isLoading) {
      setFlow(isResumeRequest ? { kind: 'resuming' } : { kind: 'loading' });
      return;
    }
    if (!isAuthenticated) {
      if (isResumeRequest) {
        clearInvitationCallbackUrl();
        setFlow({
          kind: 'error',
          message: "La confirmation n'a pas pu être reprise. Demandez une nouvelle invitation.",
          canRetryWithDifferentAccount: false,
        });
        return;
      }
      setFlow({ kind: 'need-auth' });
      return;
    }

    // Authenticated: attempt acceptance exactly once per mount, even under
    // React.StrictMode's double-invoke of effects in development.
    if (hasAttemptedAcceptRef.current) return;
    hasAttemptedAcceptRef.current = true;

    const shouldResumeOnServer = isResumeRequest || acceptanceModeRef.current === 'resume';

    if (isResumeRequest) {
      // Auth has consumed the callback fragment. Remove both that sensitive fragment
      // and the non-sensitive resume marker before the RPC or analytics can retain it.
      clearInvitationCallbackUrl();
      setFlow({ kind: 'resuming' });
    } else {
      setFlow({ kind: 'accepting' });
    }

    const acceptance = shouldResumeOnServer
      ? agentsService.resumeInvitationSignup()
      : agentsService.acceptInvitation(token as string);

    if (shouldResumeOnServer) setFlow({ kind: 'accepting' });

    acceptance
      .then(async () => {
        await refreshProfile();
        clearCapturedInviteToken();
        setFlow({ kind: 'success' });
        redirectToDashboard();
      })
      .catch((error: unknown) => {
        const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
        const canRetryWithDifferentAccount = !isResumeRequest && code === 'email_mismatch';
        if (!canRetryWithDifferentAccount) clearCapturedInviteToken();
        setFlow({
          kind: 'error',
          message: error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de l'acceptation de l'invitation.",
          canRetryWithDifferentAccount,
        });
      });
  }, [token, isResumeRequest, isLoading, isAuthenticated, refreshProfile]);

  useEffect(() => {
    if (flow.kind !== 'email-sent') return;
    const timer = window.setTimeout(() => setFlow({ kind: 'awaiting-confirmation' }), 1200);
    return () => window.clearTimeout(timer);
  }, [flow.kind]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSubmissionRef.current) return;
    authSubmissionRef.current = true;
    setAuthError(null);
    setIsSubmittingAuth(true);
    if (authMode === 'sign-up') setFlow({ kind: 'signing-up' });

    try {
      if (authMode === 'sign-in') {
        acceptanceModeRef.current = 'direct';
        await signIn(email.trim(), password);
      } else {
        if (!token) throw new Error('Authentification impossible.');
        acceptanceModeRef.current = 'resume';
        const result = await signUpWithInvitation(email.trim(), password, token);
        if (result.requiresEmailConfirmation) setFlow({ kind: 'email-sent' });
      }
      // On success, isAuthenticated flips via onAuthStateChange and the effect above
      // re-runs to attempt acceptance. If email confirmation is required for new
      // accounts, isAuthenticated stays false here -- surface that explicitly.
    } catch {
      setAuthError('Authentification impossible. Vérifiez vos informations ou demandez une nouvelle invitation.');
      setFlow({ kind: 'need-auth' });
    } finally {
      authSubmissionRef.current = false;
      setIsSubmittingAuth(false);
    }
  }

  async function handleSwitchAccount() {
    await signOut();
    hasAttemptedAcceptRef.current = false;
    acceptanceModeRef.current = 'direct';
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
            <p>ImmoPilot est actuellement accessible sur invitation.</p>
            <p>Ce lien ne contient pas de jeton d'invitation valide. Demandez à votre administrateur de vous renvoyer une invitation.</p>
          </div>
        )}

        {flow.kind === 'loading' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Chargement...</h1>
          </div>
        )}

        {flow.kind === 'signing-up' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Création du compte...</h1>
            <p>Vérification de votre invitation.</p>
          </div>
        )}

        {flow.kind === 'email-sent' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">E-mail de confirmation envoyé</h1>
            <p>Consultez votre boîte de réception pour confirmer votre adresse.</p>
          </div>
        )}

        {flow.kind === 'awaiting-confirmation' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">En attente de confirmation</h1>
            <p>Après confirmation, vous reviendrez automatiquement dans ImmoPilot.</p>
          </div>
        )}

        {flow.kind === 'resuming' && (
          <div className="ip-login-heading">
            <h1 id="invite-title">Reprise de votre invitation...</h1>
            <p>Vérification de votre session confirmée.</p>
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
