import React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  ensureLiveSession,
  getCurrentSession,
  isInvalidSessionStateError,
  signOutCurrentUser,
  subscribeToAuthChanges,
} from "@/lib/auth";
import { subscribeToAuthStateCleared } from "@/lib/auth-events";
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
  const requestedClientId = preferredClientId ?? getStoredActiveClientId();
  const selected = pickPrimaryAccessRow(rows, requestedClientId);
  const recoveredFromClientId =
    requestedClientId && selected?.client_id && selected.client_id !== requestedClientId ? requestedClientId : null;

  if (selected?.client_id) {
    setStoredActiveClientId(selected.client_id);
    return { selected, recoveredFromClientId };
  }
  setStoredActiveClientId(null);
  return { selected: null, recoveredFromClientId };
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

      let liveSession: Session;
      try {
        liveSession = await ensureLiveSession(incomingSession, { clearInvalidSession: true });
      } catch (sessionError) {
        if (requestToken !== requestTokenRef.current) {
          return;
        }

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
        setAuthError(
          isInvalidSessionStateError(sessionError)
            ? sessionError.message
            : sessionError instanceof Error
              ? sessionError.message
              : "Unable to restore your session."
        );
        setLoading(false);
        return;
      }

      const currentUser = liveSession.user;
      setSession(liveSession);
      setUser(currentUser);
      setSessionReady(true);

      const { profile: loadedProfile, accessRows: loadedAccessRows, errorMessage } = await loadUserProfileAndAccess(currentUser.id);
      if (requestToken !== requestTokenRef.current) {
        return;
      }

      const { selected, recoveredFromClientId } = selectClientContext(loadedAccessRows);
      setProfile(loadedProfile);
      setAccessRows(loadedAccessRows);
      setClientId(selected?.client_id ?? null);
      setRole(selected?.role ?? null);
      if (recoveredFromClientId) {
        toast.info("Your previous workspace was unavailable, so NexusQ switched to another linked workspace.");
      }
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
    const { selected, recoveredFromClientId } = selectClientContext(rows, clientId);

    setAccessRows(rows);
    setClientId(selected?.client_id ?? null);
    setRole(selected?.role ?? null);
    if (recoveredFromClientId) {
      toast.info("Workspace access changed. NexusQ switched you to a currently linked workspace.");
    }
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
      throw error;
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
      await applySessionState(data.session);
      if (!mounted) return;
      if (error) {
        setAuthError(error.message);
      }
    };

    void init();

    const { data } = subscribeToAuthChanges((_event, nextSession) => {
      void applySessionState(nextSession);
    });

    const unsubscribeAuthStateCleared = subscribeToAuthStateCleared(() => {
      void applySessionState(null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      unsubscribeAuthStateCleared();
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
