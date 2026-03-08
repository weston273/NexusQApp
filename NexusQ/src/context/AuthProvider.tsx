import React from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getCurrentSession,
  signOutCurrentUser,
  subscribeToAuthChanges,
} from "@/lib/auth";
import {
  fetchCurrentUserAccessRows,
  fetchCurrentUserProfile,
  getStoredActiveClientId,
  pickPrimaryAccessRow,
  setStoredActiveClientId,
} from "@/lib/access";
import type { AccessRole, UserAccessRow, UserProfile } from "@/lib/access";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  accessRows: UserAccessRow[];
  clientId: string | null;
  role: AccessRole | null;
  loading: boolean;
  sessionReady: boolean;
  profileReady: boolean;
  accessReady: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  setActiveClientId: (clientId: string) => void;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function selectClientContext(rows: UserAccessRow[], preferredClientId?: string | null) {
  const selected = pickPrimaryAccessRow(rows, preferredClientId ?? getStoredActiveClientId());
  if (selected?.client_id) {
    setStoredActiveClientId(selected.client_id);
    return selected;
  }
  setStoredActiveClientId(null);
  return null;
}

async function loadUserProfileAndAccess(userId: string) {
  const [{ data: profile, error: profileError }, { data: accessRows, error: accessError }] = await Promise.all([
    fetchCurrentUserProfile(userId),
    fetchCurrentUserAccessRows(userId),
  ]);

  const message = profileError?.message ?? accessError?.message ?? null;

  return {
    profile: profile ?? null,
    accessRows: accessRows ?? [],
    errorMessage: message,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [accessRows, setAccessRows] = React.useState<UserAccessRow[]>([]);
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<AccessRole | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sessionReady, setSessionReady] = React.useState(false);
  const [profileReady, setProfileReady] = React.useState(false);
  const [accessReady, setAccessReady] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const requestTokenRef = React.useRef(0);

  const applySessionState = React.useCallback(
    async (incomingSession: Session | null) => {
      const requestToken = ++requestTokenRef.current;
      setLoading(true);
      setAuthError(null);
      setSessionReady(false);
      setProfileReady(false);
      setAccessReady(false);

      if (!incomingSession?.user) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setAccessRows([]);
        setClientId(null);
        setRole(null);
        setStoredActiveClientId(null);
        setSessionReady(true);
        setProfileReady(true);
        setAccessReady(true);
        setLoading(false);
        return;
      }

      const currentUser = incomingSession.user;
      setSession(incomingSession);
      setUser(currentUser);
      setSessionReady(true);

      const { profile: loadedProfile, accessRows: loadedAccessRows, errorMessage } = await loadUserProfileAndAccess(currentUser.id);
      if (requestToken !== requestTokenRef.current) {
        return;
      }

      const selected = selectClientContext(loadedAccessRows);
      setProfile(loadedProfile);
      setAccessRows(loadedAccessRows);
      setClientId(selected?.client_id ?? null);
      setRole(selected?.role ?? null);
      setProfileReady(true);
      setAccessReady(true);
      setAuthError(errorMessage);
      setLoading(false);
    },
    []
  );

  const refreshAccess = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setAuthError(null);
    setAccessReady(false);

    const { data, error } = await fetchCurrentUserAccessRows(user.id);
    const rows = data ?? [];
    const selected = selectClientContext(rows, clientId);

    setAccessRows(rows);
    setClientId(selected?.client_id ?? null);
    setRole(selected?.role ?? null);
    setAccessReady(true);
    setAuthError(error?.message ?? null);
    setLoading(false);
  }, [clientId, user?.id]);

  const signOut = React.useCallback(async () => {
    setLoading(true);
    const { error } = await signOutCurrentUser();
    if (error) {
      setAuthError(error.message);
      setLoading(false);
    }
  }, []);

  const setActiveClientId = React.useCallback(
    (nextClientId: string) => {
      const selected = pickPrimaryAccessRow(accessRows, nextClientId);
      if (!selected) return;
      setStoredActiveClientId(selected.client_id);
      setClientId(selected.client_id);
      setRole(selected.role);
    },
    [accessRows]
  );

  React.useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data, error } = await getCurrentSession();
      if (!mounted) return;
      if (error) {
        setAuthError(error.message);
      }
      await applySessionState(data.session);
    };

    void init();

    const { data } = subscribeToAuthChanges((_event, nextSession) => {
      void applySessionState(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [applySessionState]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      accessRows,
      clientId,
      role,
      loading,
      sessionReady,
      profileReady,
      accessReady,
      authError,
      signOut,
      refreshAccess,
      setActiveClientId,
    }),
    [
      accessRows,
      authError,
      clientId,
      loading,
      sessionReady,
      profileReady,
      accessReady,
      profile,
      refreshAccess,
      role,
      session,
      setActiveClientId,
      signOut,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
