"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Search, Database, Building2, Users, TrendingUp, Shield, Gavel, Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listDocuments, getExtractedFields, type ApiDocument, type ExtractedField } from "@/lib/data/documents";
import { getCurrentUser } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Group field names into categories
function categorizeField(name: string): string {
  const n = name.toLowerCase();
  if (["company_name", "cin", "pan", "gstin", "incorporation_date", "registered_address", "website", "company_type"].some((k) => n.includes(k))) return "company";
  if (["director", "din", "designation", "appointment"].some((k) => n.includes(k))) return "directors";
  if (["revenue", "profit", "ebitda", "pat", "eps", "roe", "net_worth", "total_assets", "debt"].some((k) => n.includes(k))) return "financials";
  if (["share", "promoter", "equity", "holding", "lot_size"].some((k) => n.includes(k))) return "shareholding";
  if (["license", "gst", "tax", "compliance", "filing", "audit"].some((k) => n.includes(k))) return "compliance";
  if (["litigation", "legal", "court", "case", "dispute"].some((k) => n.includes(k))) return "litigation";
  return "company";
}

export default function KnowledgeBasePage() {
  const [userId, setUserId] = useState("anon-dev-user");
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [allFields, setAllFields] = useState<(ExtractedField & { docName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getCurrentUser().then((u) => { if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  // Load completed documents
  useEffect(() => {
    listDocuments(userId)
      .then((data) => {
        const completed = data.filter((d) => d.status === "completed");
        setDocs(completed);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  // Load fields whenever doc selection or docs change
  const loadFields = useCallback(async () => {
    if (docs.length === 0) return;
    setLoadingFields(true);
    try {
      const docsToFetch = selectedDocId === "all" ? docs : docs.filter((d) => d.id === selectedDocId);
      const results = await Promise.all(
        docsToFetch.map(async (doc) => {
          const fields = await getExtractedFields(doc.id);
          return fields.map((f) => ({ ...f, docName: doc.original_name }));
        })
      );
      setAllFields(results.flat());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFields(false);
    }
  }, [docs, selectedDocId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  // Filter by search
  const filtered = allFields.filter((f) => {
    if (!search) return true;
    return (
      f.field_name.toLowerCase().includes(search.toLowerCase()) ||
      f.field_value.toLowerCase().includes(search.toLowerCase())
    );
  });

  const byCategory = (cat: string) => filtered.filter((f) => categorizeField(f.field_name) === cat);

  const FieldTable = ({ fields }: { fields: (ExtractedField & { docName: string })[] }) => (
    fields.length === 0 ? (
      <div className="py-10 text-center text-muted-foreground">
        <Database className="h-8 w-8 opacity-30 mx-auto mb-2" />
        <p className="text-sm">No data extracted yet.</p>
        <p className="text-xs mt-1">Upload and process documents to populate this section.</p>
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="text-xs font-medium capitalize">{f.field_name.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-xs">{f.field_value}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{f.docName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(f.confidence * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{Math.round(f.confidence * 100)}%</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extracted and structured data from your uploaded documents
            {allFields.length > 0 && ` — ${allFields.length} fields extracted`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDocId} onValueChange={setSelectedDocId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="All Documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Documents</SelectItem>
              {docs.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.original_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search fields..." className="pl-8 h-8 w-48 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading documents…</span>
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm">No processed documents yet.</p>
            <p className="text-xs mt-1">Upload and process documents to build your knowledge base.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="company">
          <TabsList className="h-9">
            <TabsTrigger value="company"    className="gap-1.5"><Building2  className="h-3.5 w-3.5" />Company ({byCategory("company").length})</TabsTrigger>
            <TabsTrigger value="directors"  className="gap-1.5"><Users      className="h-3.5 w-3.5" />Directors ({byCategory("directors").length})</TabsTrigger>
            <TabsTrigger value="financials" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Financials ({byCategory("financials").length})</TabsTrigger>
            <TabsTrigger value="shareholding" className="gap-1.5"><Database className="h-3.5 w-3.5" />Shareholding ({byCategory("shareholding").length})</TabsTrigger>
            <TabsTrigger value="compliance" className="gap-1.5"><Shield    className="h-3.5 w-3.5" />Compliance ({byCategory("compliance").length})</TabsTrigger>
            <TabsTrigger value="litigation" className="gap-1.5"><Gavel     className="h-3.5 w-3.5" />Litigation ({byCategory("litigation").length})</TabsTrigger>
          </TabsList>

          {loadingFields ? (
            <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading fields...</span>
            </div>
          ) : (
            <>
              {["company", "directors", "financials", "shareholding", "compliance", "litigation"].map((cat) => (
                <TabsContent key={cat} value={cat} className="mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm capitalize">{cat} Data</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pb-4">
                      <FieldTable fields={byCategory(cat)} />
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </>
          )}
        </Tabs>
      )}
    </div>
  );
}
