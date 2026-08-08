"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell, Search, Sun, Moon, ChevronDown,
  LogOut, User, Settings, HelpCircle, Shield, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useProject } from "@/context/project-context";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin:          "Admin",
  owner:          "Promoter",
  analyst:        "Analyst",
  merchant_banker:"Merchant Banker",
  legal:          "Legal",
  viewer:         "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  admin:          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  owner:          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  analyst:        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  merchant_banker:"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  legal:          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  viewer:         "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export function TopNav() {
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const { projects, selectedProject, setSelectedProjectId } = useProject();
  const router = useRouter();

  const displayName =
    profile?.full_name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "User";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const role = profile?.role ?? (user?.user_metadata?.role as string) ?? "owner";
  // Show the user's own free-text title if they entered one, else fall back to system role label
  const roleDisplay =
    profile?.role_text?.trim() ||
    (user?.user_metadata?.role_text as string | undefined)?.trim() ||
    ROLE_LABELS[role] ||
    role;

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects, documents..."
            className="pl-9 h-8 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-input text-sm"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 max-w-[200px] text-xs">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedProject?.company_name ?? "Select Project"}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Switch Project
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className="text-sm gap-2"
              >
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{p.company_name}</span>
                {p.id === selectedProject?.id && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {/* Theme Toggle */}
        <Button
          variant="ghost" size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-xs font-medium leading-tight">{displayName}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{displayEmail}</span>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground font-normal">{displayEmail}</span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full w-fit ${ROLE_COLORS[role] ?? ROLE_COLORS.viewer}`}>
                  <Shield className="h-2.5 w-2.5" />
                  {roleDisplay}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="h-4 w-4" />Profile &amp; Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
