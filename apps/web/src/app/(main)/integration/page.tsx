"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";
import { IntegrationDrawer } from "./_components/integration-drawer";
import { VENDORS } from "./_components/vendor-registry";
import { CicdCard } from "./_components/cicd-card";
import { GitProviderCard } from "./_components/git-provider-card";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function IntegrationPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [openVendor, setOpenVendor] = useState<string | null>(null);

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
      const map: Record<string, any> = {};
      for (const item of data.integrations ?? []) {
        map[item.provider] = item;
      }
      setIntegrations(map);
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

  const connectedVendors = VENDORS.filter(
    (v) => v.integrationProvider && integrations[v.integrationProvider],
  );
  const availableVendors = VENDORS.filter(
    (v) => !v.integrationProvider || !integrations[v.integrationProvider],
  );

  const currentVendor = VENDORS.find((v) => v.id === openVendor);
  const FormComponent = currentVendor?.formComponent;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-base-text">
        Integrations
      </h1>
      <p className="mt-3 text-base-text-muted">
        Connect Orca with your existing tools — CI/CD pipelines, IDEs, Git
        providers, and more.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-base-text-muted">Loading...</p>
      ) : (
        <>
          {connectedVendors.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-base-text-muted">
                Connected
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {connectedVendors.map((v) => (
                  <v.cardComponent
                    key={v.id}
                    connected
                    onClick={() => setOpenVendor(v.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-base-text-muted">
              Available
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {availableVendors.map((v) => (
                <v.cardComponent
                  key={v.id}
                  connected={false}
                  onClick={() => setOpenVendor(v.id)}
                />
              ))}
              <CicdCard />
              <GitProviderCard />
            </div>
          </section>
        </>
      )}

      <IntegrationDrawer
        open={!!openVendor}
        onClose={() => setOpenVendor(null)}
        title={currentVendor?.title ?? ""}
      >
        {FormComponent &&
          (currentVendor?.integrationProvider && activeWorkspace && token ? (
            <FormComponent
              workspaceId={activeWorkspace.id}
              token={token}
              integration={
                integrations[currentVendor.integrationProvider] ?? null
              }
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
            />
          ) : (
            <FormComponent />
          ))}
      </IntegrationDrawer>
    </div>
  );
}
