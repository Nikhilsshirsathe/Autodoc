"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, Clock, RotateCcw,
  Eye, Trash2, Grid3X3, List, HardDrive, Search, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_CATEGORY_COLORS } from "@/constants";
import { formatFileSize, formatDate, cn } from "@/lib/utils";
import {
  uploadDocument,
  getPipelineStatus,
  listDocuments,
  deleteDocument,
  type ApiDocument,
  type PipelineStatus,
} from "@/lib/data/documents";
import { getCurrentUser } from "@/lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  failed: AlertCircle,
  processing: Loader2,
  uploaded: Clock,
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-600",
  failed: "text-red-500",
  processing: "text-blue-500",
  uploaded: "text-amber-500",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Processed",
  failed: "Failed",
  processing: "Processing",
  uploaded: "Queued",
};

// In-flight upload state
interface UploadEntry {
  id: string;          // temp id while uploading
  name: string;
  progress: number;    // 0-100
  error?: string;
}

// Tracks documents actively being processed so we can poll them
interface PollingEntry {
  documentId: string;
  status: PipelineStatus["status"];
}

// Fallback: anonymous user ID for dev (replace with real auth)
const ANON_USER_ID = "anon-dev-user";

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentUploadPage() {
  const [userId, setUserId] = useState<string>(ANON_USER_ID);
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState<UploadEntry[]>([]);
  const [polling, setPolling] = useState<PollingEntry[]>([]);
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ── Resolve real user on mount ─────────────────────────────────────────────
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user?.id) setUserId(user.id);
    }).catch(() => { /* no-op if Supabase not configured yet */ });
  }, []);

  // ── Load documents on mount ────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    try {
      const data = await listDocuments(userId);
      setDocs(data);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // ── Poll processing documents ──────────────────────────────────────────────
  useEffect(() => {
    const pending = polling.filter((p) => p.status === "processing" || p.status === "uploaded");

    if (pending.length === 0) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      const updates = await Promise.allSettled(
        pending.map((p) => getPipelineStatus(p.documentId))
      );

      let anyDone = false;
      updates.forEach((result, i) => {
        if (result.status === "fulfilled") {
          const ps = result.value;
          setPolling((prev) =>
            prev.map((p) =>
              p.documentId === pending[i].documentId ? { ...p, status: ps.status } : p
            )
          );
          if (ps.status === "completed" || ps.status === "failed") {
            anyDone = true;
            // Update the doc in the list
            setDocs((prev) =>
              prev.map((d) =>
                d.id === pending[i].documentId
                  ? { ...d, status: ps.status as ApiDocument["status"], page_count: ps.page_count }
                  : d
              )
            );
          }
        }
      });

      if (anyDone) {
        // Remove completed/failed from polling
        setPolling((prev) =>
          prev.filter((p) => p.status === "processing" || p.status === "uploaded")
        );
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [polling]);

  // ── Drop handler ───────────────────────────────────────────────────────────
  const onDrop = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        const tempId = Math.random().toString(36).slice(2);
        setUploading((p) => [...p, { id: tempId, name: file.name, progress: 0 }]);

        try {
          const doc = await uploadDocument(
            file,
            userId,
            undefined,     // companyId — wire to active project later
            "ipo_prospectus",
            true,
            (pct) => {
              setUploading((p) =>
                p.map((u) => (u.id === tempId ? { ...u, progress: pct } : u))
              );
            }
          );

          // Add to docs list
          setDocs((prev) => [doc, ...prev]);

          // Start polling the new document
          setPolling((prev) => [
            ...prev,
            { documentId: doc.id, status: doc.status },
          ]);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Upload failed";
          setUploading((p) =>
            p.map((u) => (u.id === tempId ? { ...u, error: message } : u))
          );
        } finally {
          // Remove from uploading list after a short delay
          setTimeout(() => {
            setUploading((p) => p.filter((u) => u.id !== tempId));
          }, 2000);
        }
      }
    },
    [userId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
  });

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (docId: string) => {
      try {
        await deleteDocument(docId, userId);
        setDocs((prev) => prev.filter((d) => d.id !== docId));
        setPolling((prev) => prev.filter((p) => p.documentId !== docId));
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },
    [userId]
  );

  // ── Retry handler ──────────────────────────────────────────────────────────
  const handleRetry = useCallback(
    async (docId: string) => {
      try {
        const { triggerPipeline } = await import("@/lib/data/documents");
        await triggerPipeline(docId);
        setDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: "processing" } : d))
        );
        setPolling((prev) => {
          if (prev.find((p) => p.documentId === docId)) {
            return prev.map((p) =>
              p.documentId === docId ? { ...p, status: "processing" } : p
            );
          }
          return [...prev, { documentId: docId, status: "processing" }];
        });
      } catch (err) {
        console.error("Retry failed:", err);
      }
    },
    []
  );

  // ── Filtered view ──────────────────────────────────────────────────────────
  const filtered = docs.filter((d) => {
    const matchSearch =
      d.original_name.toLowerCase().includes(search.toLowerCase()) ||
      d.doc_type.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || d.doc_type === catFilter;
    return matchSearch && matchCat;
  });

  const totalSize = docs.reduce((s, d) => s + (d.file_size || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Document Upload</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {docs.length} document{docs.length !== 1 ? "s" : ""} uploaded
            {polling.some((p) => p.status === "processing") && (
              <span className="ml-2 text-blue-500 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Processing...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HardDrive className="h-4 w-4" />
          <span>{formatFileSize(totalSize)} used</span>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl transition-colors",
              isDragActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-medium">
              {isDragActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or{" "}
              <span className="text-primary cursor-pointer hover:underline">
                browse files
              </span>{" "}
              from your computer
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Supports PDF, JPG, PNG · Max 50 MB per file
          </p>
        </div>
      </div>

      {/* Upload progress */}
      {uploading.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Uploading {uploading.length} file{uploading.length > 1 ? "s" : ""}…
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploading.map((u) => (
              <div key={u.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm truncate max-w-xs">{u.name}</span>
                  {u.error ? (
                    <span className="text-xs text-red-500">{u.error}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(u.progress)}%
                    </span>
                  )}
                </div>
                <Progress
                  value={u.progress}
                  className={cn("h-1.5", u.error && "bg-red-100")}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {[
              "ipo_prospectus",
              "financials",
              "incorporation",
              "legal",
              "compliance",
              "directors",
              "shareholding",
              "licenses",
              "other",
            ].map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-md p-0.5 ml-auto">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("grid")}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Status summary badges */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { label: "Processed", key: "completed", color: "success" },
            { label: "Processing", key: "processing", color: "info" },
            { label: "Queued",    key: "uploaded",   color: "warning" },
            { label: "Failed",    key: "failed",     color: "critical" },
          ] as const
        ).map((b) => {
          const count = docs.filter((d) => d.status === b.key).length;
          return count > 0 ? (
            <Badge key={b.label} variant={b.color} className="gap-1">
              {b.label} <span className="font-bold">{count}</span>
            </Badge>
          ) : null;
        })}
      </div>

      {/* Loading state */}
      {loadingDocs && (
        <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading documents…</span>
        </div>
      )}

      {/* List View */}
      {!loadingDocs && view === "list" && (
        <Card>
          <div className="divide-y divide-border">
            {filtered.map((doc) => {
              const Icon = STATUS_ICON[doc.status] ?? Clock;
              const colorClass = STATUS_COLOR[doc.status] ?? "text-muted-foreground";
              const isProcessing = doc.status === "processing";
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.original_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {doc.doc_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(doc.file_size)}
                      </span>
                      {doc.page_count != null && (
                        <>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            {doc.page_count}p
                          </span>
                        </>
                      )}
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                    {doc.error_message && (
                      <p className="text-[11px] text-red-500 mt-0.5 truncate">
                        {doc.error_message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        colorClass,
                        isProcessing && "animate-spin"
                      )}
                    />
                    <span className={cn("text-xs font-medium capitalize", colorClass)}>
                      {STATUS_LABEL[doc.status] ?? doc.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {doc.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-500"
                        title="Retry processing"
                        onClick={() => handleRetry(doc.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Delete document"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && !loadingDocs && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {docs.length === 0
                  ? "No documents yet. Drop files above to get started."
                  : "No documents match your filters."}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Grid View */}
      {!loadingDocs && view === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((doc) => {
            const Icon = STATUS_ICON[doc.status] ?? Clock;
            const colorClass = STATUS_COLOR[doc.status] ?? "text-muted-foreground";
            return (
              <Card
                key={doc.id}
                className="group cursor-pointer hover:shadow-md transition-all"
              >
                <CardContent className="p-3">
                  <div className="flex h-24 items-center justify-center rounded-lg bg-muted mb-3 relative">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        className="h-6 w-6 rounded bg-background/80 flex items-center justify-center hover:bg-background text-red-500"
                        onClick={() => handleDelete(doc.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p
                    className="text-xs font-medium truncate leading-tight"
                    title={doc.original_name}
                  >
                    {doc.original_name}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                      {doc.doc_type.replace(/_/g, " ")}
                    </span>
                    <span className={cn("text-[10px] flex items-center gap-0.5", colorClass)}>
                      <Icon
                        className={cn(
                          "h-3 w-3",
                          doc.status === "processing" && "animate-spin"
                        )}
                      />
                      {STATUS_LABEL[doc.status]}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
              {docs.length === 0
                ? "No documents yet. Drop files above to get started."
                : "No documents match your filters."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
