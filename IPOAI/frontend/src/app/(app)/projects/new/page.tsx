"use client";
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, Sparkles, Loader2, Check, ChevronRight,
  RefreshCw, AlertCircle, X, Edit2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { INDUSTRIES, EXCHANGES } from "@/constants";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/supabase";
import { createProject } from "@/lib/data/projects";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Stage = "upload" | "extracting" | "review" | "creating";

interface ExtractedData {
  company_name: string;
  cin: string;
  pan: string;
  incorporation_date: string;
  registered_address: string;
  city: string;
  state: string;
  pincode: string;
  website: string;
  industry: string;
  exchange: string;
  ipo_size: string;
  face_value: string;
  issue_price: string;
  lot_size: string;
  target_filing_date: string;
  description: string;
}

const EMPTY: ExtractedData = {
  company_name: "", cin: "", pan: "", incorporation_date: "",
  registered_address: "", city: "", state: "", pincode: "", website: "",
  industry: "", exchange: "", ipo_size: "", face_value: "",
  issue_price: "", lot_size: "", target_filing_date: "", description: "",
};

export default function NewProjectPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [data, setData] = useState<ExtractedData>(EMPTY);
  const [editMode, setEditMode] = useState(false);

  // ── Upload & extract ──────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    maxFiles: 1,
  });

  const extract = async () => {
    if (!file) return;
    setStage("extracting");
    setProgress(10);
    setProgressLabel("Uploading document...");

    try {
      const user = await getCurrentUser();
      const userId = user?.id ?? "anon-dev-user";

      // Step 1: upload document
      const form = new FormData();
      form.append("file", file);
      form.append("user_id", userId);
      form.append("doc_type", "ipo_prospectus");
      form.append("auto_process", "false");

      setProgress(30);
      setProgressLabel("Uploading to server...");

      const uploadRes = await fetch(`${API_URL}/api/v1/documents/upload`, {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadedDoc = await uploadRes.json();

      setProgress(55);
      setProgressLabel("AI is reading the document...");

      // Step 2: trigger pipeline
      await fetch(`${API_URL}/api/v1/documents/${uploadedDoc.id}/process`, { method: "POST" });

      setProgress(75);
      setProgressLabel("Extracting company details...");

      // Step 3: poll for completion (max 30s)
      let extracted: any = null;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_URL}/api/v1/documents/${uploadedDoc.id}/status`);
        const status = await statusRes.json();
        if (status.status === "completed") {
          // Step 4: get extracted fields
          const fieldsRes = await fetch(`${API_URL}/api/v1/documents/${uploadedDoc.id}/fields`);
          const fieldsData = await fieldsRes.json();
          extracted = fieldsData.fields ?? [];
          break;
        }
        if (status.status === "failed") throw new Error(status.error_message ?? "Processing failed");
      }

      setProgress(95);
      setProgressLabel("Populating form...");

      // Map extracted fields to form data
      const mapped: ExtractedData = { ...EMPTY };
      if (Array.isArray(extracted)) {
        extracted.forEach((f: any) => {
          const key = f.field_name?.toLowerCase().replace(/\s+/g, "_");
          const val = f.field_value ?? "";
          if (key === "company_name" || key === "name")           mapped.company_name = val;
          else if (key === "cin")                                  mapped.cin = val;
          else if (key === "pan")                                  mapped.pan = val;
          else if (key === "incorporation_date" || key === "date_of_incorporation") mapped.incorporation_date = val;
          else if (key === "registered_address" || key === "address") mapped.registered_address = val;
          else if (key === "city")                                 mapped.city = val;
          else if (key === "state")                                mapped.state = val;
          else if (key === "pincode" || key === "pin_code")        mapped.pincode = val;
          else if (key === "website")                              mapped.website = val;
          else if (key === "industry")                             mapped.industry = val;
          else if (key === "description" || key === "business_description") mapped.description = val;
        });
      }

      setData(mapped);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      setStage("review");
      toast.success("Details extracted!", { description: "Review and edit before creating the project." });

    } catch (err: any) {
      toast.error("Extraction failed", { description: err.message ?? "Please fill in details manually." });
      setData(EMPTY);
      setStage("review");
      setEditMode(true);
    }
  };

  // ── Create project ────────────────────────────────────────────────────────
  const submit = async () => {
    if (!data.company_name) { toast.error("Company name is required"); return; }
    setStage("creating");
    try {
      const user = await getCurrentUser();
      const userId = user?.id ?? "anon-dev-user";
      await createProject(userId, {
        name: data.company_name,
        company_name: data.company_name,
        cin: data.cin || null,
        pan: data.pan || null,
        exchange: data.exchange || null,
        industry: data.industry || null,
        registered_address: data.registered_address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        website: data.website || null,
        incorporation_date: data.incorporation_date || null,
        ipo_size: data.ipo_size ? Number(data.ipo_size) : null,
        face_value: data.face_value ? Number(data.face_value) : null,
        issue_price: data.issue_price ? Number(data.issue_price) : null,
        lot_size: data.lot_size ? Number(data.lot_size) : null,
        target_filing_date: data.target_filing_date || null,
        description: data.description || null,
        status: "draft",
      });
      toast.success("Project created!");
      router.push("/projects");
    } catch (err: any) {
      toast.error("Failed to create project", { description: err.message });
      setStage("review");
    }
  };

  const field = (key: keyof ExtractedData, label: string, type = "text", className = "") => (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={data[key]}
        disabled={!editMode}
        onChange={(e) => setData((p) => ({ ...p, [key]: e.target.value }))}
        className={cn("h-8 text-sm", !editMode && "bg-muted/30")}
      />
    </div>
  );

  // ── STAGE: Upload ─────────────────────────────────────────────────────────
  if (stage === "upload") {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create New IPO Project</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your Certificate of Incorporation, MOA, or any company document — AI will extract the details automatically.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                {file ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium">Drop your document here</p>
                      <p className="text-xs text-muted-foreground mt-1">Certificate of Incorporation, MOA, AOA, or any company document</p>
                    </div>
                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG — up to 50MB</p>
                  </>
                )}
              </div>
            </div>

            {/* Supported docs */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Recommended documents for best extraction:</p>
              <div className="flex flex-wrap gap-2">
                {["Certificate of Incorporation", "MOA / AOA", "PAN Card", "GST Certificate", "Board Resolution"].map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                AI will extract: Company name, CIN, PAN, address, incorporation date, and more.
              </p>
              <Button onClick={extract} disabled={!file}>
                <Sparkles className="h-4 w-4" />Extract & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── STAGE: Extracting ─────────────────────────────────────────────────────
  if (stage === "extracting") {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Sparkles className="h-9 w-9 text-primary animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">Extracting details from document</h2>
          <p className="text-sm text-muted-foreground">{progressLabel}</p>
        </div>
        <div className="w-72 space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">{progress}%</p>
        </div>
      </div>
    );
  }

  // ── STAGE: Creating ───────────────────────────────────────────────────────
  if (stage === "creating") {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Creating your project...</p>
      </div>
    );
  }

  // ── STAGE: Review ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review Extracted Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI has extracted the following from <span className="font-medium">{file?.name ?? "your document"}</span>. Edit any incorrect fields.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditMode((e) => !e)}>
          <Edit2 className="h-3.5 w-3.5" />{editMode ? "Done Editing" : "Edit Fields"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {field("company_name", "Company Name *", "text", "col-span-2")}
          {field("cin", "CIN")}
          {field("pan", "PAN")}
          {field("incorporation_date", "Incorporation Date", "date")}
          {field("website", "Website")}
          {field("registered_address", "Registered Address", "text", "col-span-2")}
          {field("city", "City")}
          {field("state", "State")}
          {field("pincode", "Pincode")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Business & IPO Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Industry</Label>
            <Select
              value={data.industry}
              disabled={!editMode}
              onValueChange={(v) => setData((p) => ({ ...p, industry: v }))}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exchange</Label>
            <Select
              value={data.exchange}
              disabled={!editMode}
              onValueChange={(v) => setData((p) => ({ ...p, exchange: v }))}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select exchange" /></SelectTrigger>
              <SelectContent>{EXCHANGES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {field("ipo_size", "IPO Size (₹ Cr)", "number")}
          {field("face_value", "Face Value (₹)", "number")}
          {field("issue_price", "Issue Price (₹)", "number")}
          {field("lot_size", "Lot Size (shares)", "number")}
          {field("target_filing_date", "Target Filing Date", "date")}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => { setStage("upload"); setFile(null); setData(EMPTY); }}>
          <RefreshCw className="h-4 w-4" />Upload Different Document
        </Button>
        <Button onClick={submit} disabled={!data.company_name}>
          <Check className="h-4 w-4" />Create Project
        </Button>
      </div>
    </div>
  );
}
