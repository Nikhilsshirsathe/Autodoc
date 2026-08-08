"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText, Eye, Trash2, CheckCircle2, AlertCircle, Clock, Search, Loader2, RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatFileSize, formatDate, cn } from "@/lib/utils";
import {
  listDocuments,
  deleteDocument,
  getPipelineStatus,
  type ApiDocument,
} from "@/lib/data/documents";
import { useAuth } from "@/context/auth-context";

const STATUS_CONFIG = {
  completed: { label: "Processed", variant: "success" as const,  Icon: CheckCircle2 },
  processing: { label: "Processing", variant: "info" as const,   Icon: Loader2 },
  uploaded:   { label: "Queued",    variant: "warning" as const, Icon: Clock },
  failed:     { label: "Failed",    variant: "critical" as const, Icon: AlertCircle },
} as const;

export default function DocumentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchDocs = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listDocuments(userId);
      setDocs(data);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!authLoading && userId) fetchDocs();
  }, [fetchDocs, authLoading, userId]);

  // Handle delete
  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId, userId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Handle retry
  const handleRetry = async (docId: string) => {
    try {
      const { triggerPipeline } = await import("@/lib/data/documents");
      await triggerPipeline(docId);
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: "processing" } : d));
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  // Filter documents
  const filtered = docs.filter((d) => {
    const matchSearch =
      d.original_name.toLowerCase().includes(search.toLowerCase()) ||
      d.doc_type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || d.doc_type === typeFilter;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/documents/upload">Upload Documents</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search documents…"
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {[
              "ipo_prospectus", "financials", "incorporation", "legal",
              "compliance", "directors", "shareholding", "licenses", "other",
            ].map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading documents…</span>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => {
                const s = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.uploaded;
                const isProcessing = doc.status === "processing";
                return (
                  <TableRow key={doc.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-muted shrink-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {doc.original_name}
                          </p>
                          {doc.error_message && (
                            <p className="text-[11px] text-red-500 truncate max-w-[200px]">
                              {doc.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground capitalize">
                        {doc.doc_type.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{doc.page_count ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant} className="gap-1 text-[10px]">
                        <s.Icon className={cn("h-3 w-3", isProcessing && "animate-spin")} />
                        {s.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-500"
                            onClick={() => handleRetry(doc.id)}
                            title="Retry"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                    {docs.length === 0
                      ? "No documents uploaded yet."
                      : "No documents match your filters."}
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
