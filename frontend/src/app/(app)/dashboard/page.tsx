"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FolderKanban, FileUp, ShieldCheck, FileEdit,
  MessageSquare, Plus, ArrowUpRight, ArrowRight, Loader2, Building2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import type { ProjectStatus } from "@/types";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { listProjects, type ApiProject } from "@/lib/data/projects";
import { listDocuments, type ApiDocument } from "@/lib/data/documents";
import { useAuth } from "@/context/auth-context";

const QUICK_ACTIONS = [
  { label: "Upload Documents",    href: "/documents/upload", icon: FileUp },
  { label: "Run Validation",       href: "/validation",       icon: ShieldCheck },
  { label: "Generate Draft",       href: "/draft",            icon: FileEdit },
  { label: "Answer AI Questions",  href: "/ai-qa",            icon: MessageSquare },
];

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    try {
      const [projs, docs] = await Promise.allSettled([
        listProjects(userId),
        listDocuments(userId),
      ]);
      if (projs.status === "fulfilled") setProjects(projs.value);
      if (docs.status === "fulfilled") setDocuments(docs.value);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (!authLoading && userId) fetchAll(); }, [fetchAll, authLoading, userId]);

  // Derived stats
  const activeProject = projects[0] ?? null;
  const cfg = activeProject ? (PROJECT_STATUS_CONFIG[activeProject.status as ProjectStatus] ?? null) : null;

  const docStatusCounts = {
    completed: documents.filter((d) => d.status === "completed").length,
    processing: documents.filter((d) => d.status === "processing").length,
    uploaded: documents.filter((d) => d.status === "uploaded").length,
    failed: documents.filter((d) => d.status === "failed").length,
  };

  const docStatusData = [
    { name: "Processed",  value: docStatusCounts.completed,  color: "#10b981" },
    { name: "Processing", value: docStatusCounts.processing, color: "#6366f1" },
    { name: "Queued",     value: docStatusCounts.uploaded,   color: "#f59e0b" },
    { name: "Failed",     value: docStatusCounts.failed,     color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const validationScore = activeProject?.validation_score ?? 0;
  const readinessData = [{ name: "Readiness", value: validationScore, fill: "#0f172a" }];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProject
              ? <>Active project: <span className="font-medium text-foreground">{activeProject.company_name}</span></>
              : "No active projects yet"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/projects/new"><Plus className="h-4 w-4" />New Project</Link>
        </Button>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">No projects yet. Create your first IPO project to get started.</p>
            <Button asChild size="sm">
              <Link href="/projects/new"><Plus className="h-4 w-4" />Create Project</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeProject && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
            {[
              {
                label: "Total Projects",
                value: projects.length,
                icon: FolderKanban,
                sub: `${projects.filter((p) => p.status !== "completed").length} active`,
                trend: "Live data",
              },
              {
                label: "Documents Uploaded",
                value: documents.length,
                icon: FileUp,
                sub: `of ${activeProject.documents_required} required`,
                trend: "Live data",
              },
            ].map((s) => (
              <Card key={s.label} className="relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <s.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                      {s.trend}
                    </span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Validation Score Trend — static placeholder until we store historical scores */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Project Progress</CardTitle>
                <CardDescription className="text-xs">
                  {activeProject.company_name} — {activeProject.documents_uploaded} of{" "}
                  {activeProject.documents_required} documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 py-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Overall Progress</span>
                      <span className="text-xs font-medium">{activeProject.progress}%</span>
                    </div>
                    <Progress value={activeProject.progress} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Documents</span>
                      <span className="text-xs font-medium">
                        {activeProject.documents_uploaded}/{activeProject.documents_required}
                      </span>
                    </div>
                    <Progress
                      value={
                        activeProject.documents_required > 0
                          ? (activeProject.documents_uploaded / activeProject.documents_required) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Validation Score</span>
                      <span className="text-xs font-medium">{activeProject.validation_score}%</span>
                    </div>
                    <Progress value={activeProject.validation_score} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">AI Confidence</span>
                      <span className="text-xs font-medium">{activeProject.ai_confidence}%</span>
                    </div>
                    <Progress value={activeProject.ai_confidence} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Status Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Document Status</CardTitle>
                <CardDescription className="text-xs">{documents.length} documents total</CardDescription>
              </CardHeader>
              <CardContent>
                {docStatusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={docStatusData}
                          cx="50%" cy="50%"
                          innerRadius={40} outerRadius={65}
                          paddingAngle={3} dataKey="value"
                        >
                          {docStatusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--popover))",
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      {docStatusData.map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px] text-muted-foreground">
                            {d.name} ({d.value})
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No documents yet.{" "}
                    <Link href="/documents/upload" className="text-primary hover:underline">
                      Upload documents
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* IPO Readiness Gauge */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">IPO Readiness Score</CardTitle>
                <CardDescription className="text-xs">{activeProject.company_name}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <div className="relative">
                  <ResponsiveContainer width={140} height={140}>
                    <RadialBarChart
                      cx="50%" cy="50%"
                      innerRadius="60%" outerRadius="90%"
                      barSize={12}
                      data={readinessData}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={6}
                        background={{ fill: "hsl(var(--muted))" }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{validationScore}</span>
                    <span className="text-[11px] text-muted-foreground">out of 100</span>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  {cfg && (
                    <Badge
                      className="text-[11px]"
                      style={{ backgroundColor: undefined }}
                    >
                      {cfg.label}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {QUICK_ACTIONS.map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted group-hover:bg-background transition-colors">
                      <a.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium flex-1">{a.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Active Projects */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Active Projects</CardTitle>
                  <CardDescription className="text-xs">{projects.length} total</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1">
                  <Link href="/projects">
                    View all <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {projects.slice(0, 4).map((p) => {
                  const s = PROJECT_STATUS_CONFIG[p.status as ProjectStatus] ?? {
                    label: p.status,
                    bg: "bg-muted",
                    color: "text-muted-foreground",
                  };
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`} className="block group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors truncate max-w-[160px]">
                          {p.company_name}
                        </span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", s.bg, s.color)}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="h-1.5 flex-1" />
                        <span className="text-[11px] text-muted-foreground w-8 text-right">
                          {p.progress}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
