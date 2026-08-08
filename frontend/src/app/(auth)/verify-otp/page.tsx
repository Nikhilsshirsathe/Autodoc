"use client";
import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VerifyOTPPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const updated = [...otp];
    digits.split("").forEach((d, i) => { updated[i] = d; });
    setOtp(updated);
    inputs.current[Math.min(digits.length, 5)]?.focus();
  };

  const verify = async () => {
    const code = otp.join("");
    if (code.length < 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    toast.success("Email verified!");
    router.push("/dashboard");
  };

  const resend = () => {
    toast.success("New code sent!");
    setResendCooldown(60);
    const iv = setInterval(() => {
      setResendCooldown(c => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
    }, 1000);
  };

  const filled = otp.every(d => d !== "");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />Back to sign in
        </Link>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We sent a 6-digit code to your email address
        </p>
      </div>

      <div>
        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <Input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              maxLength={1}
              className={cn(
                "h-12 w-12 text-center text-lg font-bold p-0",
                digit && "border-primary ring-1 ring-primary"
              )}
              inputMode="numeric"
              autoFocus={i === 0}
            />
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={verify} disabled={!filled || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Email"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t receive the code?{" "}
        {resendCooldown > 0 ? (
          <span className="text-muted-foreground">Resend in {resendCooldown}s</span>
        ) : (
          <button onClick={resend} className="text-foreground font-medium hover:underline">Resend code</button>
        )}
      </p>
    </div>
  );
}
