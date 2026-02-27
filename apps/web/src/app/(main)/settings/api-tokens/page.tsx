"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  created_by: string;
  creator_email: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
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

function tokenStatus(t: ApiToken): { label: string; className: string } {
  if (t.revoked_at) {
    return { label: "Revoked", className: "bg-red-500/10 text-red-400" };
  }
  if (t.expires_at && new Date(t.expires_at) < new Date()) {
    return { label: "Expired", className: "bg-yellow-500/10 text-yellow-400" };
  }
  return { label: "Active", className: "bg-green-500/10 text-green-400" };
}

export default function ApiTokensPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [expiresIn, setExpiresIn] = useState<"7d" | "30d" | "90d" | "never">("never");
  const [creating, setCreating] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [rawCopied, setRawCopied] = useState(false);

  // Rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isAdmin = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  const fetchTokens = useCallback(async () => {
    if (!activeWorkspace || !token) return;
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${activeWorkspace.id}/api-tokens`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setTokens(data.api_tokens ?? []);
      }
    } catch {
      // keep current state
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, token]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = useCallback(async () => {
    if (!activeWorkspace || !token || !newName.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${activeWorkspace.id}/api-tokens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newName.trim(), expires_in: expiresIn }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to create token" });
        return;
      }
      setRawToken(data.token);
      setNewName("");
      setExpiresIn("never");
      fetchTokens();
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setCreating(false);
    }
  }, [activeWorkspace, token, newName, expiresIn, fetchTokens]);

  const handleCopyRaw = useCallback(async () => {
    if (!rawToken) return;
    try {
      await navigator.clipboard.writeText(rawToken);
      setRawCopied(true);
      setTimeout(() => setRawCopied(false), 2000);
    } catch {
      // clipboard may not be available
    }
  }, [rawToken]);

  const handleDismissRaw = useCallback(() => {
    setRawToken(null);
    setRawCopied(false);
    setShowCreate(false);
  }, []);

  const handleRename = useCallback(
    async (tokenId: string) => {
      if (!activeWorkspace || !token || !editName.trim()) return;
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${activeWorkspace.id}/api-tokens/${tokenId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: editName.trim() }),
          },
        );
        if (res.ok) {
          setEditingId(null);
          setEditName("");
          fetchTokens();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: data.error || "Failed to rename" });
        }
      } catch {
        setMessage({ type: "error", text: "Network error" });
      }
    },
    [activeWorkspace, token, editName, fetchTokens],
  );

  const handleRevoke = useCallback(
    async (tokenId: string, tokenName: string) => {
      if (!activeWorkspace || !token) return;
      if (!confirm(`Revoke token "${tokenName}"? This cannot be undone.`)) return;
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${activeWorkspace.id}/api-tokens/${tokenId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          setMessage({ type: "success", text: `Token "${tokenName}" revoked` });
          fetchTokens();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: data.error || "Failed to revoke" });
        }
      } catch {
        setMessage({ type: "error", text: "Network error" });
      }
    },
    [activeWorkspace, token, fetchTokens],
  );

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-base-text-muted">No workspace selected.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-base-text">API Tokens</h1>
        <p className="mt-3 text-sm text-base-text-muted">
          Only workspace owners and admins can manage API tokens.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-text">API Tokens</h1>
          <p className="mt-1 text-sm text-base-text-muted">
            Manage API tokens for <strong>{activeWorkspace.name}</strong>.
            Tokens are used to authenticate IDE extensions and CI/CD integrations.
          </p>
        </div>
        {!showCreate && !rawToken && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover"
          >
            Generate token
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Raw token display (shown once after creation) */}
      {rawToken && (
        <div className="mt-6 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-sm font-semibold text-yellow-400">
            Copy your token now — it won&apos;t be shown again
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-base px-3 py-2 text-xs font-mono text-base-text select-all">
              {rawToken}
            </code>
            <button
              type="button"
              onClick={handleCopyRaw}
              className="shrink-0 rounded-lg border border-base-border bg-surface px-3 py-2 text-xs font-medium text-base-text-muted transition-colors hover:text-base-text"
            >
              {rawCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismissRaw}
            className="mt-3 text-xs font-medium text-base-text-muted transition-colors hover:text-base-text"
          >
            I&apos;ve copied the token — dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && !rawToken && (
        <div className="mt-6 rounded-lg border border-base-border p-4">
          <h2 className="text-sm font-semibold text-base-text">Generate a new token</h2>
          <div className="mt-3 flex gap-3">
            <input
              type="text"
              placeholder="Token name (e.g. CI pipeline)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
              className="flex-1 rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
            />
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)}
              className="rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text focus:border-primary focus:outline-none"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="never">No expiration</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {creating ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-base-text-muted transition-colors hover:text-base-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Token list */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-base-text">
          Tokens ({tokens.length})
        </h2>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-base-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
            Loading...
          </div>
        ) : tokens.length === 0 ? (
          <p className="mt-4 text-sm text-base-text-muted">
            No API tokens yet. Generate one to get started.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-base-border rounded-lg border border-base-border">
            {tokens.map((t) => {
              const status = tokenStatus(t);
              const isEditing = editingId === t.id;
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(t.id);
                              if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                            }}
                            autoFocus
                            className="w-full rounded border border-base-border bg-base px-2 py-1 text-sm text-base-text focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(t.id)}
                            className="shrink-0 text-xs font-medium text-primary"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingId(null); setEditName(""); }}
                            className="shrink-0 text-xs font-medium text-base-text-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium text-base-text">{t.name}</p>
                          <p className="mt-0.5 text-xs text-base-text-muted">
                            <code className="font-mono">{t.token_prefix}...</code>
                            {" · "}
                            {t.creator_email}
                            {" · "}
                            Created {relativeTime(t.created_at)}
                            {t.last_used_at && <>{" · "}Last used {relativeTime(t.last_used_at)}</>}
                            {t.expires_at && (
                              <>
                                {" · "}
                                {new Date(t.expires_at) < new Date()
                                  ? `Expired ${relativeTime(t.expires_at)}`
                                  : `Expires ${new Date(t.expires_at).toLocaleDateString()}`}
                              </>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      {!t.revoked_at && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                            className="rounded p-1 text-base-text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                            title="Rename"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(t.id, t.name)}
                            className="rounded p-1 text-base-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Revoke"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
