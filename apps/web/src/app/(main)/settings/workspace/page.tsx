"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { token } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name);
      setSlug(activeWorkspace.slug);
    }
  }, [activeWorkspace]);

  const isOwnerOrAdmin = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  const handleSave = useCallback(async () => {
    if (!activeWorkspace || !token || !isOwnerOrAdmin) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/v1/workspaces/${activeWorkspace.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to update" });
        return;
      }
      await refreshWorkspaces();
      setMessage({ type: "success", text: "Workspace updated successfully" });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }, [activeWorkspace, token, name, slug, isOwnerOrAdmin, refreshWorkspaces]);

  const handleDelete = useCallback(async () => {
    if (!activeWorkspace || !token || activeWorkspace.role !== "owner") return;
    if (deleteConfirm !== activeWorkspace.name) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/v1/workspaces/${activeWorkspace.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Failed to delete" });
        setDeleting(false);
        return;
      }
      await refreshWorkspaces();
      router.push("/");
    } catch {
      setMessage({ type: "error", text: "Network error" });
      setDeleting(false);
    }
  }, [activeWorkspace, token, deleteConfirm, refreshWorkspaces, router]);

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-base-text-muted">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-base-text">
        Workspace Settings
      </h1>
      <p className="mt-1 text-sm text-base-text-muted">
        Manage your workspace configuration.
      </p>

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

      <div className="mt-8 space-y-6">
        <div>
          <label htmlFor="ws-name" className="block text-sm font-medium text-base-text">
            Workspace Name
          </label>
          <input
            id="ws-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwnerOrAdmin}
            className="mt-1 w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="ws-slug" className="block text-sm font-medium text-base-text">
            Slug
          </label>
          <input
            id="ws-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!isOwnerOrAdmin}
            className="mt-1 w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-base-text-muted">
            URL-friendly identifier for the workspace.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {activeWorkspace.role === "owner" && (
        <div className="mt-12 rounded-lg border border-red-500/20 p-6">
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-base-text-muted">
            Permanently delete this workspace and all its data. This action cannot be undone.
          </p>
          <div className="mt-4">
            <label htmlFor="delete-confirm" className="block text-sm text-base-text-muted">
              Type <strong className="text-base-text">{activeWorkspace.name}</strong> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={activeWorkspace.name}
              className="mt-1 w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-red-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || deleteConfirm !== activeWorkspace.name}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Workspace"}
          </button>
        </div>
      )}
    </div>
  );
}
