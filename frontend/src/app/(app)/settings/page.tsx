"use client";
import React, { useState } from "react";
import { User, Building2, KeyRound, Shield, Bell, Palette, CreditCard, Database, Lock, Trash2, Eye, EyeOff, Plus, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

const CURRENT_USER = { name: "User", email: "", designation: "", organization: "", phone: "" };

const API_KEYS = [
  { id: "ak-001", name: "Production API Key", key: "sk_live_ipoai_xxxxxxxxxxxxxxxxxxxxxxxx", created: "2025-11-01", lastUsed: "2026-07-10", status: "active" },
  { id: "ak-002", name: "Development API Key", key: "sk_test_ipoai_xxxxxxxxxxxxxxxxxxxxxxxx", created: "2025-11-15", lastUsed: "2026-07-08", status: "active" },
];

export default function SettingsPage() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState({
    emailDigest: true, validationAlerts: true, reviewNotifications: true, teamActivity: false, systemUpdates: true,
  });

  const copyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("API key copied");
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, organization, and platform preferences</p>
      </div>

      <Tabs defaultValue="profile" orientation="vertical" className="flex gap-6">
        <TabsList className="flex flex-col h-auto w-48 shrink-0 bg-transparent p-0 gap-0.5">
          {[
            { value: "profile",      icon: User,       label: "Profile" },
            { value: "organization", icon: Building2,   label: "Organization" },
            { value: "api-keys",     icon: KeyRound,    label: "API Keys" },
            { value: "security",     icon: Shield,      label: "Security" },
            { value: "notifications",icon: Bell,        label: "Notifications" },
            { value: "appearance",   icon: Palette,     label: "Appearance" },
            { value: "billing",      icon: CreditCard,  label: "Billing" },
            { value: "data",         icon: Database,    label: "Data & Privacy" },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger key={value} value={value} className="justify-start gap-2.5 px-3 py-2 text-sm w-full data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md">
              <Icon className="h-4 w-4" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 min-w-0">
          {/* Profile */}
          <TabsContent value="profile" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile Settings</CardTitle>
                <CardDescription>Update your personal information and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">{getInitials(CURRENT_USER.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">Change Photo</Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 2MB</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Full Name</Label><Input defaultValue={CURRENT_USER.name} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input defaultValue={CURRENT_USER.email} type="email" /></div>
                  <div className="space-y-1.5"><Label>Designation</Label><Input defaultValue={CURRENT_USER.designation} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input defaultValue={CURRENT_USER.phone} /></div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => toast.success("Profile updated")}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization */}
          <TabsContent value="organization" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organization</CardTitle>
                <CardDescription>Your organization details as registered with AUTODOC</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2"><Label>Organization Name</Label><Input defaultValue="" placeholder="Your organization name" /></div>
                  <div className="space-y-1.5"><Label>CIN</Label><Input defaultValue="" placeholder="CIN" /></div>
                  <div className="space-y-1.5"><Label>PAN</Label><Input defaultValue="" placeholder="PAN" /></div>
                  <div className="space-y-1.5"><Label>GSTIN</Label><Input defaultValue="" placeholder="GSTIN" /></div>
                  <div className="space-y-1.5"><Label>Industry</Label>
                    <Select defaultValue=""><SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pharmaceuticals">Pharmaceuticals</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    </SelectContent></Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => toast.success("Organization updated")}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys */}
          <TabsContent value="api-keys" className="mt-0">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="text-base">API Keys</CardTitle><CardDescription>Manage API access for integrations</CardDescription></div>
                <Button size="sm" onClick={() => toast.info("API key creation coming soon")}><Plus className="h-4 w-4" />New Key</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {API_KEYS.map((k) => (
                  <div key={k.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{k.name}</p>
                        <Badge variant="success" className="text-[10px]">{k.status}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">Revoke</Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-muted px-3 py-1.5 rounded border">
                        {showKey[k.id] ? k.key : k.key.slice(0,20) + "•".repeat(20)}
                      </code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowKey(p=>({...p,[k.id]:!p[k.id]}))}>
                        {showKey[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyKey(k.id, k.key)}>
                        {copied===k.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="flex gap-4 text-[11px] text-muted-foreground">
                      <span>Created: {k.created}</span>
                      <span>Last used: {k.lastUsed}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="mt-0 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5"><Label>Current Password</Label><Input type="password" placeholder="Enter current password" /></div>
                <div className="space-y-1.5"><Label>New Password</Label><Input type="password" placeholder="Min. 12 characters" /></div>
                <div className="space-y-1.5"><Label>Confirm New Password</Label><Input type="password" placeholder="Repeat new password" /></div>
                <Button onClick={() => toast.success("Password updated successfully")}>Update Password</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Two-Factor Authentication</CardTitle><CardDescription>Add an extra layer of security to your account</CardDescription></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Authenticator App</p>
                    <p className="text-xs text-muted-foreground">Use an authenticator app to generate one-time codes</p>
                  </div>
                  <Button variant="outline" size="sm">Enable 2FA</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="mt-0">
            <Card>
              <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "emailDigest" as const, label: "Daily Email Digest", desc: "Receive a daily summary of project activity" },
                  { key: "validationAlerts" as const, label: "Validation Alerts", desc: "Get notified when validation issues are found" },
                  { key: "reviewNotifications" as const, label: "Review Notifications", desc: "Notify when sections are approved or rejected" },
                  { key: "teamActivity" as const, label: "Team Activity", desc: "Notifications for team member actions" },
                  { key: "systemUpdates" as const, label: "System Updates", desc: "Platform updates and maintenance notices" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={notifSettings[key]}
                      onCheckedChange={(v) => { setNotifSettings(p=>({...p,[key]:v})); toast.success(`${label} ${v?"enabled":"disabled"}`); }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance */}
          <TabsContent value="appearance" className="mt-0">
            <Card>
              <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-3 block">Theme</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[{label:"Light",value:"light"},{label:"Dark",value:"dark"},{label:"System",value:"system"}].map(t=>(
                      <button key={t.value} className="p-3 rounded-lg border-2 border-primary/40 text-sm font-medium hover:border-primary transition-colors">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing" className="mt-0">
            <Card>
              <CardHeader><CardTitle className="text-base">Billing & Subscription</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Professional Plan</p>
                      <p className="text-xs text-muted-foreground mt-0.5">5 active projects · Unlimited documents · Full AI features</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">₹24,999</p>
                      <p className="text-xs text-muted-foreground">/month</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {[["Next billing date","—"],["Payment method","—"],["Billing email","—"]].map(([k,v])=>(
                    <div key={k} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Update Payment Method</Button>
                  <Button variant="outline" size="sm">Download Invoices</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data */}
          <TabsContent value="data" className="mt-0 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Data Export</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Export all your project data, documents metadata, and audit logs.</p>
                <Button variant="outline" size="sm">Export All Data</Button>
              </CardContent>
            </Card>
            <Card className="border-destructive/30">
              <CardHeader><CardTitle className="text-base text-destructive">Danger Zone</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div>
                    <p className="text-sm font-medium">Delete Account</p>
                    <p className="text-xs text-muted-foreground">Permanently delete your account and all associated data</p>
                  </div>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
