"use client";

import { useCallback, useEffect, useState } from "react";
import { Field } from "./field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface GitLabCodeIntegration {
  id: string;
  provider: "gitlab_code";
  config: {
    group?: string;
    project_id?: string;
    projects?: string[];
    access_token: string;
    base_url?: string;
    branch?: string;
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

interface ProjectInfo {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string;
  visibility: string;
  archived: boolean;
  description: string | null;
}

interface GitLabCodeFormProps {
  workspaceId: string;
  token: string;
  integration: GitLabCodeIntegration | null;
  isAdmin: boolean;
  onUpdate: () => void;
}

function getConfiguredProjects(integration: GitLabCodeIntegration | null): string[] {
  if (!integration) return [];
  if (Array.isArray(integration.config.projects)) return integration.config.projects;
  if (integration.config.project_id) return [integration.config.project_id];
  return [];
}

export function GitLabCodeForm({
  workspaceId,
  token,
  integration,
  isAdmin,
  onUpdate,
}: GitLabCodeFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showIndexMenu, setShowIndexMenu] = useState(false);

  const [baseUrl, setBaseUrl] = useState(integration?.config.base_url ?? "");
  const [group, setGroup] = useState(integration?.config.group ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(getConfiguredProjects(integration)),
  );

  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
  const [projectFilter, setProjectFilter] = useState("");

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

  const base = `${apiUrl}/v1/workspaces/${workspaceId}/integrations/gitlab-code`;

  // ── Fetch index status ──────────────────────────────────────────────

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

  useEffect(() => {
    if (!indexStatuses.some((s) => s.status === "indexing")) return;
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [indexStatuses, fetchStatus]);

  // ── Load available projects ─────────────────────────────────────────

  const handleLoadProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (group) params.set("group", group);
      if (accessToken) params.set("access_token", accessToken);
      if (baseUrl) params.set("base_url", baseUrl);

      const res = await fetch(`${base}/repos?${params.toString()}`, {
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load projects");
        return;
      }
      setAvailableProjects(data.projects ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoadingProjects(false);
    }
  }, [base, group, accessToken, baseUrl, headers]);

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
          access_token: accessToken || undefined,
          base_url: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `Authenticated as ${data.user?.name ?? data.user?.username ?? "OK"}`,
        });
      } else {
        setTestResult({ ok: false, message: data.error || "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  }, [base, accessToken, baseUrl, headers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const projects = Array.from(selectedProjects);
      if (projects.length === 0) {
        setError("Select at least one project");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = { group, projects };
      if (baseUrl) body.base_url = baseUrl;

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
  }, [base, group, selectedProjects, baseUrl, accessToken, integration, headers, onUpdate]);

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

  const toggleProject = useCallback((path: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const filteredProjects = availableProjects.filter(
    (p) =>
      !projectFilter ||
      p.name.toLowerCase().includes(projectFilter.toLowerCase()) ||
      p.path_with_namespace.toLowerCase().includes(projectFilter.toLowerCase()) ||
      p.description?.toLowerCase().includes(projectFilter.toLowerCase()),
  );

  const toggleAll = useCallback(() => {
    const allSelected = filteredProjects.every((p) => selectedProjects.has(p.path_with_namespace));
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      for (const p of filteredProjects) {
        if (allSelected) next.delete(p.path_with_namespace);
        else next.add(p.path_with_namespace);
      }
      return next;
    });
  }, [filteredProjects, selectedProjects]);

  const anyIndexing = indexStatuses.some((s) => s.status === "indexing");

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Field
        label="GitLab URL"
        placeholder="https://gitlab.com"
        value={baseUrl}
        onChange={setBaseUrl}
        disabled={!isAdmin}
      />
      <Field
        label="Group / Namespace"
        placeholder="e.g. platform-transport"
        value={group}
        onChange={setGroup}
        disabled={!isAdmin}
      />
      <Field
        label="Access Token"
        placeholder={
          integration
            ? "••••••••• (enter new token to update)"
            : "Paste your GitLab Personal Access Token"
        }
        type="password"
        value={accessToken}
        onChange={setAccessToken}
        disabled={!isAdmin}
      />
      <p className="text-xs text-base-text-muted">
        The token needs <code className="text-base-text">read_api</code> scope
        for read access to repository contents and branches.
      </p>

      {availableProjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-base-text">
              Projects ({selectedProjects.size} selected)
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {filteredProjects.every((p) => selectedProjects.has(p.path_with_namespace))
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          {availableProjects.length > 8 && (
            <input
              type="text"
              placeholder="Filter projects..."
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full rounded-lg border border-base-border bg-base px-3 py-1.5 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
            />
          )}

          <div className="max-h-60 overflow-y-auto rounded-lg border border-base-border bg-base">
            {filteredProjects.map((project) => (
              <label
                key={project.path_with_namespace}
                className="flex cursor-pointer items-center gap-3 border-b border-base-border/50 px-3 py-2 last:border-b-0 hover:bg-primary/5"
              >
                <input
                  type="checkbox"
                  checked={selectedProjects.has(project.path_with_namespace)}
                  onChange={() => toggleProject(project.path_with_namespace)}
                  disabled={!isAdmin}
                  className="h-4 w-4 rounded border-base-border text-primary accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-base-text truncate">
                      {project.name}
                    </span>
                    {project.visibility === "private" && (
                      <span className="shrink-0 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600">
                        private
                      </span>
                    )}
                    {project.archived && (
                      <span className="shrink-0 rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-medium text-base-text-muted">
                        archived
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="truncate text-xs text-base-text-muted">
                      {project.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
            {filteredProjects.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-base-text-muted">
                No projects match the filter.
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
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleLoadProjects}
            disabled={loadingProjects || !group || (!accessToken && !integration)}
            className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingProjects ? "Loading..." : "Load Projects"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !accessToken}
            className="rounded-md border border-base-border bg-surface px-3 py-1.5 text-xs font-medium text-base-text transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          {integration && (
            <div className="relative">
              <div className="inline-flex rounded-md border border-primary/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleIndex()}
                  disabled={indexing || anyIndexing}
                  className="bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {indexing || anyIndexing ? "Indexing..." : "Index Now"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowIndexMenu((v) => !v)}
                  disabled={indexing || anyIndexing}
                  className="border-l border-primary/30 bg-primary/5 px-2 py-1.5 text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {showIndexMenu && (
                <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border border-base-border bg-surface shadow-lg">
                  <button
                    type="button"
                    onClick={() => { handleIndex(true); setShowIndexMenu(false); }}
                    className="w-full rounded-md px-3 py-2 text-left text-xs text-amber-500 transition-colors hover:bg-amber-500/10"
                  >
                    Force Re-index
                    <span className="block text-xs text-base-text-muted">Clear all data and rebuild</span>
                  </button>
                </div>
              )}
            </div>
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

      {isAdmin && (
        <div className="sticky bottom-0 -mx-6 -mb-5 flex gap-2 border-t border-base-border bg-surface px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !group || selectedProjects.size === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-base transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : integration ? "Update" : "Connect"}
          </button>
          {integration && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={deleting}
              className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? "Disconnecting..." : "Disconnect"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
