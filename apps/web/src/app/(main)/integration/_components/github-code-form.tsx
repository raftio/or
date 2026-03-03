"use client";

import { useCallback, useEffect, useState } from "react";
import { Field } from "./field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface GitHubCodeIntegration {
  id: string;
  provider: "github_code";
  config: {
    owner: string;
    repo: string;
    access_token: string;
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

interface GitHubCodeFormProps {
  workspaceId: string;
  token: string;
  integration: GitHubCodeIntegration | null;
  isAdmin: boolean;
  onUpdate: () => void;
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

  const [owner, setOwner] = useState(integration?.config.owner ?? "");
  const [repo, setRepo] = useState(integration?.config.repo ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [branch, setBranch] = useState(integration?.config.branch ?? "main");

  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);

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
      setIndexStatus(data.indexes?.[0] ?? null);
    } catch {
      /* ignore */
    }
  }, [integration, base, headers]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Poll while indexing ───────────────────────────────────────────────

  useEffect(() => {
    if (indexStatus?.status !== "indexing") return;
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [indexStatus?.status, fetchStatus]);

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
          repo,
          access_token: accessToken || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `Connected to ${data.repo?.fullName ?? "repository"} (${data.repo?.defaultBranch ?? "–"})`,
        });
      } else {
        setTestResult({ ok: false, message: data.error || "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  }, [base, owner, repo, accessToken, headers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const body: Record<string, unknown> = { owner, repo, branch };

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
  }, [base, owner, repo, branch, accessToken, integration, headers, onUpdate]);

  const handleIndex = useCallback(async () => {
    setIndexing(true);
    setError("");
    try {
      const res = await fetch(`${base}/index`, {
        method: "POST",
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start indexing");
        return;
      }
      setIndexStatus({
        repo: data.repo,
        status: "indexing",
        total_files: 0,
        indexed_files: 0,
        error: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      });
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
        label="Repository"
        placeholder="e.g. or"
        value={repo}
        onChange={setRepo}
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
      <Field
        label="Branch"
        placeholder="main"
        value={branch}
        onChange={setBranch}
        disabled={!isAdmin}
      />
      <p className="text-xs text-base-text-muted">
        The token needs read access to repository contents.
        Classic PAT: <code className="text-base-text">repo</code> scope.
        Fine-grained: <code className="text-base-text">Contents</code> read permission.
      </p>

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
            disabled={testing || !accessToken || !owner || !repo}
            className="rounded-lg border border-base-border bg-surface px-4 py-2 text-sm font-medium text-base-text transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !owner || !repo}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : integration ? "Update" : "Connect"}
          </button>
          {integration && (
            <>
              <button
                type="button"
                onClick={handleIndex}
                disabled={indexing || indexStatus?.status === "indexing"}
                className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {indexing || indexStatus?.status === "indexing"
                  ? "Indexing..."
                  : "Index Now"}
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

      {indexStatus && (
        <div className="mt-2 rounded-lg border border-base-border bg-base p-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                indexStatus.status === "ready"
                  ? "bg-green-500"
                  : indexStatus.status === "indexing"
                    ? "animate-pulse bg-yellow-500"
                    : indexStatus.status === "failed"
                      ? "bg-red-500"
                      : "bg-gray-400"
              }`}
            />
            <span className="text-sm font-medium text-base-text capitalize">
              {indexStatus.status}
            </span>
            {indexStatus.status === "indexing" && indexStatus.total_files > 0 && (
              <span className="text-xs text-base-text-muted">
                ({indexStatus.indexed_files} / {indexStatus.total_files} files)
              </span>
            )}
          </div>
          {indexStatus.status === "ready" && indexStatus.completed_at && (
            <p className="mt-1 text-xs text-base-text-muted">
              Completed {new Date(indexStatus.completed_at).toLocaleString()}
              {" — "}{indexStatus.indexed_files} files indexed
            </p>
          )}
          {indexStatus.status === "failed" && indexStatus.error && (
            <p className="mt-1 text-xs text-red-400">{indexStatus.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
