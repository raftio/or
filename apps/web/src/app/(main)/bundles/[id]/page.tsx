"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BundleTask {
  id: string;
  title: string;
  description?: string;
}

interface Dependency {
  taskId: string;
  dependsOn: string;
}

interface Bundle {
  id: string;
  version: number;
  spec_ref: string;
  ticket_ref: string;
  tasks: BundleTask[];
  dependencies?: Dependency[];
  acceptance_criteria_refs: string[];
  context?: {
    excerpts?: string[];
    related_ticket_ids?: string[];
  };
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

function dependencyLabel(dep: Dependency, tasks: BundleTask[]): string {
  const from = tasks.find((t) => t.id === dep.dependsOn);
  const to = tasks.find((t) => t.id === dep.taskId);
  return `${from?.title ?? dep.dependsOn} → ${to?.title ?? dep.taskId}`;
}

export default function BundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBundle = useCallback(async () => {
    if (!activeWorkspace || !token || !id) return;
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${activeWorkspace.id}/bundles/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setBundle(data);
      } else if (res.status === 404) {
        setError("Bundle not found.");
      } else {
        setError("Failed to load bundle.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, token, id]);

  useEffect(() => {
    fetchBundle();
  }, [fetchBundle]);

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-base-text-muted">No workspace selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center gap-2 text-sm text-base-text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
          Loading…
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/bundles" className="text-sm text-primary no-underline hover:underline">
          ← Back to bundles
        </Link>
        <p className="mt-4 text-sm text-red-400">{error || "Bundle not found."}</p>
      </div>
    );
  }

  const hasDeps = bundle.dependencies && bundle.dependencies.length > 0;
  const hasContext =
    bundle.context &&
    ((bundle.context.excerpts && bundle.context.excerpts.length > 0) ||
      (bundle.context.related_ticket_ids && bundle.context.related_ticket_ids.length > 0));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Back link */}
      <Link href="/bundles" className="text-sm text-primary no-underline hover:underline">
        ← Back to bundles
      </Link>

      {/* Header */}
      <div className="mt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-base-text">
            {bundle.ticket_ref}
          </h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            v{bundle.version}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-text-muted">
          {bundle.spec_ref && (
            <span>
              Spec: <code className="font-mono">{bundle.spec_ref}</code>
            </span>
          )}
          <span>Created {relativeTime(bundle.created_at)}</span>
          <span>Updated {relativeTime(bundle.updated_at)}</span>
          <span className="font-mono text-[10px] opacity-60">{bundle.id}</span>
        </div>
      </div>

      {/* Tasks */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-base-text">
          Tasks ({bundle.tasks.length})
        </h2>
        <div className="mt-3 space-y-3">
          {bundle.tasks.map((task, idx) => (
            <div
              key={task.id}
              className="rounded-xl border border-base-border bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-base-text">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 text-xs text-base-text-muted whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-base-text-muted opacity-60">
                    {task.id}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dependencies */}
      {hasDeps && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-base-text">
            Dependencies ({bundle.dependencies!.length})
          </h2>
          <div className="mt-3 space-y-2">
            {bundle.dependencies!.map((dep, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-base-border bg-surface px-4 py-2.5 text-sm text-base-text"
              >
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
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                <span>{dependencyLabel(dep, bundle.tasks)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Acceptance Criteria */}
      {bundle.acceptance_criteria_refs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-base-text">
            Acceptance Criteria ({bundle.acceptance_criteria_refs.length})
          </h2>
          <ul className="mt-3 space-y-1">
            {bundle.acceptance_criteria_refs.map((ref) => (
              <li
                key={ref}
                className="flex items-center gap-2 rounded-lg border border-base-border bg-surface px-4 py-2.5 text-sm text-base-text"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-green-400"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <code className="font-mono text-xs">{ref}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Context */}
      {hasContext && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-base-text">Context</h2>

          {bundle.context!.excerpts && bundle.context!.excerpts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-base-text-muted">Excerpts</p>
              <div className="mt-2 space-y-2">
                {bundle.context!.excerpts.map((excerpt, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-base-border bg-surface px-4 py-3 text-sm text-base-text whitespace-pre-wrap"
                  >
                    {excerpt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {bundle.context!.related_ticket_ids &&
            bundle.context!.related_ticket_ids.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-base-text-muted">Related Tickets</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bundle.context!.related_ticket_ids.map((tid) => (
                    <span
                      key={tid}
                      className="rounded-full border border-base-border bg-surface px-3 py-1 text-xs font-mono text-base-text"
                    >
                      {tid}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </section>
      )}
    </div>
  );
}
