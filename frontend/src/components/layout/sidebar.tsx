"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Upload, Files, Sparkles, FileText,
  Database, ShieldCheck, MessageSquare, FileEdit, Search,
  Users, Settings, ChevronLeft, ChevronRight,
  Building2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { NAV_ITEMS } from "@/constants";
import { usePermissions } from "@/hooks/use-permissions";
import type { NavItem } from "@/constants";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, FolderKanban, Upload, Files, Sparkles, FileText,
  Database, ShieldCheck, MessageSquare, FileEdit, Search,
  Users, Settings,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { can } = usePermissions();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true, Documents: true, Analysis: true,
    Draft: true, Review: true, System: true,
  });

  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));

  const isVisible = (item: NavItem) =>
    !item.permission || can(item.permission);

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          "relative flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0",
          "transition-[width] duration-200 ease-in-out overflow-hidden",
          collapsed ? "w-14" : "w-[220px]"
        )}
      >
        {/* ── Logo / Header ─────────────────────────────────────────────── */}
        <div className="flex items-center h-14 border-b border-sidebar-border shrink-0 px-3">
          {collapsed ? (
            /* Collapsed: just a centered expand chevron button */
            <button
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors mx-auto"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            /* Expanded: logo + wordmark + collapse button */
            <>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shrink-0">
                <Building2 className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="flex flex-col flex-1 min-w-0 ml-2.5">
                <span className="text-[13px] font-semibold text-sidebar-foreground leading-tight whitespace-nowrap">
                  AUTODOC
                </span>
                <span className="text-[10px] text-sidebar-foreground/40 whitespace-nowrap leading-tight">
                  AI Document Platform
                </span>
              </div>
              <button
                onClick={onToggle}
                aria-label="Collapse sidebar"
                className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <ScrollArea className="flex-1">
          <nav className={cn("py-2", collapsed ? "px-1.5" : "px-2")}>
            {NAV_ITEMS.map((group, gi) => {
              const visibleItems = group.items.filter(isVisible);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title} className={cn(gi > 0 && "mt-1")}>
                  {/* Group label — only in expanded mode */}
                  {!collapsed && (
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="flex items-center justify-between w-full px-2 py-1 mb-0.5 group/label"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 group-hover/label:text-sidebar-foreground/60 transition-colors">
                        {group.title}
                      </span>
                      <ChevronDown className={cn(
                        "h-3 w-3 text-sidebar-foreground/25 transition-transform duration-150",
                        !openGroups[group.title] && "-rotate-90"
                      )} />
                    </button>
                  )}

                  {/* Subtle divider between groups in collapsed mode */}
                  {collapsed && gi > 0 && (
                    <div className="my-1.5 mx-2 border-t border-sidebar-border/50" />
                  )}

                  {/* Items */}
                  <div className={cn(
                    "space-y-0.5 overflow-hidden transition-all duration-150",
                    !collapsed && !openGroups[group.title] && "h-0 opacity-0"
                  )}>
                    {visibleItems.map((item) => {
                      const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/documents" && pathname.startsWith(item.href + "/"));

                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              prefetch={true}
                              className={cn(
                                "flex items-center rounded-md text-sm transition-colors duration-100 group/item",
                                // Layout: centered in collapsed, left-aligned expanded
                                collapsed
                                  ? "justify-center h-8 w-10 mx-auto"
                                  : "gap-2.5 px-2.5 py-1.5 w-full",
                                isActive
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              )}
                            >
                              <Icon className={cn(
                                "shrink-0 transition-colors",
                                collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
                                isActive
                                  ? "text-sidebar-primary-foreground"
                                  : "text-sidebar-foreground/50 group-hover/item:text-sidebar-accent-foreground"
                              )} />

                              {/* Label — hidden when collapsed */}
                              {!collapsed && (
                                <span className="text-[13px] font-medium whitespace-nowrap truncate">
                                  {item.label}
                                </span>
                              )}
                            </Link>
                          </TooltipTrigger>

                          {/* Tooltip only in collapsed mode */}
                          {collapsed && (
                            <TooltipContent side="right" className="text-xs">
                              {item.label}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

      </aside>
    </TooltipProvider>
  );
}
