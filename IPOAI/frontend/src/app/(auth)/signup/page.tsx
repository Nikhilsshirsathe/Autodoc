"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  organization: z.string().min(2, "Organization name is required"),
  role: z.string().min(1, "Select a role"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    await new Promise(r => setTimeout(r, 1200));
    toast.success("Account created! Please verify your email.");
    router.push("/verify-otp");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start preparing your SME IPO offer document today</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" placeholder="Your full name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="organization">Company Name</Label>
          <Input id="organization" placeholder="Your company name" {...register("organization")} />
          {errors.organization && <p className="text-xs text-destructive">{errors.organization.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Your Role</Label>
          <Select value={role} onValueChange={(v) => { setRole(v); setValue("role", v); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Company Promoter / Management</SelectItem>
              <SelectItem value="analyst">IPO Analyst / CA</SelectItem>
              <SelectItem value="merchant_banker">Merchant Banker</SelectItem>
              <SelectItem value="legal">Legal Counsel</SelectItem>
              <SelectItem value="viewer">Advisor / Observer</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 12 characters"
              {...register("password")}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Create Account</span><ArrowRight className="h-4 w-4" /></>}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="#" className="underline">Terms of Service</Link> and{" "}
          <Link href="#" className="underline">Privacy Policy</Link>.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
