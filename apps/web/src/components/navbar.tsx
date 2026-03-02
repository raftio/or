"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { useWorkspace } from "./workspace-provider";
import { useAuth } from "./auth-provider";
import { useNavbarSlotContent } from "./navbar-slot-provider";

const routeLabels: Record<string, string> = {
  integration: "Integration",
  bundles: "Bundles",
  chat: "Chat",
  invite: "Invite",
};

const settingsPageLabels: Record<string, string> = {
  workspace: "Workspace",
  members: "Members",
  "api-tokens": "API Tokens",
  appearance: "Appearance",
};

function ChevronSeparator() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-base-text-muted/40"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface Crumb {
  href: string;
  label: string;
  isLast: boolean;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "settings" && segments.length >= 2) {
    const page = segments[1];
    const label = settingsPageLabels[page] ?? page;
    return [
      { href: "/settings/workspace", label: "Settings", isLast: false },
      { href: pathname, label, isLast: true },
    ];
  }

  return segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = routeLabels[seg] ?? seg;
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });
}

function Breadcrumb() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const crumbs = buildCrumbs(pathname);

  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      {crumbs.map((crumb, i) => (
        <div key={`${crumb.href}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ChevronSeparator />}
          {crumb.isLast ? (
            <span className="max-w-[160px] truncate font-medium text-base-text">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="max-w-[160px] truncate text-base-text-muted no-underline transition-colors hover:text-base-text hover:no-underline"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, switchWorkspace, refreshWorkspaces } =
    useWorkspace();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
        setError("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !token) return;
    setError("");
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    try {
      const res = await fetch(`${apiUrl}/v1/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create workspace");
        return;
      }
      const data = await res.json();
      await refreshWorkspaces();
      switchWorkspace(data.workspace.id);
      setCreating(false);
      setNewName("");
      setOpen(false);
    } catch {
      setError("Network error");
    }
  }, [newName, token, refreshWorkspaces, switchWorkspace]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[13px] font-medium text-base-text transition-colors hover:bg-primary/10"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-primary">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
        <span className="max-w-[140px] truncate">
          {activeWorkspace?.name ?? "Select workspace"}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-base-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-56 rounded-lg border border-base-border bg-surface shadow-lg">
          <div className="p-1.5">
            <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-base-text-muted">
              Workspaces
            </p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  switchWorkspace(ws.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                  ws.id === activeWorkspace?.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-base-text-muted hover:bg-primary/5 hover:text-base-text"
                }`}
              >
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.id === activeWorkspace?.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-base-border p-1.5">
            {creating ? (
              <div className="space-y-2 px-1">
                <input
                  type="text"
                  placeholder="Workspace name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                  className="w-full rounded-md border border-base-border bg-base px-2.5 py-1.5 text-[13px] text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
                />
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                      setError("");
                    }}
                    className="flex-1 rounded-md border border-base-border py-1.5 text-[12px] font-medium text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="flex-1 rounded-md bg-primary py-1.5 text-[12px] font-medium text-base transition-colors hover:bg-primary-hover"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const slotContent = useNavbarSlotContent();

  return (
    <nav className="z-40 w-full shrink-0 border-b border-base-border bg-surface-alt/80 backdrop-blur-sm">
      <div className="flex h-14 items-center px-5">
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-base-text no-underline hover:no-underline"
          >
            Orca
          </Link>

          <div className="h-5 w-px shrink-0 bg-base-border" />
          <WorkspaceSwitcher />

          {pathname !== "/" && (
            <>
              <div className="h-5 w-px shrink-0 bg-base-border" />
              <Breadcrumb />
            </>
          )}
        </div>

        {slotContent && (
          <>
            <div className="mx-3.5 h-5 w-px shrink-0 bg-base-border" />
            {slotContent}
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
