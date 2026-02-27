"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/components/auth-provider";

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
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
