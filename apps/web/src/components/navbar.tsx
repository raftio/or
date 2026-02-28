"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Navbar() {
  return (
    <nav className="z-40 w-full shrink-0 border-b border-base-border bg-surface-alt/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-base-text no-underline hover:no-underline"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          Orca
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
