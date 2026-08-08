"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard:        "Dashboard",
  projects:         "Projects",
  documents:        "Documents",
  upload:           "Upload",
  classification:   "AI Classification",
  viewer:           "Document Viewer",
  "knowledge-base": "Knowledge Base",
  validation:       "Validation Center",
  "ai-qa":          "AI Q&A",
  draft:            "Draft Generator",
  evidence:         "Evidence Viewer",
  collaboration:    "Collaboration",
  settings:         "Settings",
  profile:          "Profile",
  organization:     "Organization",
  security:         "Security",
  billing:          "Billing",
  notifications:    "Notifications",
  create:           "Create New",
  new:              "New Project",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = BREADCRUMB_MAP[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { href, label };
  });

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground py-3 px-6 border-b border-border bg-background/50">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground capitalize">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors capitalize">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
