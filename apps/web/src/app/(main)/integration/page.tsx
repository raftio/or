"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";
import { IntegrationDrawer } from "./_components/integration-drawer";
import { JiraCard } from "./_components/jira-card";
import { JiraForm, type JiraIntegration } from "./_components/jira-form";
import { CicdCard } from "./_components/cicd-card";
import { IdeCard } from "./_components/ide-card";
import { IdeSetup } from "./_components/ide-setup";
import { GitProviderCard } from "./_components/git-provider-card";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type VendorId = "jira" | "ide";

const DRAWER_TITLES: Record<VendorId, string> = {
  jira: "Jira Cloud",
  ide: "IDE / Agent",
};

export default function IntegrationPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [jiraIntegration, setJiraIntegration] =
    useState<JiraIntegration | null>(null);
  const [openVendor, setOpenVendor] = useState<VendorId | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!activeWorkspace || !token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${activeWorkspace.id}/integrations`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) return;
      const data = await res.json();
      const jira = (data.integrations ?? []).find(
        (i: { provider: string }) => i.provider === "jira",
      ) as JiraIntegration | undefined;
      setJiraIntegration(jira ?? null);
    } catch {
      // keep current state
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, token]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleUpdate = useCallback(() => {
    setOpenVendor(null);
    fetchIntegrations();
  }, [fetchIntegrations]);

  const isAdmin =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  const jiraConnected = !!jiraIntegration;

  const connectedCards = (
    <>
      {jiraConnected && (
        <JiraCard connected onClick={() => setOpenVendor("jira")} />
      )}
    </>
  );

  const hasConnected = jiraConnected;

  const availableCards = (
    <>
      {!jiraConnected && (
        <JiraCard connected={false} onClick={() => setOpenVendor("jira")} />
      )}
      <CicdCard />
      <IdeCard onClick={() => setOpenVendor("ide")} />
      <GitProviderCard />
    </>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-base-text">
        Integrations
      </h1>
      <p className="mt-3 text-base-text-muted">
        Connect Orqestra with your existing tools — CI/CD pipelines, IDEs, Git
        providers, and more.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-base-text-muted">Loading...</p>
      ) : (
        <>
          {hasConnected && (
            <section className="mt-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-base-text-muted">
                Connected
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">{connectedCards}</div>
            </section>
          )}

          <section className={hasConnected ? "mt-10" : "mt-10"}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-base-text-muted">
              Available
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">{availableCards}</div>
          </section>
        </>
      )}

      <IntegrationDrawer
        open={!!openVendor}
        onClose={() => setOpenVendor(null)}
        title={openVendor ? DRAWER_TITLES[openVendor] : ""}
      >
        {openVendor === "jira" && activeWorkspace && token && (
          <JiraForm
            workspaceId={activeWorkspace.id}
            token={token}
            integration={jiraIntegration}
            isAdmin={isAdmin}
            onUpdate={handleUpdate}
          />
        )}
        {openVendor === "ide" && <IdeSetup />}
      </IntegrationDrawer>
    </div>
  );
}
