import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Tables } from './database.types';
import { appQueryClient } from './queryClient';
import { createPropertyIdsKey, queryKeys } from './queryKeys';
import { propertyMarksService } from './services/propertyMarksService';
import { getDashboardSnapshot } from './services/dashboardService';
import { listingScoresService } from './services/listingScoresService';
import { listingSignalsService } from './services/listingSignalsService';
import { fetchSupabasePropertiesPage, type SupabasePropertyListFilters } from './supabaseProperties';
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

const DEFAULT_BIENS_PAGE = 1;
const DEFAULT_BIENS_PAGE_SIZE = 16;
const DEFAULT_DASHBOARD_LIMIT = 8;
const EMPTY_PROPERTY_MARKS = { favorites: [], ignored: [] };

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

async function prefetchInitialAppData(userId: string): Promise<void> {
  const dashboardPrefetch = appQueryClient.prefetchQuery({
    queryKey: queryKeys.dashboardSnapshot(userId, DEFAULT_DASHBOARD_LIMIT),
    queryFn: () => getDashboardSnapshot(DEFAULT_DASHBOARD_LIMIT),
    staleTime: 5 * 60 * 1000,
  });

  const propertyMarks = await appQueryClient.fetchQuery({
    queryKey: queryKeys.propertyMarks(userId),
    queryFn: () => propertyMarksService.getMarks(userId),
    staleTime: 5 * 60 * 1000,
  }).catch(() => EMPTY_PROPERTY_MARKS);

  const defaultBiensFilters: SupabasePropertyListFilters = {
    ignoredPropertyIds: propertyMarks.ignored,
  };

  const firstBiensPage = await appQueryClient.fetchQuery({
    queryKey: queryKeys.supabasePropertiesPage(
      userId,
      'particulier',
      DEFAULT_BIENS_PAGE,
      DEFAULT_BIENS_PAGE_SIZE,
      'recent',
      defaultBiensFilters,
    ),
    queryFn: () => fetchSupabasePropertiesPage({
      filters: defaultBiensFilters,
      page: DEFAULT_BIENS_PAGE,
      pageSize: DEFAULT_BIENS_PAGE_SIZE,
      segment: 'particulier',
      sort: 'recent',
    }),
    staleTime: 5 * 60 * 1000,
  });

  const propertyIds = createPropertyIdsKey(
    firstBiensPage.properties
      .map((property) => property.supabasePropertyId)
      .filter((propertyId): propertyId is string => Boolean(propertyId)),
  );

  await Promise.all([
    dashboardPrefetch,
    propertyIds.length > 0
      ? appQueryClient.prefetchQuery({
        queryKey: queryKeys.listingScores(userId, propertyIds),
        queryFn: () => listingScoresService.listByPropertyIds(propertyIds),
        staleTime: 5 * 60 * 1000,
      })
      : Promise.resolve(),
    propertyIds.length > 0
      ? appQueryClient.prefetchQuery({
        queryKey: queryKeys.listingSignals(userId, propertyIds),
        queryFn: () => listingSignalsService.listByPropertyIds(propertyIds),
        staleTime: 5 * 60 * 1000,
      })
      : Promise.resolve(),
  ]);
}

async function prefetchInitialAppDataWithTimeout(userId: string): Promise<void> {
  await Promise.race([
    prefetchInitialAppData(userId).catch(() => undefined),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 2500);
    }),
  ]);
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [agency, setAgency] = useState<AuthAgency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const hasInitializedSessionRef = useRef(false);

  const applySession = useCallback(async (session: Session | null, options?: { prefetch?: boolean }) => {
    setUser(session?.user ?? null);
    currentUserIdRef.current = session?.user?.id ?? null;
    hasInitializedSessionRef.current = true;

    if (!session?.user) {
      setProfile(null);
      setAgency(null);
      setIsLoading(false);
      return;
    }

    const next = await loadProfileAndAgency(session.user.id);
    setProfile(next.profile);
    setAgency(next.agency);
    if (options?.prefetch ?? false) {
      await prefetchInitialAppDataWithTimeout(session.user.id);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeSession() {
      if (!supabase) {
        if (active) {
          hasInitializedSessionRef.current = true;
          setIsLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        currentUserIdRef.current = null;
        hasInitializedSessionRef.current = true;
        setUser(null);
        setProfile(null);
        setAgency(null);
        setIsLoading(false);
        return;
      }

      await applySession(data.session, { prefetch: true });
    }

    void initializeSession();

    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      const previousUserId = currentUserIdRef.current;
      const nextUserId = session?.user?.id ?? null;
      const sameUserSession = Boolean(previousUserId && nextUserId && previousUserId === nextUserId);
      const shouldShowLoader = !hasInitializedSessionRef.current
        || event === 'SIGNED_OUT'
        || (event === 'SIGNED_IN' && !sameUserSession);

      if (event === 'INITIAL_SESSION') return;
      if (shouldShowLoader) {
        setIsLoading(true);
      }

      void applySession(session, { prefetch: event === 'SIGNED_IN' && !sameUserSession }).catch(() => {
        currentUserIdRef.current = nextUserId;
        hasInitializedSessionRef.current = true;
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
    if (!supabase) throw new Error("Supabase n'est pas configure.");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase n'est pas configure.");

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


