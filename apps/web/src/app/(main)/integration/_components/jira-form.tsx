"use client";

import { useCallback, useState } from "react";
import { Field } from "./field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface JiraIntegration {
  id: string;
  provider: "jira";
  config: { base_url: string; email: string; api_token: string; project_key?: string };
  created_at: string;
  updated_at: string;
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

interface JiraFormProps {
  workspaceId: string;
  token: string;
  integration: JiraIntegration | null;
  isAdmin: boolean;
  onUpdate: () => void;
}

export function JiraForm({
  workspaceId,
  token,
  integration,
  isAdmin,
  onUpdate,
}: JiraFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [baseUrl, setBaseUrl] = useState(integration?.config.base_url ?? "");
  const [email, setEmail] = useState(integration?.config.email ?? "");
  const [projectKey, setProjectKey] = useState(integration?.config.project_key ?? "");
  const [apiToken, setApiToken] = useState("");

  const [availableProjects, setAvailableProjects] = useState<JiraProject[]>([]);

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

  const handleLoadProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (baseUrl) params.set("base_url", baseUrl);
      if (email) params.set("email", email);
      if (apiToken) params.set("api_token", apiToken);

      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/jira/projects?${params.toString()}`,
        { headers: headers() },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load projects");
        return;
      }
      setAvailableProjects(data.projects ?? []);
      if ((data.projects ?? []).length === 0) {
        setError("No projects found for these credentials");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoadingProjects(false);
    }
  }, [workspaceId, baseUrl, email, apiToken, headers]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/jira/test`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            base_url: baseUrl,
            email,
            api_token: apiToken || undefined,
          }),
        },
      );
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `Connected as ${data.user?.displayName ?? data.user?.emailAddress ?? "OK"}`,
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
  }, [workspaceId, baseUrl, email, apiToken, headers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const body: Record<string, string> = { base_url: baseUrl, email };
      if (projectKey) body.project_key = projectKey;
      if (apiToken) {
        body.api_token = apiToken;
      } else if (integration) {
        setError("Enter API token to update the configuration");
        setSaving(false);
        return;
      } else {
        setError("API token is required");
        setSaving(false);
        return;
      }

      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/jira`,
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
      setApiToken("");
      onUpdate();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }, [workspaceId, baseUrl, email, projectKey, apiToken, integration, headers, onUpdate]);

  const handleDisconnect = useCallback(async () => {
    setDeleting(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/integrations/jira`,
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

  const canLoadProjects = !!baseUrl && !!email && (!!apiToken || !!integration);

  return (
    <div className="space-y-4">
      <Field
        label="Base URL"
        placeholder="https://yourteam.atlassian.net"
        value={baseUrl}
        onChange={setBaseUrl}
        disabled={!isAdmin}
      />
      <Field
        label="Email"
        placeholder="you@company.com"
        type="email"
        value={email}
        onChange={setEmail}
        disabled={!isAdmin}
      />
      <Field
        label="API Token"
        placeholder={
          integration
            ? "••••••••• (enter new token to update)"
            : "Paste your Jira API token"
        }
        type="password"
        value={apiToken}
        onChange={setApiToken}
        disabled={!isAdmin}
      />

      {/* Project picker */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-base-text">Project</label>
          {isAdmin && (
            <button
              type="button"
              onClick={handleLoadProjects}
              disabled={loadingProjects || !canLoadProjects}
              className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingProjects ? "Loading..." : "Load Projects"}
            </button>
          )}
        </div>

        {availableProjects.length > 0 ? (
          <select
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">All projects</option>
            {availableProjects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} — {p.name}
              </option>
            ))}
          </select>
        ) : projectKey ? (
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
              {projectKey}
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setProjectKey("")}
                className="text-xs text-base-text-muted hover:text-base-text"
              >
                Clear
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-base-text-muted">
            Optional. Click &quot;Load Projects&quot; to pick a specific project, or leave blank to sync all accessible projects.
          </p>
        )}
      </div>

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
            disabled={testing || !baseUrl || !email || !apiToken}
            className="rounded-lg border border-base-border bg-surface px-4 py-2 text-sm font-medium text-base-text transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !baseUrl || !email}
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
