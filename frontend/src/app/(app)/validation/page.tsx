"use client";
import React, { useState } from "react";
import { AlertCircle, XCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, Download, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VALIDATION_SEVERITY_CONFIG } from "@/constants";
import { formatDate, cn } from "@/lib/utils";
import type { ValidationSeverity } from "@/types";

type ValidationStatus = "open" | "resolved" | "ignored";

interface ValidationIssue {
  id: string;
  title: string;
  description: string;
  severity: ValidationSeverity;
  status: ValidationStatus;
  affectedSection: string;
  ruleCode: string;
  suggestedFix: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

const SEVERITY_ICONS: Record<ValidationSeverity, React.ElementType> = {
  critical: AlertCircle, error: XCircle, warning: AlertTriangle, info: Info,
};

export default function ValidationPage() {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = issues.filter(i => {
    const mSev = severityFilter === "all" || i.severity === severityFilter;
    const mSt  = statusFilter  === "all" || i.status   === statusFilter;
    return mSev && mSt;
  });

  const resolve = (id: string) =>
    setIssues(p => p.map(i => i.id === id
      ? { ...i, status: "resolved" as const, resolvedBy: "You", resolvedAt: new Date().toISOString() }
      : i
    ));

  const score = issues.length === 0 ? 0 : Math.round((issues.filter(i => i.status === "resolved").length / issues.length) * 100);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Validation Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {issues.length === 0 ? "No validation run yet" : `${issues.filter(i => i.status === "resolved").length} of ${issues.length} issues resolved`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={issues.length === 0}><Download className="h-4 w-4" />Export Report</Button>
          <Button size="sm"><RefreshCw className="h-4 w-4" />Run Validation</Button>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["critical", "error", "warning", "info"] as ValidationSeverity[]).map((severity) => {
          const cfg = VALIDATION_SEVERITY_CONFIG[severity];
          const Icon = SEVERITY_ICONS[severity];
          const count = issues.filter(i => i.severity === severity).length;
          return (
            <Card key={severity} className={cn("border-l-4",
              severity === "critical" ? "border-l-red-500" :
              severity === "error"    ? "border-l-orange-500" :
              severity === "warning"  ? "border-l-amber-500" : "border-l-blue-500"
            )}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn("h-5 w-5 shrink-0", cfg.color)} />
                <div>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground capitalize">{cfg.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {Object.entries(VALIDATION_SEVERITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} issues shown</span>
      </div>

      {/* Empty state / Issues list */}
      {issues.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No validation issues yet.</p>
            <p className="text-xs mt-1">Click "Run Validation" to check your documents.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((issue) => {
            const cfg = VALIDATION_SEVERITY_CONFIG[issue.severity];
            const Icon = SEVERITY_ICONS[issue.severity];
            const isExpanded = expanded === issue.id;
            return (
              <Card key={issue.id} className={cn("overflow-hidden", issue.status === "resolved" && "opacity-70")}>
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : issue.id)}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{issue.title}</p>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", cfg.bg)}>{cfg.label}</span>
                      <Badge variant={issue.status === "resolved" ? "success" : "outline"} className="text-[10px]">{issue.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{issue.affectedSection} · {issue.ruleCode}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {issue.status === "open" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); resolve(issue.id); }}>
                        <CheckCircle2 className="h-3 w-3" />Resolve
                      </Button>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/20">
                    <div>
                      <p className="text-xs font-semibold mb-1">Description</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1">Suggested Fix</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{issue.suggestedFix}</p>
                    </div>
                    {issue.resolvedBy && (
                      <p className="text-xs text-muted-foreground">
                        Resolved by <span className="font-medium text-foreground">{issue.resolvedBy}</span>
                        {issue.resolvedAt && <> · {formatDate(issue.resolvedAt, "relative")}</>}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
