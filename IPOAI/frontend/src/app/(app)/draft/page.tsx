"use client";
import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, CheckCircle2, Edit3, History, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DRAFT_SECTIONS } from "@/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/supabase";
import { listDocuments } from "@/lib/data/documents";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SectionStatus = "not_started" | "generating" | "draft" | "approved";

interface SectionState {
  status: SectionStatus;
  confidence: number;
  wordCount: number;
  content: string;
  sources: { document_id: string; document_name?: string; chunk_ids?: string[] }[];
}

const initialStatuses = (): Record<string, SectionState> =>
  Object.fromEntries(
    DRAFT_SECTIONS.map((s) => [s.code, { status: "not_started", confidence: 0, wordCount: 0, content: "", sources: [] }])
  );

export default function DraftPage() {
  const [activeSection, setActiveSection] = useState(DRAFT_SECTIONS[0]?.code ?? "");
  const [statuses, setStatuses] = useState<Record<string, SectionState>>(initialStatuses);
  const [editMode, setEditMode] = useState(false);
  const [userId, setUserId] = useState("anon-dev-user");
  const [documentIds, setDocumentIds] = useState<string[]>([]);

  useEffect(() => {
    getCurrentUser().then((u) => { if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  useEffect(() => {
    listDocuments(userId).then((docs) => {
      const completed = docs.filter((d) => d.status === "completed").map((d) => d.id);
      setDocumentIds(completed);
    }).catch(() => {});
  }, [userId]);

  const current = DRAFT_SECTIONS.find((s) => s.code === activeSection);
  const currentStatus = statuses[activeSection] ?? { status: "not_started", confidence: 0, wordCount: 0, content: "", sources: [] };
  const approvedCount = Object.values(statuses).filter((s) => s.status === "approved").length;

  const generate = async () => {
    if (!current) return;
    setStatuses((p) => ({ ...p, [activeSection]: { ...p[activeSection], status: "generating" } }));
    toast.info(`Generating ${current.title}...`, { description: "AI is reading your documents." });

    try {
      const res = await fetch(`${API_URL}/api/v1/rag/generate-draft-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_code: activeSection,
          section_title: current.title,
          user_id: userId,
          document_ids: documentIds.length > 0 ? documentIds : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Generation failed (${res.status})`);
      }

      const data = await res.json();
      setStatuses((p) => ({
        ...p,
        [activeSection]: {
          status: "draft",
          confidence: Math.round((data.confidence ?? 0) * 100),
          wordCount: data.word_count ?? 0,
          content: data.content ?? "",
          sources: data.sources ?? [],
        },
      }));
      toast.success(`${current.title} generated!`, { description: "Review and approve when ready." });
    } catch (err: any) {
      toast.error("Generation failed", { description: err.message });
      setStatuses((p) => ({ ...p, [activeSection]: { ...p[activeSection], status: "not_started" } }));
    }
  };

  const approve = () => {
    setStatuses((p) => ({ ...p, [activeSection]: { ...p[activeSection], status: "approved" } }));
    toast.success("Section approved!");
  };

  const updateContent = (val: string) => {
    const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
    setStatuses((p) => ({ ...p, [activeSection]: { ...p[activeSection], content: val, wordCount } }));
  };

  if (!current) return null;

  return (
    <div className="flex h-[calc(100vh-112px)] overflow-hidden">
      {/* Section Navigation */}
      <div className="w-64 border-r flex flex-col shrink-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sections</p>
            <span className="text-[10px] text-muted-foreground">{approvedCount}/{DRAFT_SECTIONS.length}</span>
          </div>
          <Progress value={(approvedCount / DRAFT_SECTIONS.length) * 100} className="h-1" />
          {documentIds.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1.5">⚠ No processed documents found</p>
          )}
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-0.5">
            {DRAFT_SECTIONS.map((s) => {
              const st = statuses[s.code];
              return (
                <button
                  key={s.code}
                  onClick={() => { setActiveSection(s.code); setEditMode(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors text-xs",
                    activeSection === s.code ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                    st?.status === "approved"   ? "bg-emerald-500" :
                    st?.status === "draft"      ? "bg-amber-500" :
                    st?.status === "generating" ? "bg-blue-500 animate-pulse" : "bg-zinc-400 dark:bg-zinc-600"
                  )} />
                  <span className="flex-1 truncate font-medium">{s.title}</span>
                  {st?.status === "approved" && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Draft Editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0 bg-background">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold">{current.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {currentStatus.confidence > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  AI Confidence: <span className="font-medium text-foreground">{currentStatus.confidence}%</span>
                </span>
              )}
              {currentStatus.wordCount > 0 && (
                <span className="text-[11px] text-muted-foreground">· {currentStatus.wordCount} words</span>
              )}
              <Badge
                variant={
                  currentStatus.status === "approved"   ? "success" :
                  currentStatus.status === "draft"      ? "warning" :
                  currentStatus.status === "generating" ? "info" : "secondary"
                }
                className="text-[10px]"
              >
                {currentStatus.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(currentStatus.status === "draft" || currentStatus.status === "approved") && (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={generate}>
                  <RefreshCw className="h-3.5 w-3.5" />Regenerate
                </Button>
                <Button variant={editMode ? "secondary" : "outline"} size="sm" className="h-8 gap-1 text-xs" onClick={() => setEditMode((e) => !e)}>
                  <Edit3 className="h-3.5 w-3.5" />{editMode ? "Preview" : "Edit"}
                </Button>
                {currentStatus.status !== "approved" && (
                  <Button size="sm" className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={approve}>
                    <CheckCircle2 className="h-3.5 w-3.5" />Approve
                  </Button>
                )}
              </>
            )}
            {currentStatus.status === "generating" && (
              <Button disabled size="sm" className="h-8 gap-1 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...
              </Button>
            )}
            {currentStatus.status === "not_started" && (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={generate}>
                <Sparkles className="h-3.5 w-3.5" />Generate Section
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {currentStatus.status === "not_started" && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Not generated yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Click "Generate Section" to have AI draft this section using your uploaded documents.
                  {documentIds.length === 0 && <span className="text-amber-600 block mt-1">Upload and process documents first for best results.</span>}
                </p>
              </div>
              <Button onClick={generate}><Sparkles className="h-4 w-4" />Generate {current.title}</Button>
            </div>
          )}

          {currentStatus.status === "generating" && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold">Generating {current.title}...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {documentIds.length > 0
                    ? `Searching ${documentIds.length} document(s) and generating with AI`
                    : "Generating with AI (no documents found — using general knowledge)"}
                </p>
              </div>
            </div>
          )}

          {(currentStatus.status === "draft" || currentStatus.status === "approved") && (
            <div className="max-w-3xl mx-auto space-y-4">
              {currentStatus.status === "approved" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">This section has been approved.</span>
                </div>
              )}
              {editMode ? (
                <Textarea
                  value={currentStatus.content}
                  onChange={(e) => updateContent(e.target.value)}
                  className="min-h-[500px] font-mono text-sm resize-none"
                />
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {currentStatus.content.split("\n\n").map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground/90 mb-3">{para}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Evidence Panel */}
      <div className="w-64 border-l shrink-0 flex flex-col">
        <div className="p-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Evidence Sources</p>
        </div>
        <ScrollArea className="flex-1 p-3">
          {currentStatus.sources.length > 0 ? (
            <div className="space-y-3">
              {currentStatus.sources.map((src, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-[11px] font-medium leading-tight">
                    {src.document_name ?? src.document_id.slice(0, 8) + "..."}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{src.chunk_ids?.length ?? 0} chunk(s) used</p>
                  <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${currentStatus.confidence}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground px-2">
              <FileText className="h-8 w-8 opacity-30 mb-2" />
              <p className="text-xs">Evidence will appear here after generation.</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
