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
import { persistCurrentUserPhone, readUserMetadataPhone } from "@/lib/profile-contact";
import { clearSensitiveLocalState } from "@/lib/persistence/sensitive";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  phone: string | null;
  phoneReady: boolean;
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
  const currentUserIdRef = React.useRef<string | null>(null);
  const currentClientIdRef = React.useRef<string | null>(null);

  const clearSensitiveStateForTransition = React.useCallback((nextUserId: string | null, nextClientId: string | null) => {
    const previousUserId = currentUserIdRef.current;
    const previousClientId = currentClientIdRef.current;
    const signedOut = Boolean(previousUserId) && !nextUserId;
    const userChanged = Boolean(previousUserId) && Boolean(nextUserId) && previousUserId !== nextUserId;
    const clientChanged = Boolean(previousClientId) && previousClientId !== nextClientId;

    if (signedOut || userChanged || clientChanged) {
      clearSensitiveLocalState();
    }
  }, []);

  const applySessionState = React.useCallback(
    async (incomingSession: Session | null) => {
      const requestToken = ++requestTokenRef.current;
      setLoading(true);
      setAuthError(null);
      setSessionReady(false);
      setProfileReady(false);
      setAccessReady(false);

      if (!incomingSession?.user) {
        clearSensitiveStateForTransition(null, null);
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

        clearSensitiveStateForTransition(null, null);
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

      let nextProfile = loadedProfile;
      let nextErrorMessage = errorMessage;
      const metadataPhone = readUserMetadataPhone(currentUser);

      if (metadataPhone && !loadedProfile?.phone) {
        try {
          const syncedProfile = await persistCurrentUserPhone(metadataPhone, currentUser);
          nextProfile = {
            id: syncedProfile.id,
            email: syncedProfile.email,
            full_name: syncedProfile.fullName,
            phone: syncedProfile.phone,
            whatsapp: loadedProfile?.whatsapp ?? null,
            created_at: syncedProfile.createdAt ?? loadedProfile?.created_at ?? new Date().toISOString(),
            updated_at: syncedProfile.updatedAt ?? loadedProfile?.updated_at ?? new Date().toISOString(),
          };
        } catch (profileSyncError) {
          nextErrorMessage =
            nextErrorMessage ??
            (profileSyncError instanceof Error ? profileSyncError.message : "Unable to sync your operator profile.");
        }
      }

      const { selected, recoveredFromClientId } = selectClientContext(loadedAccessRows);
      clearSensitiveStateForTransition(currentUser.id, selected?.client_id ?? null);
      setProfile(nextProfile);
      setAccessRows(loadedAccessRows);
      setClientId(selected?.client_id ?? null);
      setRole(selected?.role ?? null);
      if (recoveredFromClientId) {
        toast.info("Your previous workspace was unavailable, so NexusQ switched to another linked workspace.");
      }
      setProfileReady(true);
      setAccessReady(true);
      setAuthError(nextErrorMessage);
      setLoading(false);
    },
    [clearSensitiveStateForTransition]
  );

  const refreshAccess = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setAuthError(null);
    setAccessReady(false);

    const { data, error } = await fetchCurrentUserAccessRows(user.id);
    const rows = data ?? [];
    const { selected, recoveredFromClientId } = selectClientContext(rows, clientId);

    clearSensitiveStateForTransition(user.id, selected?.client_id ?? null);
    setAccessRows(rows);
    setClientId(selected?.client_id ?? null);
    setRole(selected?.role ?? null);
    if (recoveredFromClientId) {
      toast.info("Workspace access changed. NexusQ switched you to a currently linked workspace.");
    }
    setAccessReady(true);
    setAuthError(error?.message ?? null);
    setLoading(false);
  }, [clientId, clearSensitiveStateForTransition, user?.id]);

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
      clearSensitiveStateForTransition(user?.id ?? null, selected.client_id);
      setStoredActiveClientId(selected.client_id);
      setClientId(selected.client_id);
      setRole(selected.role);
    },
    [accessRows, clearSensitiveStateForTransition, user?.id]
  );

  React.useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  React.useEffect(() => {
    currentClientIdRef.current = clientId;
  }, [clientId]);

  const resolvedPhone = React.useMemo(() => {
    if (typeof profile?.phone === "string" && profile.phone.trim()) {
      return profile.phone.trim();
    }
    return readUserMetadataPhone(user);
  }, [profile?.phone, user]);

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
      phone: resolvedPhone,
      phoneReady: Boolean(resolvedPhone),
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
      resolvedPhone,
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
