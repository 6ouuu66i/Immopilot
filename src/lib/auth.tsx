import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Tables } from './database.types';
import { supabase } from './supabase';

export type AuthProfile = Tables<'profiles'>;
export type AuthAgency = Tables<'agencies'>;

interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  agency: AuthAgency | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

async function loadProfileAndAgency(userId: string): Promise<{ profile: AuthProfile | null; agency: AuthAgency | null }> {
  if (!supabase) return { profile: null, agency: null };

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const profile = profileData as AuthProfile | null;
  if (!profile?.agency_id) return { profile: profile ?? null, agency: null };

  const { data: agencyData, error: agencyError } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', profile.agency_id)
    .maybeSingle();

  if (agencyError) throw new Error(agencyError.message);
  const agency = agencyData as AuthAgency | null;

  return { profile, agency: agency ?? null };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [agency, setAgency] = useState<AuthAgency | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (session: Session | null) => {
    setUser(session?.user ?? null);

    if (!session?.user) {
      setProfile(null);
      setAgency(null);
      setIsLoading(false);
      return;
    }

    const next = await loadProfileAndAgency(session.user.id);
    setProfile(next.profile);
    setAgency(next.agency);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeSession() {
      if (!supabase) {
        if (active) setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setUser(null);
        setProfile(null);
        setAgency(null);
        setIsLoading(false);
        return;
      }

      await applySession(data.session);
    }

    void initializeSession();

    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsLoading(true);
      void applySession(session).catch(() => {
        setUser(session?.user ?? null);
        setProfile(null);
        setAgency(null);
        setIsLoading(false);
      });
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase n'est pas configuré.");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase n'est pas configuré.");

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const next = await loadProfileAndAgency(user.id);
    setProfile(next.profile);
    setAgency(next.agency);
    window.dispatchEvent(new CustomEvent('ip-agent-changed'));
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      agency,
      isLoading,
      isAuthenticated: Boolean(user),
      signIn,
      signOut,
      signUp,
      refreshProfile,
    }),
    [agency, isLoading, profile, refreshProfile, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
