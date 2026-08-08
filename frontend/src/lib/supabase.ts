/**
 * Supabase browser client for frontend use.
 *
 * Usage:
 *   import { supabase } from "@/lib/supabase";
 *   const { data, error } = await supabase.from("documents").select("*");
 *
 * For auth:
 *   const { data } = await supabase.auth.getUser();
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

// Singleton browser client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Returns the current session, or null if not logged in. */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Returns the current user, or null if not logged in. */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Signs in with email + password. */
export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Creates a new account. */
export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

/** Signs out. */
export async function signOut() {
  return supabase.auth.signOut();
}

/** Sends a password reset email. */
export async function resetPasswordForEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

/** Updates password (call after reset link click). */
export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}
