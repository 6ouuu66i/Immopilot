import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { LoadingBar } from './ui/LoadingBar';

interface ProtectedRouteProps {
  children: ReactNode;
}

function AuthLoader() {
  return (
    <div className="ip-auth-loader">
      <LoadingBar />
    </div>
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.hash = '#login';
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && profile && !profile.is_active) {
      void signOut().finally(() => {
        window.location.hash = '#login';
      });
    }
  }, [isLoading, profile, signOut]);

  if (isLoading) return <AuthLoader />;
  if (!isAuthenticated) return <AuthLoader />;
  if (!profile) return <AuthLoader />;
  if (!profile.is_active) return <AuthLoader />;

  return <>{children}</>;
}
