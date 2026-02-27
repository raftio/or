"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex h-14 items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900 no-underline hover:no-underline dark:text-zinc-100"
        >
          Orqestra
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white no-underline transition-colors hover:bg-blue-700 hover:no-underline dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
