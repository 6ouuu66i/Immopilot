import { Building2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';

export function Login() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.history.replaceState(null, '', `${window.location.pathname === '/login' ? '/' : window.location.pathname}#dashboard`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [isAuthenticated, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      window.history.replaceState(null, '', `${window.location.pathname === '/login' ? '/' : window.location.pathname}#dashboard`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Connexion impossible.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="ip-login-page">
      <section className="ip-login-panel" aria-labelledby="login-title">
        <div className="ip-login-brand">
          <span className="ip-brand-mark" aria-hidden="true">
            <Building2 size={19} strokeWidth={1.9} />
          </span>
          <div>
            <strong>ImmoPilot</strong>
            <span>Workspace agence</span>
          </div>
        </div>

        <div className="ip-login-heading">
          <h1 id="login-title">Connexion</h1>
          <p>Accédez à votre espace de prospection et de suivi commercial.</p>
        </div>

        <form className="ip-login-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Votre mot de passe"
              required
              type="password"
              value={password}
            />
          </label>

          {error && <p className="ip-login-error">{error}</p>}

          <button className="ip-login-submit" disabled={isSubmitting || isLoading} type="submit">
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </section>
    </main>
  );
}
