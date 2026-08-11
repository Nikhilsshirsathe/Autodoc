// TODO: Wire to real API — currently uses empty data
// @ts-nocheck
"use client";
import React, { useState, useMemo } from "react";
import { UserPlus, Mail, Shield, Trash2, Crown, Eye, Edit, Users, Link2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
// projects loaded via API — no dummy data
import { USER_ROLE_CONFIG } from "@/constants";
import { formatDate, getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRole } from "@/types";

const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  admin: Crown, owner: Crown, analyst: Edit, merchant_banker: Shield, legal: Shield, viewer: Eye,
};

export default function CollaborationPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("analyst");
  const [copied, setCopied] = useState(false);
  const project = null;
  const [members, setMembers] = useState<any[]>([]);

  // Generate a deterministic-looking invite link based on role
  const shareLink = useMemo(() => {
    const token = btoa(`invite:${inviteRole}:${Date.now()}`).replace(/=/g, "").slice(0, 24);
    return `${window.location.origin}/invite/${token}`;
  }, [inviteRole, inviteOpen]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied to clipboard");
    });
  };

  const sendInvite = () => {
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteOpen(false);
    setInviteEmail("");
  };

  const removeMember = (id: string) => {
    setMembers(p => p.filter(m => m.id !== id));
    toast.success("Member removed");
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Collaboration</h1>
          <p className="text-sm text-muted-foreground mt-1">{project?.companyName ?? "No active project"} · {members.length} members</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" />Invite Member
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Members List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Team Members</CardTitle>
              <CardDescription className="text-xs">Manage access and permissions for this project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((m) => {
                const roleCfg = USER_ROLE_CONFIG[m.role];
                const Icon = ROLE_ICONS[m.role];
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-sm bg-primary/10 text-primary">{getInitials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{m.name}</p>
                        {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{roleCfg.label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground hidden md:block">Added {formatDate(m.addedAt, "relative")}</span>
                      {m.role !== "owner" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeMember(m.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Roles Reference */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Role Permissions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(USER_ROLE_CONFIG) as [UserRole, {label: string; description: string}][]).map(([role, cfg]) => {
                const Icon = ROLE_ICONS[role];
                return (
                  <div key={role} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{cfg.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{cfg.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm">Email Address</Label>
              <Input
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="focus-visible:ring-0 focus-visible:border-muted-foreground/40 w-full"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-sm">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger className="focus:ring-0 w-full truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(USER_ROLE_CONFIG) as [UserRole, { label: string; description: string }][])
                    .filter(([r]) => r !== "admin" && r !== "owner")
                    .map(([role, cfg]) => (
                      <SelectItem key={role} value={role}>
                        <span className="font-medium">{cfg.label}</span>
                        <span className="text-muted-foreground ml-1 text-xs">— {cfg.description}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Divider */}
            <Separator />

            {/* Share link */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Or share an invite link</p>
              <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-2 flex-1 bg-muted/40 px-3 py-2 overflow-hidden">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate block w-0 flex-1">{shareLink}</span>
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 border-l border-border transition-colors shrink-0 text-foreground"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-green-500" />Copied!</>
                    : <><Copy className="h-3.5 w-3.5" />Copy</>
                  }
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Invitee joins as{" "}
                <span className="font-semibold text-foreground">{USER_ROLE_CONFIG[inviteRole]?.label}</span>.
                {" "}Expires in 7 days.
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={sendInvite} disabled={!inviteEmail.trim()}>
              <Mail className="h-4 w-4" />Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
