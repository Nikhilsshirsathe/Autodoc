"use client";
import React, {
  createContext, useContext, useEffect, useRef,
  useState, useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ── Role types ──────────────────────────────────────────────────────────────

export type AppRole =
  | "admin"
  | "owner"
  | "analyst"
  | "merchant_banker"
  | "legal"
  | "viewer";

/**
 * Every feature-permission key used in the app.
 * Components check these to show/hide UI and guard routes.
 */
export type Permission =
  | "projects:read"
  | "projects:write"
  | "projects:delete"
  | "documents:upload"
  | "documents:read"
  | "documents:delete"
  | "validation:run"
  | "draft:generate"
  | "draft:edit"
  | "banker_review:read"
  | "banker_review:approve"
  | "knowledge_base:manage"
  | "audit_logs:read"
  | "collaboration:manage"
  | "settings:manage"
  | "admin:users";

// ── Permission map per role ─────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    "projects:read", "projects:write", "projects:delete",
    "documents:upload", "documents:read", "documents:delete",
    "validation:run", "draft:generate", "draft:edit",
    "banker_review:read", "banker_review:approve",
    "knowledge_base:manage",
    "audit_logs:read",
    "collaboration:manage",
    "settings:manage",
    "admin:users",
  ],
  owner: [
    "projects:read", "projects:write", "projects:delete",
    "documents:upload", "documents:read",
    "validation:run", "draft:generate", "draft:edit",
    "banker_review:read",
    "knowledge_base:manage",
    "audit_logs:read",
    "collaboration:manage",
    "settings:manage",
  ],
  analyst: [
    "projects:read", "projects:write",
    "documents:upload", "documents:read",
    "validation:run", "draft:generate", "draft:edit",
    "banker_review:read",
    "knowledge_base:manage",
    "audit_logs:read",
    "collaboration:manage",
  ],
  merchant_banker: [
    "projects:read",
    "documents:read",
    "validation:run",
    "draft:generate", "draft:edit",
    "banker_review:read", "banker_review:approve",
    "audit_logs:read",
    "collaboration:manage",
  ],
  legal: [
    "projects:read",
    "documents:read",
    "validation:run",
    "draft:generate", "draft:edit",
    "banker_review:read",
    "audit_logs:read",
    "collaboration:manage",
  ],
  viewer: [
    "projects:read",
    "documents:read",
    "draft:generate",
    "banker_review:read",
    "audit_logs:read",
  ],
};

// ── Role hierarchy (higher index = more privilege) ──────────────────────────
const ROLE_HIERARCHY: AppRole[] = [
  "viewer", "legal", "merchant_banker", "analyst", "owner", "admin",
];

export function getRoleLevel(role: AppRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function hasMinimumRole(userRole: AppRole, minRole: AppRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minRole);
}

// ── Session timeout constants ───────────────────────────────────────────────
const IDLE_WARN_AFTER    = 25 * 60 * 1000;  // 25 min — show warning banner
const IDLE_TIMEOUT       = 30 * 60 * 1000;  // 30 min — force sign-out
const HEARTBEAT_DEBOUNCE = 30_000;           // 30 s  — debounce activity events

// ── Domain types ───────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  /** Free-text professional title entered at signup (e.g. "Chartered Accountant") */
  role_text?: string;
  avatar_url?: string;
  last_seen_at?: string;
  created_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when idle warning is active — layout can show a countdown banner */
  isIdleWarning: boolean;
}

interface AuthContextValue extends AuthState {
  // Auth actions
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Role helpers
  /** Check a single permission for the current user */
  can: (permission: Permission) => boolean;
  /** True if current role is at least `minRole` in the hierarchy */
  isAtLeast: (minRole: AppRole) => boolean;
  /** True if current role matches any of the provided roles */
  hasRole: (...roles: AppRole[]) => boolean;
  /** Full permission list for the current role */
  permissions: Permission[];
  /** Resolved role (defaults to 'viewer') */
  role: AppRole;

  // Session management
  recordActivity: () => void;
}

export interface SignUpParams {
  email: string;
  password: string;
  full_name: string;
  /** Free-text professional role entered by the user (e.g. "Chartered Accountant") */
  role_text?: string;
  /** Internal app role — assigned by admin, defaults to "owner" */
  role?: AppRole;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [isIdleWarning, setIsIdleWarning] = useState(false);

  // Refs so idle callbacks never reference stale closures
  const lastActivityRef  = useRef(Date.now());
  const warnTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Profile ────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) setProfile(data as UserProfile);
    } catch {
      // Profile may not exist yet — ignore
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Idle timeout ───────────────────────────────────────────────────────

  const clearIdleTimers = useCallback(() => {
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  const forceSignOut = useCallback(async () => {
    clearIdleTimers();
    await supabase.auth.signOut();
    setProfile(null);
    setIsIdleWarning(false);
  }, [clearIdleTimers]);

  const resetIdleTimers = useCallback(() => {
    clearIdleTimers();
    setIsIdleWarning(false);
    lastActivityRef.current = Date.now();

    warnTimerRef.current = setTimeout(() => {
      setIsIdleWarning(true);
    }, IDLE_WARN_AFTER);

    logoutTimerRef.current = setTimeout(() => {
      forceSignOut();
    }, IDLE_TIMEOUT);
  }, [clearIdleTimers, forceSignOut]);

  /** Debounced activity recorder — call from any interaction */
  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < HEARTBEAT_DEBOUNCE) return;
    resetIdleTimers();
  }, [resetIdleTimers]);

  // ── Bootstrap session ──────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id);
        resetIdleTimers();
      }
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
        resetIdleTimers();
      } else {
        setProfile(null);
        clearIdleTimers();
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      clearIdleTimers();
    };
  }, [fetchProfile, resetIdleTimers, clearIdleTimers]);

  // ── Global activity listeners ─────────────────────────────────────────

  useEffect(() => {
    const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    const handler = () => recordActivity();
    EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, handler));
  }, [recordActivity]);

  // ── Auth actions ──────────────────────────────────────────────────────

  const signIn = async (email: string, password: string, _remember = true) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) resetIdleTimers();
    return { error: error?.message ?? null };
  };

  const signUp = async ({ email, password, full_name, role, role_text }: SignUpParams) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role: role ?? "owner",
          role_text: role_text ?? "",
        },
      },
    });
    if (error) return { error: error.message };

    // Upsert profile row (DB trigger also does this — belt-and-suspenders)
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email,
        full_name,
        role: role ?? "owner",
        role_text: role_text ?? null,
      });
    }
    return { error: null };
  };

  const signOut = async () => {
    clearIdleTimers();
    await supabase.auth.signOut();
    setProfile(null);
    setIsIdleWarning(false);
  };

  // ── Role helpers ───────────────────────────────────────────────────────

  const role: AppRole =
    profile?.role ??
    (user?.user_metadata?.role as AppRole | undefined) ??
    "viewer";

  const permissions: Permission[] = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  const isAtLeast = useCallback(
    (minRole: AppRole) => hasMinimumRole(role, minRole),
    [role],
  );

  const hasRole = useCallback(
    (...roles: AppRole[]) => roles.includes(role),
    [role],
  );

  // ── Provide ───────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        session, user, profile,
        isLoading, isAuthenticated: !!session, isIdleWarning,
        signIn, signUp, signOut, refreshProfile,
        can, isAtLeast, hasRole,
        permissions, role,
        recordActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
