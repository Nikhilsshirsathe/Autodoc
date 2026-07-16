// @ts-nocheck
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, FileText, ArrowLeft, Edit, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PROJECT_STATUS_CONFIG, USER_ROLE_CONFIG } from "@/constants";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { getProject, type ApiProject } from "@/lib/data/projects";
import { getCurrentUser } from "@/lib/supabase";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(async (user) => {
      const userId = user?.id ?? "anon-dev-user";
      try {
        const data = await getProject(id, userId);
        setProject(data);
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 text-muted-foreground py-16">
        <Building2 className="h-10 w-10 opacity-30" />
        <p className="text-sm">Project not found.</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/projects"><ArrowLeft className="h-4 w-4" />Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const s = PROJECT_STATUS_CONFIG[project.status as any] ?? { label: project.status, bg: "bg-muted", color: "text-muted-foreground" };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" asChild>
          <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{project.company_name}</h1>
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.bg, s.color)}>{s.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {project.exchange} · {project.industry}{project.cin ? ` · CIN: ${project.cin}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" asChild>
            <Link href="/draft"><FileText className="h-4 w-4" />View Draft</Link>
          </Button>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Overall Progress",  value: `${project.progress}%`,         sub: "project completion" },
          { label: "Documents",          value: `${project.documents_uploaded}/${project.documents_required}`, sub: "uploaded / required" },
          { label: "Validation Score",   value: `${project.validation_score}%`, sub: "current score" },
          { label: "IPO Size",           value: project.ipo_size ? formatCurrency(project.ipo_size) : "—", sub: project.exchange ?? "exchange TBD" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs font-medium mt-0.5">{stat.label}</div>
              <div className="text-[11px] text-muted-foreground">{stat.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall IPO Readiness</span>
            <span className="text-sm font-bold">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2.5" />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Company Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  ["CIN",                project.cin ?? "—"],
                  ["PAN",                project.pan ?? "—"],
                  ["Incorporation Date", project.incorporation_date ? formatDate(project.incorporation_date, "long") : "—"],
                  ["Address",            [project.registered_address, project.city, project.pincode].filter(Boolean).join(", ") || "—"],
                  ["State",              project.state ?? "—"],
                  ["Website",            project.website ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="text-xs text-muted-foreground w-36 shrink-0">{k}</span>
                    <span className="text-xs font-medium flex-1">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">IPO Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  ["Exchange",       project.exchange ?? "—"],
                  ["IPO Size",       project.ipo_size ? formatCurrency(project.ipo_size) : "—"],
                  ["Face Value",     project.face_value ? `₹${project.face_value}` : "—"],
                  ["Issue Price",    project.issue_price ? `₹${project.issue_price}` : "—"],
                  ["Lot Size",       project.lot_size ? `${project.lot_size} shares` : "—"],
                  ["Target Filing",  project.target_filing_date ? formatDate(project.target_filing_date, "long") : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="text-xs text-muted-foreground w-36 shrink-0">{k}</span>
                    <span className="text-xs font-medium flex-1">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          {project.description && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">About</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm">Team Members</CardTitle>
              <Button size="sm" asChild><Link href="/collaboration">Manage Team</Link></Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(project.team_members ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Users className="h-6 w-6 opacity-30 mx-auto mb-2" />
                  No team members yet.
                </div>
              ) : (
                (project.team_members ?? []).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{m.role}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
