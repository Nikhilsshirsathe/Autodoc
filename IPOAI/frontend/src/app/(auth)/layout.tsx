export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[480px] shrink-0 flex-col bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2.5 mb-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20">
            <span className="text-sm font-bold">IP</span>
          </div>
          <span className="text-lg font-semibold">IPOAI</span>
        </div>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold leading-tight">Prepare your SEBI SME IPO with confidence.</h1>
            <p className="mt-4 text-primary-foreground/70 leading-relaxed">IPOAI automates offer document preparation using AI — from document classification to DRHP draft generation.</p>
          </div>
          <div className="space-y-3">
            {[
              "AI-powered document classification",
              "Automated validation against SEBI guidelines",
              "DRHP draft generation with evidence tracing",
              "Merchant banker review workflow",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60 shrink-0" />
                <span className="text-sm text-primary-foreground/80">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto pt-8">
          <p className="text-xs text-primary-foreground/40">Trusted by 50+ SMEs preparing for IPO on NSE Emerge and BSE SME platforms.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
