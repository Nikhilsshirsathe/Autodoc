"use client";
import React, { useState } from "react";
import { Download, Search, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, getInitials, cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  severity: "high" | "medium" | "low";
  timestamp: string;
}

export default function AuditLogsPage() {
  const [logs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");

  const filtered = logs.filter(l => {
    const mS = l.userName.toLowerCase().includes(search.toLowerCase())
      || l.action.toLowerCase().includes(search.toLowerCase())
      || l.details.toLowerCase().includes(search.toLowerCase());
    const mSev = severity === "all" || l.severity === severity;
    return mS && mSev;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">{logs.length} events recorded</p>
        </div>
        <Button variant="outline" size="sm" disabled={logs.length === 0}><Download className="h-4 w-4" />Export Logs</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events",    value: logs.length,                                color: "text-foreground" },
          { label: "High Severity",   value: logs.filter(l => l.severity === "high").length,   color: "text-red-600" },
          { label: "Medium Severity", value: logs.filter(l => l.severity === "medium").length, color: "text-amber-600" },
          { label: "Low Severity",    value: logs.filter(l => l.severity === "low").length,    color: "text-emerald-600" },
        ].map(s => (
          <Card key={s.label}><div className="p-4">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search logs..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <Card>
          <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm">No audit events recorded yet.</p>
            <p className="text-xs">Activity will appear here as users interact with the platform.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    <div>
                      <p className="text-xs font-medium">{formatDate(log.timestamp, "short")}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px]">{getInitials(log.userName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{log.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{log.action}</code>
                  </TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{log.resource}</span></TableCell>
                  <TableCell className="max-w-[250px]">
                    <p className="text-xs text-muted-foreground truncate">{log.details}</p>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground font-mono">{log.ipAddress}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.severity === "high" ? "critical" : log.severity === "medium" ? "warning" : "secondary"} className="text-[10px]">
                      {log.severity}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
