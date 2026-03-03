"use client";

import { useCallback, useState } from "react";
import { Field } from "./field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface GitLabIssuesIntegration {
  id: string;
  provider: "gitlab";
  config: { project_id: string; access_token: string; base_url?: string };
  created_at: string;
  updated_at: string;
}

interface GitLabIssuesFormProps {
  workspaceId: string;
  token: string;
  integration: GitLabIssuesIntegration | null;
  isAdmin: boolean;
  onUpdate: () => void;
}

export function GitLabIssuesForm({
  workspaceId,
  token,
  integration,
  isAdmin,
  onUpdate,
}: GitLabIssuesFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [baseUrl, setBaseUrl] = useState(integration?.config.base_url ?? "");
  const [projectId, setProjectId] = useState(integration?.config.project_id ?? "");
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
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/gitlab/test`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            access_token: accessToken || undefined,
            base_url: baseUrl || undefined,
          }),
        },
      );
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `Authenticated as ${data.user?.name ?? data.user?.username ?? "OK"}`,
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
      const body: Record<string, string> = { project_id: projectId };
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

      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/gitlab`,
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
  }, [workspaceId, projectId, accessToken, integration, headers, onUpdate]);

  const handleDisconnect = useCallback(async () => {
    setDeleting(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/gitlab`,
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
        label="GitLab URL"
        placeholder="https://gitlab.com"
        value={baseUrl}
        onChange={setBaseUrl}
        disabled={!isAdmin}
      />
      <Field
        label="Project ID"
        placeholder="e.g. my-group/my-project or 12345"
        value={projectId}
        onChange={setProjectId}
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
        The token needs <code className="text-base-text">api</code> or{" "}
        <code className="text-base-text">read_api</code> scope. For creating
        issues, <code className="text-base-text">api</code> scope is required.
      </p>

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
            disabled={saving || !projectId}
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
