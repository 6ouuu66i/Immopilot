import { Building2 } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';

export function PasswordReset() {
  const {
    isAuthenticated,
    isLoading,
    isPasswordRecovery,
    requestPasswordReset,
    updatePassword,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionRef = useRef(false);
  const canUpdatePassword = isPasswordRecovery && isAuthenticated;

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current) return;
    submissionRef.current = true;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email.trim());
      setSuccess("Si un compte correspond à cette adresse, un e-mail de récupération a été envoyé.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible d'envoyer l'e-mail de récupération.");
    } finally {
      submissionRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current) return;
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    submissionRef.current = true;
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess('Mot de passe mis à jour.');
      window.history.replaceState(null, '', `${window.location.pathname}#dashboard`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Impossible de mettre à jour le mot de passe.');
    } finally {
      submissionRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="ip-login-page">
      <section className="ip-login-panel" aria-labelledby="password-reset-title">
        <div className="ip-login-brand">
          <span className="ip-brand-mark" aria-hidden="true">
            <Building2 size={19} strokeWidth={1.9} />
          </span>
          <div>
            <strong>ImmoPilot</strong>
            <span>Récupération du compte</span>
          </div>
        </div>

        <div className="ip-login-heading">
          <h1 id="password-reset-title">
            {canUpdatePassword ? 'Nouveau mot de passe' : 'Mot de passe oublié'}
          </h1>
          <p>
            {canUpdatePassword
              ? 'Choisissez un nouveau mot de passe pour votre compte.'
              : 'Saisissez votre adresse e-mail pour recevoir un lien de récupération.'}
          </p>
        </div>

        {canUpdatePassword ? (
          <form className="ip-login-form" onSubmit={handleUpdate}>
            <label>
              <span>Nouveau mot de passe</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label>
              <span>Confirmer le mot de passe</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
                type="password"
                value={passwordConfirmation}
              />
            </label>
            {error && <p className="ip-login-error">{error}</p>}
            {success && <p>{success}</p>}
            <button className="ip-login-submit" disabled={isSubmitting || isLoading} type="submit">
              {isSubmitting ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </form>
        ) : (
          <form className="ip-login-form" onSubmit={handleRequest}>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            {error && <p className="ip-login-error">{error}</p>}
            {success && <p>{success}</p>}
            <button className="ip-login-submit" disabled={isSubmitting || isLoading} type="submit">
              {isSubmitting ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <button className="ip-login-switch" onClick={() => { window.location.hash = '#login'; }} type="button">
          Retour à la connexion
        </button>
      </section>
    </main>
  );
}
