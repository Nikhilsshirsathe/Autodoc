/**
 * usePermissions
 *
 * Convenience hook that surfaces the most useful role/permission helpers
 * from AuthContext without needing to import useAuth everywhere.
 *
 * Usage:
 *   const { can, isAtLeast, hasRole, role, permissions } = usePermissions();
 *   if (can("documents:upload")) { ... }
 *   if (isAtLeast("analyst")) { ... }
 */
import { useAuth } from "@/context/auth-context";
import type { Permission, AppRole } from "@/context/auth-context";

export function usePermissions() {
  const { can, isAtLeast, hasRole, role, permissions, isAuthenticated, isLoading } = useAuth();
  return { can, isAtLeast, hasRole, role, permissions, isAuthenticated, isLoading };
}

export type { Permission, AppRole };
