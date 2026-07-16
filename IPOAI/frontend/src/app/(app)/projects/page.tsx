"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Search, Grid3X3, List, Building2, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import type { ProjectStatus } from "@/types";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { listProjects, type ApiProject } from "@/lib/data/projects";
import { getCurrentUser } from "@/lib/supabase";

const ANON_USER_ID = "anon-dev-user";

export default function ProjectsPage() {
  const [userId, setUserId] = useState(ANON_USER_ID);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Resolve auth user
  useEffect(() => {
    getCurrentUser()
      .then((user) => { if (user?.id) setUserId(user.id); })
      .catch(() => {});
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects(userId);
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.company_name.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${projects.length} IPO project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />New Project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            className="pl-9 h-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(PROJECT_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-md p-0.5 ml-auto">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("grid")}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("table")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading projects…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Building2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">No projects yet.</p>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />Create your first project
            </Link>
          </Button>
        </div>
      )}

      {/* Grid View */}
      {!loading && projects.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const s = PROJECT_STATUS_CONFIG[p.status as ProjectStatus] ?? {
              label: p.status,
              bg: "bg-muted",
              color: "text-muted-foreground",
            };
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full hover:shadow-md hover:border-border/80 transition-all cursor-pointer group">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", s.bg, s.color)}>
                        {s.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-0.5 group-hover:text-primary transition-colors">
                      {p.company_name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      {p.exchange} · {p.industry}
                    </p>
                    <div className="flex items-center gap-2 mb-1">
                      <Progress value={p.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-8 text-right font-medium">
                        {p.progress}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      {p.documents_uploaded}/{p.documents_required} documents · Score {p.validation_score}%
                    </p>
                    <Separator className="mb-3" />
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex -space-x-1.5">
                        {(p.team_members ?? []).slice(0, 3).map((m) => (
                          <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {(p.team_members?.length ?? 0) > 3 && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] text-muted-foreground">
                            +{p.team_members.length - 3}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {p.target_filing_date ? formatDate(p.target_filing_date) : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
              No projects match your filters.
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {!loading && projects.length > 0 && view === "table" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Filing Date</TableHead>
                <TableHead>Team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const s = PROJECT_STATUS_CONFIG[p.status as ProjectStatus] ?? {
                  label: p.status,
                  bg: "bg-muted",
                  color: "text-muted-foreground",
                };
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => (window.location.href = `/projects/${p.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.company_name}</p>
                        <p className="text-xs text-muted-foreground">{p.industry}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{p.exchange}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", s.bg, s.color)}>
                        {s.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 w-28">
                        <Progress value={p.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{p.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {p.documents_uploaded}/{p.documents_required}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          p.validation_score >= 80
                            ? "text-emerald-600"
                            : p.validation_score >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                        )}
                      >
                        {p.validation_score}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {p.target_filing_date ? formatDate(p.target_filing_date) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-1.5">
                        {(p.team_members ?? []).slice(0, 3).map((m) => (
                          <Avatar key={m.id} className="h-5 w-5 border-2 border-background">
                            <AvatarFallback className="text-[8px]">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                    No projects match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
