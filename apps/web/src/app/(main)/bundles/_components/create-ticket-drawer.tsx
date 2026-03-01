"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CreateTicketDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  token: string;
  onCreated: () => void;
}

export function CreateTicketDrawer({
  open,
  onClose,
  workspaceId,
  token,
  onCreated,
}: CreateTicketDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ key: string; url?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
    if (open) {
      setTitle("");
      setDescription("");
      setLabels("");
      setError("");
      setCreated(null);
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setError("");
    setCreated(null);
    try {
      const body: Record<string, unknown> = { title };
      if (description.trim()) body.description = description;
      const parsedLabels = labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      if (parsedLabels.length) body.labels = parsedLabels;

      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/tickets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create issue");
        return;
      }
      setCreated({
        key: data.ticket.key,
        url: data.ticket.links?.[0],
      });
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }, [workspaceId, token, title, description, labels, onCreated]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Create Issue"
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-surface shadow-xl animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between border-b border-base-border px-6 py-4">
          <h2 className="text-lg font-semibold text-base-text">Create Issue</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-base hover:text-base-text"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-base-text">
                Title <span className="text-red-400">*</span>
              </span>
              <input
                type="text"
                placeholder="Issue title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-base-text">
                Description
              </span>
              <textarea
                placeholder="Describe the issue…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-base-text">
                Labels
              </span>
              <input
                type="text"
                placeholder="bug, enhancement (comma-separated)"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                className="w-full rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {created && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-400">
                Created{" "}
                {created.url ? (
                  <a
                    href={created.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {created.key}
                  </a>
                ) : (
                  <span className="font-medium">{created.key}</span>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !title.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Creating…" : "Create Issue"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-base-border bg-surface px-4 py-2 text-sm font-medium text-base-text transition-colors hover:bg-primary/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
