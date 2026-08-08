"use client";
import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, RefreshCw, Loader2, FileText, RotateCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listDocuments, triggerPipeline, type ApiDocument } from "@/lib/data/documents";
import { useAuth } from "@/context/auth-context";
import { useProject } from "@/context/project-context";
import { getDocIdsForProject } from "@/lib/project-doc-map";

const DOC_TYPE_COLORS: Record<string, string> = {
  ipo_prospectus:   "#6366f1",
  financials:       "#10b981",
  incorporation:    "#0ea5e9",
  legal:            "#f59e0b",
  compliance:       "#f97316",
  directors:        "#ec4899",
  shareholding:     "#8b5cf6",
  licenses:         "#14b8a6",
  other:            "#94a3b8",
};

export default function ClassificationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedProjectId } = useProject();
  const userId = user?.id ?? "";
  const [allDocs, setAllDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchDocs = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listDocuments(userId);
      const filtered = selectedProjectId
        ? data.filter((d) => {
            const ids = getDocIdsForProject(selectedProjectId);
            return d.project_id === selectedProjectId || ids.has(d.id);
          })
        : data;
      setAllDocs(filtered);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedProjectId]);

  useEffect(() => { if (!authLoading && userId) fetchDocs(); }, [fetchDocs, authLoading, userId]);

  const handleRetry = async (docId: string) => {
    try {
      await triggerPipeline(docId);
      setAllDocs((p) => p.map((d) => d.id === docId ? { ...d, status: "processing" as const } : d));
    } catch (err) { console.error(err); }
  };

  // Count by doc_type for chart
  const typeCounts = allDocs.reduce<Record<string, number>>((acc, d) => {
    acc[d.doc_type] = (acc[d.doc_type] ?? 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(typeCounts).map(([type, count]) => ({
    category: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type,
    count,
    color: DOC_TYPE_COLORS[type] ?? "#94a3b8",
  }));

  const completed = allDocs.filter((d) => d.status === "completed");
  const processing = allDocs.filter((d) => d.status === "processing");
  const failed = allDocs.filter((d) => d.status === "failed");

  const filtered = filter === "all" ? allDocs
    : filter === "completed" ? completed
    : filter === "processing" ? processing
    : filter === "failed" ? failed
    : allDocs;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Document Classification</h1>
          <p className="text-sm text-muted-foreground mt-1">All uploaded documents classified by type</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDocs}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: allDocs.length,      color: "text-foreground" },
          { label: "Processed",       value: completed.length,    color: "text-emerald-600" },
          { label: "Processing",      value: processing.length,   color: "text-blue-600" },
          { label: "Failed",          value: failed.length,       color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading documents…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Documents by Type</CardTitle></CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                  No documents yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Queue */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Document Queue</CardTitle>
                <CardDescription className="text-xs">{filtered.length} documents</CardDescription>
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Processed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-30 mx-auto mb-2" />
                  <p className="text-sm">No documents found.</p>
                  <p className="text-xs mt-1">Upload documents to see them here.</p>
                </div>
              ) : (
                filtered.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.original_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{ background: DOC_TYPE_COLORS[doc.doc_type] ?? "#94a3b8" }}>
                          {doc.doc_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        {doc.page_count && <span className="text-[10px] text-muted-foreground">{doc.page_count} pages</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.status === "completed" && (
                        <Badge variant="success" className="text-[10px]">Processed</Badge>
                      )}
                      {doc.status === "processing" && (
                        <Badge variant="info" className="text-[10px] gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />Processing
                        </Badge>
                      )}
                      {doc.status === "uploaded" && (
                        <Badge variant="warning" className="text-[10px]">Queued</Badge>
                      )}
                      {doc.status === "failed" && (
                        <div className="flex items-center gap-1">
                          <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500" onClick={() => handleRetry(doc.id)} title="Retry">
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
