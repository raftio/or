"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-base-border bg-surface-alt backdrop-blur">
      <div className="flex h-14 items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-base-text no-underline hover:no-underline"
        >
          Orca
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
