"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Idle warning banner ────────────────────────────────────────────────────

function IdleWarningBanner({
  onStaySignedIn,
  onSignOut,
}: {
  onStaySignedIn: () => void;
  onSignOut: () => void;
}) {
  const [seconds, setSeconds] = useState(5 * 60); // 5-min countdown (30 - 25)

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-amber-50 dark:bg-amber-950 border-t border-amber-200 dark:border-amber-800 px-4 py-3 text-sm shadow-lg">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          You&apos;ll be signed out due to inactivity in{" "}
          <span className="font-mono font-semibold">
            {mm}:{ss}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
          onClick={onSignOut}
        >
          Sign Out
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white border-0"
          onClick={onStaySignedIn}
        >
          Stay Signed In
        </Button>
      </div>
    </div>
  );
}

// ── App Layout ─────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isIdleWarning, recordActivity, signOut } = useAuth();
  const router = useRouter();

  // Redirect to login when not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Full-screen loading spinner while bootstrapping auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  // Don't render shell while redirect is in-flight
  if (!isAuthenticated) return null;

  const handleStaySignedIn = () => {
    recordActivity();
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <>
      <AppShell>{children}</AppShell>

      {/* Idle warning overlay — shown 5 min before auto sign-out */}
      {isIdleWarning && (
        <IdleWarningBanner
          onStaySignedIn={handleStaySignedIn}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}
