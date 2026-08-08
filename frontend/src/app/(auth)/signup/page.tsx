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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

const schema = z
  .object({
    full_name:        z.string().min(2, "Full name is required"),
    email:            z.string().email("Enter a valid email"),
    password:         z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
    specify_role:     z.boolean().optional(),
    role_text:        z.string().optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [specifyRole, setSpecifyRole]   = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const { error } = await signUp({
      email:     data.email,
      password:  data.password,
      full_name: data.full_name,
      // Store the free-text role as-is; backend defaults to "owner" if blank
      role_text: specifyRole ? (data.role_text?.trim() || undefined) : undefined,
    });

    if (error) {
      toast.error("Sign up failed", { description: error });
      return;
    }

    toast.success("Account created!", {
      description: "Check your email to verify your account.",
    });
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start preparing your SME IPO offer document today
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            placeholder="Your full name"
            autoComplete="name"
            {...register("full_name")}
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirm_password"
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat your password"
              autoComplete="new-password"
              {...register("confirm_password")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirm_password && (
            <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
          )}
        </div>

        {/* Optional professional role */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="specify_role"
              checked={specifyRole}
              onCheckedChange={(v) => setSpecifyRole(!!v)}
            />
            <Label
              htmlFor="specify_role"
              className="text-sm font-normal cursor-pointer leading-snug"
            >
              I want to specify my professional role{" "}
              <span className="text-muted-foreground">(Optional)</span>
            </Label>
          </div>

          {specifyRole && (
            <div className="pl-6 space-y-1.5">
              <Label htmlFor="role_text">Your Role</Label>
              <Input
                id="role_text"
                placeholder="e.g. Chartered Accountant, Legal Counsel…"
                autoComplete="organization-title"
                {...register("role_text")}
              />
              <p className="text-xs text-muted-foreground">
                Enter your job title or professional role — this is just for display.
              </p>
            </div>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our{" "}
          <Link href="#" className="underline">Terms of Service</Link> and{" "}
          <Link href="#" className="underline">Privacy Policy</Link>.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
