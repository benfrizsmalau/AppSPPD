import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '../types';

const INACTIVITY_WARN_MS = 25 * 60 * 1000; // 25 min
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000; // 30 min

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  showSessionWarning: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  tenantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimers = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    setShowSessionWarning(false);

    warnTimerRef.current = setTimeout(() => {
      setShowSessionWarning(true);
    }, INACTIVITY_WARN_MS);

    logoutTimerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
    }, INACTIVITY_LOGOUT_MS);
  }, []);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimers();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimers();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [user, resetInactivityTimers]);

  const fetchProfile = async (userId: string, attempt = 1) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, tenant:tenants(*)')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // Retry once after 1.5s — trigger may not have fired yet (race condition)
        if (attempt < 3) {
          await new Promise(res => setTimeout(res, 1500));
          return fetchProfile(userId, attempt + 1);
        }
        throw error ?? new Error('Profile not found after retries');
      }

      setProfile(data as UserProfile);

      // Update last_active (fire-and-forget)
      supabase
        .from('user_profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {});
    } catch (err) {
      console.error('Error fetching profile (attempt', attempt, '):', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        
        if (event === 'SIGNED_IN') {
          // Log login event
          supabase.from('login_events').insert({
            user_id: session.user.id,
            tenant_id: (session.user.user_metadata as any)?.tenant_id,
            user_agent: navigator.userAgent,
          }).then(() => {});
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setShowSessionWarning(false);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const tenantId = profile?.tenant_id ?? null;

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, showSessionWarning,
      signIn, signOut, refreshProfile, hasRole, tenantId,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
