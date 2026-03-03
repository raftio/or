"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { useWorkspace } from "./workspace-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Memory {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

interface ApiMemory {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

interface MemoryManagementProps {
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

export function MemoryManagement({ adding, onAddingChange }: MemoryManagementProps) {
  const { token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const workspaceId = activeWorkspace?.id;
  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : undefined;

  const fetchMemories = useCallback(async () => {
    if (!workspaceId || !headers) return;
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/chat/memories`,
        { headers },
      );
      if (!res.ok) return;
      const data = await res.json();
      setMemories(
        (data.memories ?? []).map((m: ApiMemory) => ({
          id: m.id,
          content: m.content,
          category: m.category,
          createdAt: m.createdAt,
        })),
      );
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleAdd = useCallback(async () => {
    const trimmed = newValue.trim();
    if (!trimmed || !workspaceId || !headers) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/chat/memories`,
        { method: "POST", headers, body: JSON.stringify({ content: trimmed, category: "context" }) },
      );
      if (!res.ok) return;
      const data = await res.json();
      const m = data.memory as ApiMemory;
      setMemories((prev) => [
        { id: m.id, content: m.content, category: m.category, createdAt: m.createdAt },
        ...prev,
      ]);
      setNewValue("");
      onAddingChange(false);
    } catch {
      // network error
    } finally {
      setSaving(false);
    }
  }, [newValue, workspaceId, token]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!workspaceId || !headers) return;
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setEditingId(null);
      try {
        await fetch(
          `${apiUrl}/v1/workspaces/${workspaceId}/chat/memories/${id}`,
          { method: "DELETE", headers },
        );
      } catch {
        await fetchMemories();
      }
    },
    [workspaceId, token, fetchMemories],
  );

  const handleEditStart = useCallback((memory: Memory) => {
    setEditingId(memory.id);
    setEditValue(memory.content);
  }, []);

  const handleEditSave = useCallback(
    async (id: string) => {
      const trimmed = editValue.trim();
      if (!trimmed || !workspaceId || !headers) return;
      setSaving(true);
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${workspaceId}/chat/memories/${id}`,
          { method: "PATCH", headers, body: JSON.stringify({ content: trimmed }) },
        );
        if (!res.ok) return;
        const data = await res.json();
        const m = data.memory as ApiMemory;
        setMemories((prev) =>
          prev.map((mem) =>
            mem.id === id ? { ...mem, content: m.content } : mem,
          ),
        );
        setEditingId(null);
        setEditValue("");
      } catch {
        // network error
      } finally {
        setSaving(false);
      }
    },
    [editValue, workspaceId, token],
  );

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-base-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {adding && (
        <div className="rounded-lg border border-base-border bg-base p-3">
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter a memory..."
            rows={2}
            className="w-full resize-none rounded-md border border-base-border bg-surface px-2.5 py-1.5 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onAddingChange(false);
                setNewValue("");
              }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-base-text-muted transition-colors hover:text-base-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newValue.trim() || saving}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-base transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {memories.length === 0 && !adding && (
        <p className="text-xs text-base-text-muted">
          No memories yet. Add one to help OR remember important context.
        </p>
      )}

      <ul className="space-y-2">
        {memories.map((memory) => (
          <li
            key={memory.id}
            className="rounded-lg border border-base-border bg-base p-3"
          >
            {editingId === memory.id ? (
              <>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-base-border bg-surface px-2.5 py-1.5 text-sm text-base-text focus:border-primary focus:outline-none"
                  autoFocus
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleEditCancel}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-base-text-muted transition-colors hover:text-base-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditSave(memory.id)}
                    disabled={!editValue.trim() || saving}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-base transition-colors hover:bg-primary-hover disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-base-text">
                    {memory.content}
                  </p>
                  <p className="mt-1 text-[10px] text-base-text-muted">
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditStart(memory)}
                    className="rounded-md p-1 text-base-text-muted transition-colors hover:bg-primary/10 hover:text-base-text"
                    title="Edit"
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
                      aria-hidden
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(memory.id)}
                    className="rounded-md p-1 text-base-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
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
                      aria-hidden
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
