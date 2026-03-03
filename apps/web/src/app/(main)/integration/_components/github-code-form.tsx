"use client";

import { useCallback, useEffect, useState } from "react";
import { Field } from "./field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface GitHubCodeIntegration {
  id: string;
  provider: "github_code";
  config: {
    owner: string;
    repos?: string[];
    repo?: string;
    access_token: string;
  };
  created_at: string;
  updated_at: string;
}

interface IndexStatus {
  repo: string;
  status: "pending" | "indexing" | "ready" | "failed";
  total_files: number;
  indexed_files: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface RepoInfo {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  description: string | null;
}

interface GitHubCodeFormProps {
  workspaceId: string;
  token: string;
  integration: GitHubCodeIntegration | null;
  isAdmin: boolean;
  onUpdate: () => void;
}

function getConfiguredRepos(integration: GitHubCodeIntegration | null): string[] {
  if (!integration) return [];
  if (Array.isArray(integration.config.repos)) return integration.config.repos;
  if (integration.config.repo) return [integration.config.repo];
  return [];
}

export function GitHubCodeForm({
  workspaceId,
  token,
  integration,
  isAdmin,
  onUpdate,
}: GitHubCodeFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [owner, setOwner] = useState(integration?.config.owner ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    () => new Set(getConfiguredRepos(integration)),
  );

  const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
  const [repoFilter, setRepoFilter] = useState("");

  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [indexStatuses, setIndexStatuses] = useState<IndexStatus[]>([]);

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const base = `${apiUrl}/v1/workspaces/${workspaceId}/integrations/github-code`;

  // ── Fetch index status on mount and when integration changes ──────────

  const fetchStatus = useCallback(async () => {
    if (!integration) return;
    try {
      const res = await fetch(`${base}/status`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      setIndexStatuses(data.indexes ?? []);
    } catch {
      /* ignore */
    }
  }, [integration, base, headers]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Poll while any repo is indexing ─────────────────────────────────

  useEffect(() => {
    if (!indexStatuses.some((s) => s.status === "indexing")) return;
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [indexStatuses, fetchStatus]);

  // ── Load available repos ────────────────────────────────────────────

  const handleLoadRepos = useCallback(async () => {
    setLoadingRepos(true);
    setError("");
    try {
      const effectiveToken = accessToken || undefined;
      const params = new URLSearchParams();
      if (owner) params.set("owner", owner);
      if (effectiveToken) params.set("access_token", effectiveToken);

      const res = await fetch(`${base}/repos?${params.toString()}`, {
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load repositories");
        return;
      }
      setAvailableRepos(data.repos ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoadingRepos(false);
    }
  }, [base, owner, accessToken, headers]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await fetch(`${base}/test`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          owner,
          access_token: accessToken || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `Connected to ${data.owner} (${data.repoCount} repos accessible)`,
        });
      } else {
        setTestResult({ ok: false, message: data.error || "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  }, [base, owner, accessToken, headers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const repos = Array.from(selectedRepos);
      if (repos.length === 0) {
        setError("Select at least one repository");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = { owner, repos };

      if (accessToken) {
        body.access_token = accessToken;
      } else if (integration) {
        setError("Enter access token to update the configuration");
        setSaving(false);
        return;
      } else {
        setError("Access token is required");
        setSaving(false);
        return;
      }

      const res = await fetch(base, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      setAccessToken("");
      onUpdate();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }, [base, owner, selectedRepos, accessToken, integration, headers, onUpdate]);

  const handleIndex = useCallback(async (force?: boolean, repo?: string) => {
    setIndexing(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (force) params.set("force", "true");
      if (repo) params.set("repo", repo);
      const qs = params.toString();
      const url = qs ? `${base}/index?${qs}` : `${base}/index`;
      const res = await fetch(url, {
        method: "POST",
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start indexing");
        return;
      }
      const repos: string[] = data.repos ?? [];
      if (repo) {
        setIndexStatuses((prev) =>
          prev.map((s) =>
            repos.includes(s.repo)
              ? { ...s, status: "indexing", error: null, started_at: new Date().toISOString(), completed_at: null }
              : s,
          ),
        );
      } else {
        setIndexStatuses(
          repos.map((r) => ({
            repo: r,
            status: "indexing",
            total_files: 0,
            indexed_files: 0,
            error: null,
            started_at: new Date().toISOString(),
            completed_at: null,
          })),
        );
      }
    } catch {
      setError("Network error");
    } finally {
      setIndexing(false);
    }
  }, [base, headers]);

  const handleDisconnect = useCallback(async () => {
    setDeleting(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch(base, { method: "DELETE", headers: headers() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to disconnect");
        return;
      }
      onUpdate();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }, [base, headers, onUpdate]);

  const toggleRepo = useCallback((name: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const filtered = filteredRepos;
    const allSelected = filtered.every((r) => selectedRepos.has(r.name));
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (allSelected) next.delete(r.name);
        else next.add(r.name);
      }
      return next;
    });
  }, [availableRepos, selectedRepos, repoFilter]);

  const filteredRepos = availableRepos.filter(
    (r) =>
      !repoFilter ||
      r.name.toLowerCase().includes(repoFilter.toLowerCase()) ||
      r.description?.toLowerCase().includes(repoFilter.toLowerCase()),
  );

  const anyIndexing = indexStatuses.some((s) => s.status === "indexing");

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Field
        label="Owner / Organization"
        placeholder="e.g. raftio"
        value={owner}
        onChange={setOwner}
        disabled={!isAdmin}
      />
      <Field
        label="Access Token"
        placeholder={
          integration
            ? "••••••••• (enter new token to update)"
            : "Paste your GitHub Personal Access Token"
        }
        type="password"
        value={accessToken}
        onChange={setAccessToken}
        disabled={!isAdmin}
      />
      <p className="text-xs text-base-text-muted">
        The token needs read access to repository contents.
        Classic PAT: <code className="text-base-text">repo</code> scope.
        Fine-grained: <code className="text-base-text">Contents</code> read permission.
      </p>

      {isAdmin && (
        <button
          type="button"
          onClick={handleLoadRepos}
          disabled={loadingRepos || !owner || (!accessToken && !integration)}
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loadingRepos ? "Loading..." : "Load Repositories"}
        </button>
      )}

      {availableRepos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-base-text">
              Repositories ({selectedRepos.size} selected)
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {filteredRepos.every((r) => selectedRepos.has(r.name))
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          {availableRepos.length > 8 && (
            <input
              type="text"
              placeholder="Filter repos..."
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              className="w-full rounded-lg border border-base-border bg-base px-3 py-1.5 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
            />
          )}

          <div className="max-h-60 overflow-y-auto rounded-lg border border-base-border bg-base">
            {filteredRepos.map((repo) => (
              <label
                key={repo.name}
                className="flex cursor-pointer items-center gap-3 border-b border-base-border/50 px-3 py-2 last:border-b-0 hover:bg-primary/5"
              >
                <input
                  type="checkbox"
                  checked={selectedRepos.has(repo.name)}
                  onChange={() => toggleRepo(repo.name)}
                  disabled={!isAdmin}
                  className="h-4 w-4 rounded border-base-border text-primary accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-base-text truncate">
                      {repo.name}
                    </span>
                    {repo.private && (
                      <span className="shrink-0 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600">
                        private
                      </span>
                    )}
                    {repo.archived && (
                      <span className="shrink-0 rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-medium text-base-text-muted">
                        archived
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="truncate text-xs text-base-text-muted">
                      {repo.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
            {filteredRepos.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-base-text-muted">
                No repositories match the filter.
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {testResult && (
        <p className={`text-sm ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
          {testResult.message}
        </p>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !accessToken || !owner}
            className="rounded-lg border border-base-border bg-surface px-4 py-2 text-sm font-medium text-base-text transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !owner || selectedRepos.size === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : integration ? "Update" : "Connect"}
          </button>
          {integration && (
            <>
              <button
                type="button"
                onClick={() => handleIndex()}
                disabled={indexing || anyIndexing}
                className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {indexing || anyIndexing ? "Indexing..." : "Index Now"}
              </button>
              <button
                type="button"
                onClick={() => handleIndex(true)}
                disabled={indexing || anyIndexing}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {indexing || anyIndexing ? "Indexing..." : "Force Index"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={deleting}
                className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Disconnecting..." : "Disconnect"}
              </button>
            </>
          )}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-base-text-muted">
          Only workspace owners and admins can manage integrations.
        </p>
      )}

      {indexStatuses.length > 0 && (
        <div className="mt-2 space-y-2">
          {indexStatuses.map((idx) => (
            <div
              key={idx.repo}
              className="rounded-lg border border-base-border bg-base p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    idx.status === "ready"
                      ? "bg-green-500"
                      : idx.status === "indexing"
                        ? "animate-pulse bg-yellow-500"
                        : idx.status === "failed"
                          ? "bg-red-500"
                          : "bg-gray-400"
                  }`}
                />
                <span className="text-sm font-medium text-base-text">
                  {idx.repo}
                </span>
                <span className="text-xs capitalize text-base-text-muted">
                  {idx.status}
                </span>
                {idx.status === "indexing" && idx.total_files > 0 && (
                  <span className="text-xs text-base-text-muted">
                    ({idx.indexed_files} / {idx.total_files} files)
                  </span>
                )}
                {isAdmin && (idx.status === "failed" || idx.status === "ready") && (
                  <button
                    type="button"
                    onClick={() => handleIndex(true, idx.repo)}
                    disabled={indexing || anyIndexing}
                    className="ml-auto rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Retry
                  </button>
                )}
              </div>
              {idx.status === "ready" && idx.completed_at && (
                <p className="mt-1 text-xs text-base-text-muted">
                  Completed {new Date(idx.completed_at).toLocaleString()}
                  {" — "}{idx.indexed_files} files indexed
                </p>
              )}
              {idx.status === "failed" && idx.error && (
                <p className="mt-1 text-xs text-red-400">{idx.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
