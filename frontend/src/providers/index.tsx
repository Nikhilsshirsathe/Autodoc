"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import { ProjectProvider } from "@/context/project-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
    >
      <AuthProvider>
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "bg-card border border-border text-foreground shadow-lg",
            title: "text-foreground font-medium text-sm",
            description: "text-muted-foreground text-xs",
            actionButton: "bg-primary text-primary-foreground",
            cancelButton: "bg-muted text-muted-foreground",
            closeButton: "bg-card border-border",
          },
        }}
      />
    </NextThemesProvider>
  );
}
