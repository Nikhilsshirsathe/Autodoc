"use client";
/**
 * withRoleGuard  — Higher-Order Component for role/permission-based route gating.
 *
 * Wraps a page or component and renders a fallback (or redirects) when the
 * current user lacks the required role or permission.
 *
 * Examples
 * ─────────
 * // Protect a page: require "analyst" or above
 * export default withRoleGuard(MyPage, { minRole: "analyst" });
 *
 * // Protect a page: require a specific permission
 * export default withRoleGuard(MyPage, { permission: "banker_review:approve" });
 *
 * // Redirect instead of showing fallback
 * export default withRoleGuard(MyPage, { minRole: "owner", redirectTo: "/dashboard" });
 *
 *
 * RoleGuard  — Inline component for hiding/showing UI fragments.
 *
 * Examples
 * ─────────
 * <RoleGuard permission="documents:upload">
 *   <UploadButton />
 * </RoleGuard>
 *
 * <RoleGuard minRole="merchant_banker" fallback={<p>Access denied</p>}>
 *   <ApproveButton />
 * </RoleGuard>
 */

import React, { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { Permission, AppRole } from "@/context/auth-context";

// ── Shared option types ─────────────────────────────────────────────────────

interface GuardOptions {
  /** Minimum role required (inclusive, uses role hierarchy) */
  minRole?: AppRole;
  /** Specific permission required */
  permission?: Permission;
  /** One or more exact roles required */
  roles?: AppRole[];
  /** Redirect path instead of rendering a fallback */
  redirectTo?: string;
  /** Custom fallback element (defaults to AccessDenied) */
  fallback?: React.ReactNode;
}

// ── Default access-denied UI ────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          You don&apos;t have the required permissions to view this page.
          Contact your administrator if you believe this is a mistake.
        </p>
      </div>
    </div>
  );
}

// ── Core guard logic ────────────────────────────────────────────────────────

function useGuardCheck({ minRole, permission, roles }: GuardOptions): boolean | "loading" {
  const { isLoading, isAuthenticated, can, isAtLeast, hasRole } = usePermissions();

  if (isLoading) return "loading";
  if (!isAuthenticated) return false;
  if (permission && !can(permission)) return false;
  if (minRole   && !isAtLeast(minRole)) return false;
  if (roles     && !hasRole(...roles))  return false;
  return true;
}

// ── withRoleGuard HOC ───────────────────────────────────────────────────────

export function withRoleGuard<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: GuardOptions = {},
): ComponentType<P> {
  const { redirectTo, fallback } = options;

  function GuardedComponent(props: P) {
    const router   = useRouter();
    const allowed  = useGuardCheck(options);

    if (allowed === "loading") {
      return (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!allowed) {
      if (redirectTo) {
        router.replace(redirectTo);
        return null;
      }
      return <>{fallback ?? <AccessDenied />}</>;
    }

    return <WrappedComponent {...props} />;
  }

  GuardedComponent.displayName = `withRoleGuard(${WrappedComponent.displayName ?? WrappedComponent.name})`;
  return GuardedComponent;
}

// ── RoleGuard inline component ──────────────────────────────────────────────

interface RoleGuardProps extends GuardOptions {
  children: React.ReactNode;
  /** Show this while auth state is loading (default: nothing) */
  loadingFallback?: React.ReactNode;
}

export function RoleGuard({
  children,
  fallback,
  loadingFallback,
  ...options
}: RoleGuardProps) {
  const allowed = useGuardCheck(options);

  if (allowed === "loading") return <>{loadingFallback ?? null}</>;
  if (!allowed)              return <>{fallback ?? null}</>;
  return <>{children}</>;
}
