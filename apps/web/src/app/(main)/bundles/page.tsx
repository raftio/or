"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  spec_ref: string;
  ticket_ref: string;
  tasks: BundleTask[];
  acceptance_criteria_refs: string[];
  created_at: string;
  updated_at: string;
}

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

export default function BundlesPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchBundles = useCallback(async () => {
    if (!activeWorkspace || !token) return;
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("ticketRef", search.trim());
      const qs = params.toString();
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${activeWorkspace.id}/bundles${qs ? `?${qs}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setBundles(data.bundles ?? []);
        setTotal(data.total ?? data.bundles?.length ?? 0);
      }
    } catch {
      // keep current state
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, token, search]);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-base-text">Bundles</h1>
        <p className="mt-1 text-sm text-base-text-muted">
          Execution bundles for <strong>{activeWorkspace.name}</strong>.
        </p>
      </div>

      {/* Search / filter */}
      <div className="mt-6">
        <input
          type="text"
          placeholder="Filter by ticket ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
        />
      </div>

      {/* Bundle list */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-base-text">
          {loading ? "Loading…" : `${total} bundle${total !== 1 ? "s" : ""}`}
        </p>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-base-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
            Loading…
          </div>
        ) : bundles.length === 0 ? (
          <p className="mt-4 text-sm text-base-text-muted">
            {search.trim()
              ? "No bundles match this filter."
              : "No bundles yet."}
          </p>
        ) : (
          <div className="mt-3 divide-y divide-base-border rounded-lg border border-base-border">
            {bundles.map((b) => (
              <Link
                key={b.id}
                href={`/bundles/${b.id}`}
                className="flex items-center gap-4 px-4 py-3 no-underline transition-colors hover:bg-primary/5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-base-text">
                      {b.ticket_ref}
                    </p>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      v{b.version}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-base-text-muted">
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
