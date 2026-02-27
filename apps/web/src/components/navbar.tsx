"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

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
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
