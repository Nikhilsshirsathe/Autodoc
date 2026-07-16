"use client";
import React, { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, FileText,
  Loader2, ZoomIn, ZoomOut, Download, Hash, Calendar, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { formatFileSize, formatDate, cn } from "@/lib/utils";
import { listDocuments, getExtractedFields, type ApiDocument, type ExtractedField } from "@/lib/data/documents";
import { getCurrentUser } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DocumentViewerPage() {
  const [userId, setUserId] = useState("anon-dev-user");
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getCurrentUser().then((u) => { if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  useEffect(() => {
    listDocuments(userId).then((data) => {
      setDocs(data);
      if (data.length > 0) setSelectedId(data[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  // Load PDF URL + fields when doc selected
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDoc(true);
    setSignedUrl(null);
    setFields([]);

    Promise.all([
      fetch(`${API_URL}/api/v1/documents/${selectedId}/signed-url`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.signed_url ?? null),
      getExtractedFields(selectedId),
    ]).then(([url, f]) => {
      setSignedUrl(url);
      setFields(f);
    }).catch(console.error).finally(() => setLoadingDoc(false));
  }, [selectedId]);

  const selectedDoc = docs.find((d) => d.id === selectedId) ?? null;
  const filteredDocs = docs.filter((d) =>
    d.original_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-112px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex h-[calc(100vh-112px)] items-center justify-center">
        <div className="text-center space-y-2">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs text-muted-foreground">Upload documents to view them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-112px)] overflow-hidden">

      {/* ── Left Sidebar: Document List ─────────────────────────────── */}
      <div className="w-72 border-r flex flex-col shrink-0 bg-background">
        <div className="p-3 border-b space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Documents ({docs.length})
          </p>
          <Input
            placeholder="Search..."
            className="h-7 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={cn(
                  "w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors",
                  doc.id === selectedId
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                <FileText className={cn("h-4 w-4 mt-0.5 shrink-0", doc.id === selectedId ? "text-primary-foreground" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs font-medium truncate leading-tight", doc.id === selectedId ? "text-primary-foreground" : "")}>
                    {doc.original_name}
                  </p>
                  <p className={cn("text-[10px] mt-0.5 capitalize", doc.id === selectedId ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {doc.doc_type.replace(/_/g, " ")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded font-medium",
                      doc.id === selectedId
                        ? "bg-white/20 text-primary-foreground"
                        : doc.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : doc.status === "failed" ? "bg-red-100 text-red-700"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {doc.status}
                    </span>
                    {doc.page_count && (
                      <span className={cn("text-[9px]", doc.id === selectedId ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {doc.page_count}p
                      </span>
                    )}
                  </div>
                </div>
                {doc.id === selectedId && <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0 text-primary-foreground/70" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main PDF Viewer ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
        {/* Toolbar */}
        {selectedDoc && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate flex-1">{selectedDoc.original_name}</span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-xs text-muted-foreground capitalize">{selectedDoc.doc_type.replace(/_/g, " ")}</span>
            {selectedDoc.page_count && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-xs text-muted-foreground">{selectedDoc.page_count} pages</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Badge
                variant={selectedDoc.status === "completed" ? "success" : selectedDoc.status === "failed" ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {selectedDoc.status}
              </Badge>
              {signedUrl && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-3.5 w-3.5" />Download
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* PDF Embed */}
        <div className="flex-1 overflow-hidden">
          {loadingDoc ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading document...</span>
            </div>
          ) : signedUrl ? (
            <iframe
              src={`${signedUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full border-0"
              title={selectedDoc?.original_name ?? "Document"}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <div>
                <p className="text-sm font-medium">No page content available for this document.</p>
                <p className="text-xs mt-1">Extracted fields are available in the Fields tab on the right.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Info & Fields ───────────────────────────────── */}
      <div className="w-72 border-l shrink-0 flex flex-col bg-background">
        <Tabs defaultValue="info" className="flex flex-col h-full">
          <div className="px-3 pt-3 border-b shrink-0">
            <TabsList className="w-full h-8">
              <TabsTrigger value="info"   className="flex-1 text-xs">Info</TabsTrigger>
              <TabsTrigger value="fields" className="flex-1 text-xs">Fields ({fields.length})</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="info" className="mt-0 p-4 space-y-2">
              {selectedDoc ? (
                [
                  { label: "File Name",  value: selectedDoc.original_name },
                  { label: "Type",       value: selectedDoc.doc_type.replace(/_/g, " ") },
                  { label: "Status",     value: selectedDoc.status },
                  { label: "Pages",      value: selectedDoc.page_count ? `${selectedDoc.page_count} pages` : "—" },
                  { label: "File Size",  value: formatFileSize(selectedDoc.file_size) },
                  { label: "Uploaded",   value: formatDate(selectedDoc.created_at, "long") },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col py-1.5 border-b border-border/50 last:border-0">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-xs font-medium capitalize mt-0.5">{value}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Select a document.</p>
              )}
            </TabsContent>

            <TabsContent value="fields" className="mt-0 p-4 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Extracted Fields
              </p>
              {loadingDoc ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No fields extracted for this document.</p>
              ) : (
                fields.map((f) => (
                  <div key={f.id} className="py-1.5 border-b border-border/50 last:border-0">
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {f.field_name.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs font-medium mt-0.5 break-words">{f.field_value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.round(f.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">
                        {Math.round(f.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
