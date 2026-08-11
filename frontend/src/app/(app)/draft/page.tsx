"use client";
import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Play,
  FileDown,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useProject } from "@/context/project-context";
import {
  getIpoTemplates,
  validateKnowledgeBase,
  generateSection,
  generateFullDraft,
  downloadMarkdown,
  downloadDocx,
  downloadPdf,
} from "@/lib/data/ipo";
import type {
  IpoTemplateMetadata,
  ValidationResult,
  GenerationResult,
  SectionValidation,
  IpoSectionStatus,
} from "@/types/ipo";

export default function IpoDraftGeneratorPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedProjectId } = useProject();
  const userId = user?.id ?? "";
  const userResolved = !authLoading && !!userId;
  const [projectName, setProjectName] = useState<string>("My IPO Draft");
  const [editingName, setEditingName] = useState(false);
  const [templates, setTemplates] = useState<IpoTemplateMetadata[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [generatedSections, setGeneratedSections] = useState<Map<string, GenerationResult>>(
    new Map()
  );
  const [activeSection, setActiveSection] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);

  // Draft history: each entry is { label, timestamp, sections snapshot }
  const [draftHistory, setDraftHistory] = useState<
    Array<{ label: string; timestamp: string; sections: Map<string, GenerationResult> }>
  >([]);

  // Load templates immediately — they don't need a user ID
  useEffect(() => {
    loadTemplates();
  }, []);

  // Resolve user, then run validation
  useEffect(() => {
    if (!authLoading && userId) runValidation();
  }, [authLoading, userId]);

  const loadTemplates = async () => {
    try {
      const tmpl = await getIpoTemplates();
      setTemplates(tmpl);
      if (tmpl.length > 0 && !activeSection) {
        setActiveSection(tmpl[0].id);
      }
    } catch (err: any) {
      toast.error("Failed to load templates", { description: err.message });
    }
  };

  const runValidation = async () => {
    if (!userId) return;
    setIsValidating(true);
    try {
      const result = await validateKnowledgeBase(userId, selectedProjectId ?? undefined);
      setValidation(result);
    } catch (err: any) {
      toast.error("Validation failed", { description: err.message });
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateSection = async (sectionId: string, force: boolean = false) => {
    if (!userId) return;
    setGeneratingSection(sectionId);
    toast.info(`Generating section...`, { description: "AI is analyzing your knowledge base." });

    try {
      const result = await generateSection({
        section_id: sectionId,
        user_id: userId,
        force,
      });

      setGeneratedSections((prev) => new Map(prev).set(sectionId, result));

      if (result.status === "generated") {
        toast.success("Section generated!", {
          description: `${result.word_count} words • ${Math.round(result.confidence * 100)}% confidence`,
        });
      } else if (result.status === "missing") {
        toast.warning("Required fields missing", {
          description: "Upload relevant documents or use force mode.",
        });
      } else {
        toast.error("Generation failed", {
          description: result.warnings.join(", "),
        });
      }
    } catch (err: any) {
      toast.error("Generation error", { description: err.message });
    } finally {
      setGeneratingSection(null);
    }
  };

  const handleGenerateAll = async (force: boolean = false) => {
    if (!userId) return;
    setIsGeneratingAll(true);
    toast.info("Generating complete IPO Draft...", {
      description: "This may take a few minutes.",
    });

    try {
      const summary = await generateFullDraft({
        user_id: userId,
        force,
      });

      const newMap = new Map(generatedSections);
      for (const section of summary.sections) {
        newMap.set(section.section_id, section);
      }
      setGeneratedSections(newMap);

      // Save snapshot to draft history
      const draftNum = draftHistory.length + 1;
      setDraftHistory((prev) => [
        ...prev,
        {
          label: `Draft ${draftNum}`,
          timestamp: new Date().toLocaleTimeString(),
          sections: new Map(newMap),
        },
      ]);

      toast.success("IPO Draft generation complete!", {
        description: `${summary.generated_count}/${summary.total_sections} sections • ${summary.total_word_count} words`,
      });
    } catch (err: any) {
      toast.error("Full draft generation failed", { description: err.message });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleDownload = async (format: "markdown" | "docx" | "pdf") => {
    if (!userId || generatedSections.size === 0) {
      toast.error("No sections to download");
      return;
    }

    try {
      const sections = Array.from(generatedSections.values());
      let blob: Blob;
      let ext: string;

      if (format === "markdown") {
        blob = await downloadMarkdown({ user_id: userId, sections, company_name: projectName });
        ext = "md";
      } else if (format === "docx") {
        blob = await downloadDocx({ user_id: userId, sections, company_name: projectName });
        ext = "docx";
      } else {
        blob = await downloadPdf({ user_id: userId, sections, company_name: projectName });
        ext = "pdf";
      }

      const safeName = projectName.replace(/[^a-z0-9]/gi, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_IPO_Draft.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error("Download failed", { description: err.message });
    }
  };

  const getSectionValidation = (sectionId: string): SectionValidation | null => {
    return validation?.sections.find((s) => s.section_id === sectionId) ?? null;
  };

  const getStatusColor = (status: IpoSectionStatus) => {
    switch (status) {
      case "generated":
      case "complete":
        return "bg-emerald-500";
      case "partial":
        return "bg-amber-500";
      case "missing":
        return "bg-red-500";
      case "error":
        return "bg-red-600";
      default:
        return "bg-zinc-400";
    }
  };

  const getStatusBadge = (status: IpoSectionStatus) => {
    switch (status) {
      case "generated":
      case "complete":
        return "success";
      case "partial":
        return "warning";
      case "missing":
        return "destructive";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const currentTemplate = templates.find((t) => t.id === activeSection);
  const currentValidation = getSectionValidation(activeSection);
  const currentGenerated = generatedSections.get(activeSection);

  return (
    <div className="flex h-[calc(100vh-112px)] overflow-hidden">
      {/* Left sidebar - Validation & Section List */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-4 border-b space-y-3">
          {/* Editable project name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {editingName ? (
              <>
                <Input
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                  }}
                  className="h-7 text-sm font-semibold px-2 flex-1"
                  maxLength={80}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => setEditingName(false)}
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </Button>
              </>
            ) : (
              <>
                <h3
                  className="text-sm font-semibold truncate flex-1 cursor-pointer hover:text-primary transition-colors"
                  title={projectName}
                  onClick={() => setEditingName(true)}
                >
                  {projectName}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => setEditingName(true)}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runValidation}
                  disabled={isValidating}
                  className="h-7 w-7 p-0 shrink-0"
                >
                  {isValidating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </>
            )}
          </div>

          {validation ? (
            <>
              <div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-3xl font-bold">
                    {Math.round(validation.overall_readiness_pct)}%
                  </span>
                  <span className="text-xs text-muted-foreground pb-1">Overall</span>
                </div>
                <Progress value={validation.overall_readiness_pct} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {validation.complete_sections}
                  </div>
                  <div className="text-muted-foreground mt-0.5">Complete</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <div className="font-semibold text-amber-700 dark:text-amber-400">
                    {validation.partial_sections}
                  </div>
                  <div className="text-muted-foreground mt-0.5">Partial</div>
                </div>
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="font-semibold text-red-700 dark:text-red-400">
                    {validation.missing_sections}
                  </div>
                  <div className="text-muted-foreground mt-0.5">Missing</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleGenerateAll(false)}
                  disabled={isGeneratingAll}
                  className="flex-1 h-8 text-xs"
                  size="sm"
                >
                  {isGeneratingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Generate All
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownload("pdf")}
                  disabled={generatedSections.size === 0}
                  className="h-8 text-xs"
                  size="sm"
                  title="Download PDF"
                >
                  <FileDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownload("docx")}
                  disabled={generatedSections.size === 0}
                  className="h-8 text-xs"
                  size="sm"
                  title="Download DOCX"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {!userResolved ? "Connecting..." : "Checking knowledge base..."}
              </p>
              <Button
                onClick={() => handleGenerateAll(true)}
                disabled={isGeneratingAll || !userResolved}
                className="w-full h-8 text-xs"
                size="sm"
              >
                {isGeneratingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Generate Full Draft
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-0.5">
            {templates.map((tmpl) => {
              const sv = getSectionValidation(tmpl.id);
              const generated = generatedSections.get(tmpl.id);
              const status = generated?.status ?? sv?.status ?? "missing";
              const isGenerating = generatingSection === tmpl.id;

              return (
                <button
                  key={tmpl.id}
                  onClick={() => setActiveSection(tmpl.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors text-xs",
                    activeSection === tmpl.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      getStatusColor(status),
                      isGenerating && "animate-pulse"
                    )}
                  />
                  <span className="flex-1 truncate font-medium">{tmpl.section_name}</span>
                  {generated && generated.status === "generated" && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  )}
                  {sv && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {Math.round(sv.completeness_pct)}%
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Draft history panel */}
        {draftHistory.length > 0 && (
          <div className="border-t shrink-0">
            <div className="px-3 py-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Draft History
              </p>
            </div>
            <div className="px-2 pb-2 space-y-0.5 max-h-36 overflow-y-auto">
              {draftHistory.map((draft, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{draft.label}</p>
                    <p className="text-[10px] text-muted-foreground">{draft.timestamp}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    title="Download this draft as PDF"
                    onClick={async () => {
                      try {
                        const sections = Array.from(draft.sections.values());
                        const blob = await downloadPdf({
                          user_id: userId,
                          sections,
                          company_name: projectName,
                        });
                        const safeName = projectName.replace(/[^a-z0-9]/gi, "_");
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${safeName}_${draft.label.replace(" ", "_")}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success(`${draft.label} downloaded`);
                      } catch (err: any) {
                        toast.error("Download failed", { description: err.message });
                      }
                    }}
                  >
                    <FileDown className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* No template selected yet */}
        {!currentTemplate && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5">
            {templates.length === 0 ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading templates…</p>
              </>
            ) : (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">IPO Draft Generator</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Generate all 29 IPO Draft sections from your uploaded documents.
                    Missing data is marked as placeholders for review.
                  </p>
                </div>
                <Button size="lg" onClick={() => handleGenerateAll(true)} disabled={isGeneratingAll || !userResolved}>
                  {isGeneratingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Generate Full Draft
                </Button>
              </>
            )}
          </div>
        )}

        {/* Section header */}
        {currentTemplate && (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold">{currentTemplate.section_name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {currentTemplate.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {currentGenerated && currentGenerated.status === "generated" && (
                  <>
                    <Badge variant="success" className="text-[10px]">
                      {Math.round(currentGenerated.confidence * 100)}% Confidence
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {currentGenerated.word_count} words
                    </Badge>
                  </>
                )}
                {currentValidation && (
                  <Badge
                    variant={getStatusBadge(currentValidation.status)}
                    className="text-[10px]"
                  >
                    {Math.round(currentValidation.completeness_pct)}% Complete
                  </Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 px-5 py-2 border-b shrink-0 bg-muted/30">
              {currentGenerated && currentGenerated.status === "generated" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateSection(activeSection, false)}
                  disabled={generatingSection === activeSection}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    handleGenerateSection(
                      activeSection,
                      currentValidation?.status === "missing"
                    )
                  }
                  disabled={generatingSection === activeSection}
                  className="h-7 text-xs"
                >
                  {generatingSection === activeSection ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Generate Section
                </Button>
              )}
              {currentValidation?.status === "missing" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateSection(activeSection, true)}
                  disabled={generatingSection === activeSection}
                  className="h-7 text-xs"
                >
                  Force Generate
                </Button>
              )}
            </div>

            {/* Content display */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                {generatingSection === activeSection ? (
                  <div className="flex flex-col items-center justify-center h-96 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="text-center">
                      <h3 className="text-base font-semibold">
                        Generating {currentTemplate.section_name}...
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI is analyzing your knowledge base
                      </p>
                    </div>
                  </div>
                ) : currentGenerated && currentGenerated.status === "generated" ? (
                  <div className="max-w-4xl mx-auto">
                    {currentGenerated.warnings.length > 0 && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="flex-1 text-xs">
                            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                              Warnings
                            </p>
                            <ul className="space-y-1 text-amber-600 dark:text-amber-500">
                              {currentGenerated.warnings.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {currentGenerated.content.split("\n\n").map((para, i) => {
                        if (para.trim().startsWith("## ")) {
                          return (
                            <h3 key={i} className="text-base font-semibold mt-6 mb-3">
                              {para.replace("## ", "")}
                            </h3>
                          );
                        }
                        if (para.trim().startsWith("### ")) {
                          return (
                            <h4 key={i} className="text-sm font-semibold mt-4 mb-2">
                              {para.replace("### ", "")}
                            </h4>
                          );
                        }
                        return (
                          <p key={i} className="text-sm leading-relaxed mb-3">
                            {para}
                          </p>
                        );
                      })}
                    </div>

                    {currentGenerated.missing_fields.length > 0 && (
                      <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                          Missing Required Fields
                        </h4>
                        <ul className="space-y-1 text-xs text-red-600 dark:text-red-500">
                          {currentGenerated.missing_fields.map((field, i) => (
                            <li key={i}>• {field}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : currentValidation?.status === "missing" ? (
                  <div className="flex flex-col items-center justify-center h-96 text-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">Required Data Missing</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        This section requires data that hasn't been extracted yet. Upload
                        relevant documents or use "Force Generate" to create with placeholders.
                      </p>
                    </div>
                    {currentValidation.missing_required.length > 0 && (
                      <div className="w-full max-w-md p-4 rounded-lg bg-muted text-left">
                        <p className="text-xs font-medium mb-2">Missing fields:</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {currentValidation.missing_required.slice(0, 5).map((field, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-red-500">•</span>
                              <span>{field.description}</span>
                            </li>
                          ))}
                          {currentValidation.missing_required.length > 5 && (
                            <li className="text-xs italic">
                              +{currentValidation.missing_required.length - 5} more...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-16">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                      <Sparkles className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Ready to Generate</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Click below to generate this section using your uploaded documents.
                        Missing fields will be marked as{" "}
                        <code className="text-xs bg-muted px-1 rounded">[Information Required]</code>.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        onClick={() => handleGenerateSection(activeSection, true)}
                        disabled={generatingSection === activeSection}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate This Section
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => handleGenerateAll(true)}
                        disabled={isGeneratingAll}
                      >
                        {isGeneratingAll ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                      Generate All 29 Sections
                      </Button>
                    </div>
                    {validation && (
                      <p className="text-xs text-muted-foreground">
                        Knowledge Base: {validation.available_knowledge_fields} fields available •{" "}
                        {validation.complete_sections} sections complete •{" "}
                        {validation.partial_sections} partial
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Right sidebar - Section info and sources */}
      <div className="w-72 border-l shrink-0 flex flex-col">
        <div className="p-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Section Details
          </p>
        </div>
        <ScrollArea className="flex-1 p-4">
          {currentTemplate && currentValidation && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium mb-2">Metadata</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order:</span>
                    <span className="font-medium">{currentTemplate.display_order}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Pages:</span>
                    <span className="font-medium">{currentTemplate.estimated_pages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={getStatusBadge(currentValidation.status)} className="text-[10px]">
                      {currentValidation.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {currentTemplate.sebi_reference && (
                <div>
                  <p className="text-xs font-medium mb-2">SEBI Reference</p>
                  <p className="text-xs text-muted-foreground">
                    {currentTemplate.sebi_reference}
                  </p>
                </div>
              )}

              {currentValidation.required_fields_total > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Data Availability</p>
                  <div className="mb-2">
                    <Progress
                      value={currentValidation.completeness_pct}
                      className="h-1.5"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentValidation.required_fields_present} of{" "}
                    {currentValidation.required_fields_total} required fields
                  </p>
                </div>
              )}

              {currentGenerated && currentGenerated.sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Source Documents</p>
                  <div className="space-y-2">
                    {currentGenerated.sources.slice(0, 5).map((src, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-muted/50 text-xs space-y-1"
                      >
                        <p className="font-medium truncate">
                          {src.document_name ?? src.document_id}
                        </p>
                        {src.page_number && (
                          <p className="text-muted-foreground">Page {src.page_number}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentGenerated && currentGenerated.status === "generated" && (
                <div>
                  <p className="text-xs font-medium mb-2">Generation Info</p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Model:</span>
                      <span className="font-medium">{currentGenerated.model_used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span className="font-medium">
                        {currentGenerated.generation_time_seconds.toFixed(1)}s
                      </span>
                    </div>
                    {currentGenerated.generated_at && (
                      <div className="flex justify-between">
                        <span>Generated:</span>
                        <span className="font-medium">
                          {new Date(currentGenerated.generated_at).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
