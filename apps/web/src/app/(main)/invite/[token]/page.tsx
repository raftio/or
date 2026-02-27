"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function AcceptInvitePage() {
  const { token: inviteToken } = useParams<{ token: string }>();
  const { token } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const router = useRouter();

  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    text: string;
    workspaceId?: string;
  } | null>(null);

  const handleAccept = useCallback(async () => {
    if (!token || !inviteToken) return;
    setAccepting(true);
    setResult(null);
    try {
      const res = await fetch(`${apiUrl}/v1/invitations/${inviteToken}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ type: "error", text: data.error || "Failed to accept invitation" });
        return;
      }
      await refreshWorkspaces();
      if (data.workspace?.id) {
        switchWorkspace(data.workspace.id);
      }
      setResult({
        type: "success",
        text: `You have joined ${data.workspace?.name ?? "the workspace"}!`,
        workspaceId: data.workspace?.id,
      });
    } catch {
      setResult({ type: "error", text: "Network error" });
    } finally {
      setAccepting(false);
    }
  }, [token, inviteToken, refreshWorkspaces, switchWorkspace]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-base-border bg-surface p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-base-text">Workspace Invitation</h1>
        <p className="mt-2 text-sm text-base-text-muted">
          You have been invited to join a workspace.
        </p>

        {result && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              result.type === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {result.text}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {result?.type === "success" ? (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-primary-hover"
            >
              Go to Workspace
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {accepting ? "Accepting..." : "Accept Invitation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
