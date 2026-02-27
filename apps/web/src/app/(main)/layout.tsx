"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceProvider } from "@/components/workspace-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrated, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace("/login");
    }
  }, [hydrated, isLoggedIn, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-base-border border-t-primary" />
          <span className="text-sm font-medium text-base-text-muted">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <Navbar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
