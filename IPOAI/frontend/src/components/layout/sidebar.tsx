"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Upload, Files, Sparkles, FileText,
  Database, ShieldCheck, MessageSquare, FileEdit, Search, UserCheck,
  Users, ClipboardList, Settings, ChevronLeft, ChevronRight,
  Building2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS } from "@/constants";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, FolderKanban, Upload, Files, Sparkles, FileText,
  Database, ShieldCheck, MessageSquare, FileEdit, Search, UserCheck,
  Users, ClipboardList, Settings,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true, Documents: true, Analysis: true, Draft: true, Review: true, System: true,
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shrink-0">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className={cn("overflow-hidden transition-all duration-200", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
              <span className="font-semibold text-sm text-sidebar-foreground whitespace-nowrap">IPOAI</span>
              <p className="text-[10px] text-sidebar-foreground/50 whitespace-nowrap leading-none mt-0.5">IPO Document Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="px-2 space-y-0.5">
            {NAV_ITEMS.map((group) => (
              <div key={group.title} className="mb-2">
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="flex items-center justify-between w-full px-2 py-1 mb-1"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                      {group.title}
                    </span>
                    <ChevronDown
                      className={cn("h-3 w-3 text-sidebar-foreground/30 transition-transform duration-150", !openGroups[group.title] && "-rotate-90")}
                    />
                  </button>
                )}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-150 space-y-0.5",
                    collapsed || openGroups[group.title] ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  {group.items.map((item) => {
                    const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            prefetch={true}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors group",
                              isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <Icon className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
                            )} />
                            <span className={cn(
                              "overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-200",
                              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                            )}>
                              {item.label}
                            </span>
                          </Link>
                        </TooltipTrigger>
                        {collapsed && (
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-background shadow-sm hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
