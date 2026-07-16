"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Bell, Search, Sun, Moon, ChevronDown, LogOut, User, Settings, Building2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { getCurrentUser } from "@/lib/supabase";

export function TopNav() {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        setUser({
          name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "User",
          email: u.email ?? "",
        });
      }
    }).catch(() => {});
  }, []);

  const displayName = user?.name ?? "User";
  const displayEmail = user?.email ?? "";

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

      <div className="flex items-center gap-1 ml-auto">
        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-8 w-8">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Help */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>

        {/* Notifications */}
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground font-normal">{displayEmail}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings"><User className="h-4 w-4" />Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings className="h-4 w-4" />Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
