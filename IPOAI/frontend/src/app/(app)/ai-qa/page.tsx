"use client";
import React, { useState } from "react";
import { MessageSquare, Send, RefreshCw, CheckCircle2, SkipForward, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type QuestionStatus = "pending" | "answered" | "skipped";

interface AIQuestion {
  id: string;
  question: string;
  category: string;
  reason: string;
  sectionReference: string;
  isRequired: boolean;
  suggestedAnswers: string[];
  status: QuestionStatus;
  userResponse?: string;
  confidence?: number;
}

export default function AIQAPage() {
  const [questions] = useState<AIQuestion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const answered = questions.filter(q => q.status === "answered").length;
  const total = questions.length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Follow-up Questions</h1>
          <p className="text-sm text-muted-foreground mt-1">Answer questions to help AI generate accurate offer document sections</p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{answered}/{total} answered</span>
            <Progress value={total > 0 ? (answered / total) * 100 : 0} className="w-24 h-2" />
          </div>
        )}
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No questions generated yet.</p>
            <p className="text-xs mt-1">Process documents and generate a draft to see AI questions here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Question List */}
          <div className="space-y-2">
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveId(q.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  activeId === q.id ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                  q.status === "answered" ? "opacity-70" : ""
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0",
                    q.status === "answered" ? "bg-emerald-500" :
                    q.status === "skipped"  ? "bg-zinc-400" :
                    q.isRequired            ? "bg-red-500" : "bg-amber-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-2 leading-tight">{q.question}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground">{q.category}</span>
                      {q.isRequired && <Badge variant="critical" className="text-[9px] px-1">Required</Badge>}
                      {q.status !== "pending" && <Badge variant={q.status === "answered" ? "success" : "secondary"} className="text-[9px] px-1">{q.status}</Badge>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Active Question */}
          <div className="lg:col-span-2">
            {(() => {
              const q = questions.find(x => x.id === activeId);
              if (!q) return null;
              return (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{q.category}</span>
                        {q.isRequired && <Badge variant="critical" className="text-[9px] ml-2">Required</Badge>}
                        <p className="text-[11px] text-muted-foreground">References: {q.sectionReference}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold leading-relaxed">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-2 p-3 rounded-lg bg-muted/50 leading-relaxed">
                        <span className="font-medium text-foreground">Why this matters: </span>{q.reason}
                      </p>
                    </div>
                    {q.suggestedAnswers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2">Suggested answers</p>
                        <div className="space-y-1.5">
                          {q.suggestedAnswers.map((s, i) => (
                            <button key={i} className="w-full text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors"
                              onClick={() => setResponses(p => ({ ...p, [q.id]: s }))}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {q.status === "answered" ? (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2 mb-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Answered</span>
                          {q.confidence && <span className="text-[10px] text-emerald-600 ml-auto">{q.confidence}% confidence</span>}
                        </div>
                        <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{q.userResponse}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea placeholder="Type your answer..." rows={4} value={responses[q.id] ?? ""} onChange={(e) => setResponses(p => ({ ...p, [q.id]: e.target.value }))} className="text-sm" />
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="text-xs gap-1"><SkipForward className="h-3.5 w-3.5" />Skip</Button>
                          <Button size="sm" className="gap-1" disabled={!responses[q.id]?.trim()}><Send className="h-3.5 w-3.5" />Submit</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
