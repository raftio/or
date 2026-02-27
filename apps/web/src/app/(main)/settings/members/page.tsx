"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_email: string;
  user_name: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export default function MembersPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isOwnerOrAdmin = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace || !token) return;
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`${apiUrl}/v1/workspaces/${activeWorkspace.id}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        isOwnerOrAdmin
          ? fetch(`${apiUrl}/v1/workspaces/${activeWorkspace.id}/invitations`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : Promise.resolve(null),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members ?? []);
      }
      if (invitesRes?.ok) {
        const data = await invitesRes.json();
        setInvitations(data.invitations ?? []);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, token, isOwnerOrAdmin]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = useCallback(async () => {
    if (!activeWorkspace || !token || !inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/v1/workspaces/${activeWorkspace.id}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to invite" });
        return;
      }
      setMessage({ type: "success", text: `Invitation sent to ${inviteEmail.trim()}` });
      setInviteEmail("");
      fetchMembers();
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setInviting(false);
    }
  }, [activeWorkspace, token, inviteEmail, inviteRole, fetchMembers]);

  const handleRoleChange = useCallback(
    async (memberId: string, newRole: string) => {
      if (!activeWorkspace || !token) return;
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${activeWorkspace.id}/members/${memberId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ role: newRole }),
          },
        );
        if (res.ok) {
          fetchMembers();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: data.error || "Failed to update role" });
        }
      } catch {
        setMessage({ type: "error", text: "Network error" });
      }
    },
    [activeWorkspace, token, fetchMembers],
  );

  const handleRemove = useCallback(
    async (memberId: string, memberName: string) => {
      if (!activeWorkspace || !token) return;
      if (!confirm(`Remove ${memberName} from this workspace?`)) return;
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${activeWorkspace.id}/members/${memberId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          fetchMembers();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: data.error || "Failed to remove member" });
        }
      } catch {
        setMessage({ type: "error", text: "Network error" });
      }
    },
    [activeWorkspace, token, fetchMembers],
  );

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-base-text-muted">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-base-text">Members</h1>
      <p className="mt-1 text-sm text-base-text-muted">
        Manage who has access to <strong>{activeWorkspace.name}</strong>.
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

      {isOwnerOrAdmin && (
        <div className="mt-8 rounded-lg border border-base-border p-4">
          <h2 className="text-sm font-semibold text-base-text">Invite a member</h2>
          <div className="mt-3 flex gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1 rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
              className="rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text focus:border-primary focus:outline-none"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {inviting ? "Sending..." : "Invite"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-base-text">
          Members ({members.length})
        </h2>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-base-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
            Loading...
          </div>
        ) : (
          <div className="mt-3 divide-y divide-base-border rounded-lg border border-base-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {(member.user_name || member.user_email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-base-text">
                    {member.user_name || "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-base-text-muted">
                    {member.user_email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === "owner" ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Owner
                    </span>
                  ) : isOwnerOrAdmin ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="rounded border border-base-border bg-base px-2 py-1 text-xs text-base-text focus:border-primary focus:outline-none"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemove(member.id, member.user_name || member.user_email)}
                        className="rounded p-1 text-base-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Remove member"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full bg-base px-2.5 py-0.5 text-xs font-medium text-base-text-muted capitalize">
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwnerOrAdmin && invitations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-base-text">
            Pending Invitations ({invitations.length})
          </h2>
          <div className="mt-3 divide-y divide-base-border rounded-lg border border-base-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-sm font-medium text-yellow-400">
                  {inv.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-base-text">
                    {inv.email}
                  </p>
                  <p className="truncate text-xs text-base-text-muted">
                    Invited as {inv.role} &middot; Expires{" "}
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
