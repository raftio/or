"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BundleTask {
  id: string;
  title: string;
  description?: string;
}

interface Bundle {
  id: string;
  version: number;
  title: string;
  spec_ref: string;
  ticket_ref: string;
  status: "active" | "completed";
  tasks: BundleTask[];
  acceptance_criteria_refs: string[];
  created_at: string;
  updated_at: string;
}

type StatusTab = "active" | "completed";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function BundlesPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<StatusTab, number>>({ active: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("active");
  const debouncedSearch = useDebounce(search, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchBundles = useCallback(async () => {
    if (!activeWorkspace || !token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const base = `${apiUrl}/v1/workspaces/${activeWorkspace.id}/bundles`;
    const searchQ = debouncedSearch.trim();

    const buildParams = (status: StatusTab, limit?: number) => {
      const p = new URLSearchParams();
      p.set("status", status);
      if (searchQ) p.set("search", searchQ);
      if (limit !== undefined) p.set("limit", String(limit));
      return p;
    };

    try {
      const otherTab: StatusTab = activeTab === "active" ? "completed" : "active";
      const [mainRes, otherRes] = await Promise.all([
        fetch(`${base}?${buildParams(activeTab)}`, { headers }),
        fetch(`${base}?${buildParams(otherTab, 0)}`, { headers }),
      ]);

      if (mainRes.ok) {
        const data = await mainRes.json();
        setBundles(data.bundles ?? []);
        setTabCounts((prev) => ({ ...prev, [activeTab]: data.total ?? data.bundles?.length ?? 0 }));
      }
      if (otherRes.ok) {
        const data = await otherRes.json();
        setTabCounts((prev) => ({ ...prev, [otherTab]: data.total ?? 0 }));
      }
    } catch {
      // keep current state
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, token, activeTab, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchBundles();
  }, [fetchBundles]);

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-base-text-muted">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-text">Bundles</h1>
          <p className="mt-1 text-sm text-base-text-muted">
            Execution bundles for <strong>{activeWorkspace.name}</strong>.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-6 max-w-sm">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-text-muted"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search bundles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-base-border bg-base py-2 pl-9 pr-3 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
        />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-base-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-base-text"
                : "text-base-text-muted hover:text-base-text"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-xs ${
              activeTab === tab.key
                ? "bg-base-border text-base-text"
                : "bg-base-border/50 text-base-text-muted"
            }`}>
              {tabCounts[tab.key]}
            </span>
            {activeTab === tab.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Bundle list */}
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-base-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
            Loading…
          </div>
        ) : bundles.length === 0 ? (
          <p className="py-8 text-center text-sm text-base-text-muted">
            {debouncedSearch.trim()
              ? "No bundles match your search."
              : `No ${activeTab} bundles.`}
          </p>
        ) : (
          <div className="divide-y divide-base-border rounded-lg border border-base-border">
            {bundles.map((b) => (
              <Link
                key={b.id}
                href={`/bundles/${b.id}`}
                className="flex items-center gap-4 px-4 py-3 no-underline transition-colors hover:bg-primary/5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-base-text">
                      {b.title || b.ticket_ref}
                    </p>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      v{b.version}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-base-text-muted">
                    <span className="font-mono">{b.ticket_ref}</span>
                    {" · "}
                    {b.tasks.length} task{b.tasks.length !== 1 ? "s" : ""}
                    {b.spec_ref && (
                      <>
                        {" · "}
                        <span className="font-mono">{b.spec_ref}</span>
                      </>
                    )}
                    {" · "}
                    {relativeTime(b.created_at)}
                    {b.acceptance_criteria_refs.length > 0 && (
                      <>
                        {" · "}
                        {b.acceptance_criteria_refs.length} acceptance criteria
                      </>
                    )}
                  </p>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-base-text-muted"
                  aria-hidden
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
