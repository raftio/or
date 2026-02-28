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

interface Evidence {
  id: string;
  repo: string;
  branch?: string;
  commit_sha?: string;
  pr_id?: string;
  ticket_id: string;
  test_results: { pass: number; fail: number; skip?: number };
  coverage?: { line_pct?: number; branch_pct?: number };
  ci_status: "success" | "failure" | "cancelled";
  lifecycle: "created" | "validated" | "linked";
  timestamp: string;
  created_at: string;
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
  const [history, setHistory] = useState<Bundle[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
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
        const data: Bundle = await res.json();
        setBundle(data);

        const [histRes, evRes] = await Promise.all([
          fetch(
            `${apiUrl}/v1/workspaces/${activeWorkspace.id}/bundles/${encodeURIComponent(data.ticket_ref)}/history`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
          fetch(
            `${apiUrl}/v1/workspaces/${activeWorkspace.id}/evidence?ticketId=${encodeURIComponent(data.ticket_ref)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ]);
        if (histRes.ok) {
          const histData = await histRes.json();
          setHistory(histData.bundles ?? []);
        }
        if (evRes.ok) {
          const evData = await evRes.json();
          setEvidence(evData.evidence ?? []);
        }
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

      {/* Version history */}
      {history.length > 1 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-base-text">
            Versions ({history.length})
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {history.map((h) => (
              <Link
                key={h.id}
                href={`/bundles/${h.id}`}
                className={`rounded-full px-3 py-1 text-xs font-medium no-underline transition-colors ${
                  h.id === bundle.id
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                v{h.version}
              </Link>
            ))}
          </div>
        </section>
      )}

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

      {/* Evidence */}
      {evidence.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-base-text">
            Evidence ({evidence.length})
          </h2>
          <div className="mt-3 space-y-3">
            {evidence.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-base-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Source info */}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-base-text">
                      <code className="font-mono text-xs">{ev.repo}</code>
                      {ev.branch && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono text-primary">
                          {ev.branch}
                        </span>
                      )}
                      {ev.commit_sha && (
                        <code className="font-mono text-[10px] text-base-text-muted">
                          {ev.commit_sha.slice(0, 7)}
                        </code>
                      )}
                      {ev.pr_id && (
                        <span className="text-xs text-base-text-muted">
                          PR #{ev.pr_id}
                        </span>
                      )}
                    </div>

                    {/* Test results */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-green-500 font-medium">
                        {ev.test_results.pass} passed
                      </span>
                      <span className="text-red-400 font-medium">
                        {ev.test_results.fail} failed
                      </span>
                      {ev.test_results.skip != null && ev.test_results.skip > 0 && (
                        <span className="text-base-text-muted">
                          {ev.test_results.skip} skipped
                        </span>
                      )}
                      {ev.coverage && (
                        <>
                          {ev.coverage.line_pct != null && (
                            <span className="text-base-text-muted">
                              {ev.coverage.line_pct}% line cov
                            </span>
                          )}
                          {ev.coverage.branch_pct != null && (
                            <span className="text-base-text-muted">
                              {ev.coverage.branch_pct}% branch cov
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Timestamp */}
                    <p className="text-[10px] text-base-text-muted opacity-60">
                      {relativeTime(ev.created_at)}
                    </p>
                  </div>

                  {/* Status badges */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ev.ci_status === "success"
                          ? "bg-green-500/10 text-green-500"
                          : ev.ci_status === "failure"
                            ? "bg-red-400/10 text-red-400"
                            : "bg-amber-400/10 text-amber-400"
                      }`}
                    >
                      {ev.ci_status}
                    </span>
                    <span className="rounded-full bg-base-border/40 px-2 py-0.5 text-[10px] text-base-text-muted">
                      {ev.lifecycle}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
