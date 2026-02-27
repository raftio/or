"use client";

import { useCallback, useState } from "react";
import { Field } from "./field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface GitHubIntegration {
  id: string;
  provider: "github";
  config: { owner: string; repo: string; access_token: string };
  created_at: string;
  updated_at: string;
}

interface GitHubIssuesFormProps {
  workspaceId: string;
  token: string;
  integration: GitHubIntegration | null;
  isAdmin: boolean;
  onUpdate: () => void;
}

export function GitHubIssuesForm({
  workspaceId,
  token,
  integration,
  isAdmin,
  onUpdate,
}: GitHubIssuesFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [owner, setOwner] = useState(integration?.config.owner ?? "");
  const [repo, setRepo] = useState(integration?.config.repo ?? "");
  const [accessToken, setAccessToken] = useState("");

  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/github/test`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            access_token: accessToken || undefined,
          }),
        },
      );
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `Authenticated as ${data.user?.name ?? data.user?.login ?? "OK"}`,
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error || "Connection failed",
        });
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  }, [workspaceId, accessToken, headers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const body: Record<string, string> = { owner, repo };
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

      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/github`,
        {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify(body),
        },
      );
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
  }, [workspaceId, owner, repo, accessToken, integration, headers, onUpdate]);

  const handleDisconnect = useCallback(async () => {
    setDeleting(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/github`,
        { method: "DELETE", headers: headers() },
      );
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
  }, [workspaceId, headers, onUpdate]);

  return (
    <div className="space-y-4">
      <Field
        label="Owner / Organization"
        placeholder="e.g. octocat"
        value={owner}
        onChange={setOwner}
        disabled={!isAdmin}
      />
      <Field
        label="Repository"
        placeholder="e.g. my-project"
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      {testResult && (
        <p
          className={`text-sm ${testResult.ok ? "text-green-400" : "text-red-400"}`}
        >
          {testResult.message}
        </p>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !accessToken}
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
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={deleting}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? "Disconnecting..." : "Disconnect"}
            </button>
          )}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-base-text-muted">
          Only workspace owners and admins can manage integrations.
        </p>
      )}
    </div>
  );
}
