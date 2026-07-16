"use client";
import React, { useState } from "react";
import { FileText, ExternalLink, BookOpen, Highlighter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DRAFT_SECTIONS } from "@/constants";
import { cn } from "@/lib/utils";

interface EvidenceSource {
  doc: string;
  page: number;
  excerpt: string;
  confidence: number;
}

interface EvidenceParagraph {
  id: string;
  text: string;
  sources: EvidenceSource[];
}

interface SectionEvidence {
  sectionCode: string;
  sectionTitle: string;
  paragraphs: EvidenceParagraph[];
}

// Will be populated from real API once backend generates draft sections
const EVIDENCE_DATA: SectionEvidence[] = [];

export default function EvidencePage() {
  const [activeSection, setActiveSection] = useState(DRAFT_SECTIONS[0]?.code ?? "");
  const [activePara, setActivePara] = useState<string | null>(null);

  const sectionData = EVIDENCE_DATA.find((e) => e.sectionCode === activeSection);
  const activeParagraph = sectionData?.paragraphs.find((p) => p.id === activePara);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence Viewer</h1>
        <p className="text-sm text-muted-foreground mt-1">Trace every paragraph in the draft back to its source documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 h-[calc(100vh-200px)]">
        {/* Section List */}
        <div className="border rounded-lg flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Draft Sections</p>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2 space-y-0.5">
              {DRAFT_SECTIONS.map((s) => (
                <button
                  key={s.code}
                  onClick={() => { setActiveSection(s.code); setActivePara(null); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors",
                    activeSection === s.code ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {s.title}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </div>

        {/* Paragraphs */}
        <div className="border rounded-lg flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {sectionData?.sectionTitle ?? DRAFT_SECTIONS.find(s => s.code === activeSection)?.title ?? "Section"}
            </p>
          </div>
          <ScrollArea className="flex-1 p-3">
            {sectionData?.paragraphs.length ? (
              <div className="space-y-2">
                {sectionData.paragraphs.map((para) => (
                  <button
                    key={para.id}
                    onClick={() => setActivePara(para.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-xs leading-relaxed transition-all",
                      activePara === para.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    <p className="line-clamp-4">{para.text}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {para.sources.length} source{para.sources.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs">No paragraphs yet. Generate this section in the Draft Generator first.</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Evidence Sources */}
        <div className="lg:col-span-2 border rounded-lg flex flex-col overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {activeParagraph ? `Evidence Sources (${activeParagraph.sources.length})` : "Evidence Sources"}
            </p>
            {activeParagraph && (
              <Badge variant="secondary" className="text-[10px]">
                Avg confidence: {Math.round(activeParagraph.sources.reduce((s, e) => s + e.confidence, 0) / activeParagraph.sources.length)}%
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1">
            {activeParagraph ? (
              <div className="p-4 space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Paragraph</p>
                  <p className="text-sm leading-relaxed">{activeParagraph.text}</p>
                </div>
                <Separator />
                <div className="space-y-3">
                  {activeParagraph.sources.map((src, i) => (
                    <div key={i} className="p-4 rounded-lg border space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{src.doc}</p>
                            <p className="text-xs text-muted-foreground">Page {src.page}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold">{src.confidence}%</p>
                            <p className="text-[10px] text-muted-foreground">confidence</p>
                          </div>
                          <Button variant="outline" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Highlighter className="h-3 w-3 text-amber-600" />
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Extracted text</span>
                        </div>
                        <p className="text-xs text-amber-900 dark:text-amber-200 italic leading-relaxed">"{src.excerpt}"</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full",
                              src.confidence >= 90 ? "bg-emerald-500" :
                              src.confidence >= 70 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${src.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{src.confidence}% match</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <BookOpen className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {sectionData
                    ? "Select a paragraph to see its evidence sources"
                    : "Generate draft sections to see evidence here"}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
