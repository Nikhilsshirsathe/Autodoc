"use client";
import React, { useState } from "react";
import { CheckCircle2, XCircle, MessageSquare, Send, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatDate, getInitials, cn } from "@/lib/utils";

type ReviewStatus = "pending" | "approved" | "rejected" | "revision_requested";

interface ReviewComment {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface Review {
  id: string;
  sectionTitle: string;
  reviewerName: string;
  dueDate: string;
  status: ReviewStatus;
  comments: ReviewComment[];
}

export default function BankerReviewPage() {
  const [reviews] = useState<Review[]>([]);
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const review = reviews.find(r => r.id === activeReview) ?? null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Merchant Banker Review</h1>
          <p className="text-sm text-muted-foreground mt-1">Review, comment, and approve offer document sections</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Review",     value: reviews.filter(r => r.status === "pending").length,            color: "text-amber-600" },
          { label: "Revision Requested", value: reviews.filter(r => r.status === "revision_requested").length, color: "text-orange-600" },
          { label: "Approved",           value: reviews.filter(r => r.status === "approved").length,           color: "text-emerald-600" },
          { label: "Rejected",           value: reviews.filter(r => r.status === "rejected").length,           color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No reviews yet.</p>
            <p className="text-xs mt-1">Generate a draft document to start the review process.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Review List */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Reviews ({reviews.length})</p>
            {reviews.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveReview(r.id)}
                className={cn("w-full text-left p-3 rounded-lg border transition-all", activeReview === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/30")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.sectionTitle}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.reviewerName}</p>
                  </div>
                  <Badge variant={r.status === "approved" ? "success" : r.status === "rejected" ? "destructive" : r.status === "revision_requested" ? "warning" : "secondary"} className="text-[9px] shrink-0">
                    {r.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-muted-foreground">{r.comments.length} comment{r.comments.length !== 1 ? "s" : ""}</span>
                  <span className="text-[11px] text-muted-foreground">Due {formatDate(r.dueDate)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Review Detail */}
          <div className="lg:col-span-2">
            {review && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{review.sectionTitle}</CardTitle>
                  <CardDescription className="text-xs">Reviewer: {review.reviewerName} · Due {formatDate(review.dueDate)}</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4 space-y-4">
                  {review.comments.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No comments yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {review.comments.map((c) => (
                        <div key={c.id} className="flex items-start gap-3">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-[10px]">{getInitials(c.authorName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">{c.authorName}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt, "relative")}</span>
                            </div>
                            <p className="text-sm mt-1">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Separator />
                  <div className="space-y-2">
                    <Textarea placeholder="Add a comment..." rows={3} value={newComment} onChange={(e) => setNewComment(e.target.value)} className="text-sm resize-none" />
                    <div className="flex justify-end">
                      <Button size="sm" disabled={!newComment.trim()}><Send className="h-3.5 w-3.5" />Add Comment</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
