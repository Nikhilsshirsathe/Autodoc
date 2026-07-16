"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  password: z.string().min(12, "Password must be at least 12 characters"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });
type FormData = z.infer<typeof schema>;

const requirements = [
  { label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { label: "One uppercase letter",   test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number",             test: (p: string) => /\d/.test(p) },
  { label: "One special character",  test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async () => {
    await new Promise(r => setTimeout(r, 1000));
    toast.success("Password reset successfully!");
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">Your new password must be different from your previous passwords.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              placeholder="Min. 12 characters"
              {...register("password")}
              onChange={e => { setPassword(e.target.value); }}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          {/* Password strength */}
          <div className="space-y-1.5 mt-2">
            {requirements.map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <CheckCircle2 className={`h-3.5 w-3.5 ${r.test(password) ? "text-emerald-500" : "text-muted-foreground/30"}`} />
                <span className={`text-xs ${r.test(password) ? "text-foreground" : "text-muted-foreground"}`}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat new password"
              {...register("confirm")}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="text-foreground font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
