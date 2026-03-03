"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { useAuth } from "@/components/auth-provider";
import { IntegrationDrawer } from "./_components/integration-drawer";
import { VENDORS, type IndexStatus } from "./_components/vendor-registry";
import { VendorList } from "./_components/vendor-list";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function IntegrationPage() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [indexStatusMap, setIndexStatusMap] = useState<Record<string, IndexStatus[]>>({});

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

  const fetchAllIndexStatuses = useCallback(async () => {
    if (!activeWorkspace || !token) return;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const base = `${apiUrl}/v1/workspaces/${activeWorkspace.id}/integrations`;

    const vendorsWithStatus = VENDORS.filter(
      (v) => v.statusEndpoint && v.integrationProvider && integrations[v.integrationProvider],
    );

    const results = await Promise.allSettled(
      vendorsWithStatus.map(async (v) => {
        const res = await fetch(`${base}/${v.statusEndpoint}/status`, { headers });
        if (!res.ok) return { vendorId: v.id, indexes: [] as IndexStatus[] };
        const data = await res.json();
        return { vendorId: v.id, indexes: (data.indexes ?? []) as IndexStatus[] };
      }),
    );

    const next: Record<string, IndexStatus[]> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        next[r.value.vendorId] = r.value.indexes;
      }
    }
    setIndexStatusMap(next);
  }, [activeWorkspace, token, integrations]);

  useEffect(() => {
    fetchAllIndexStatuses();
  }, [fetchAllIndexStatuses]);

  useEffect(() => {
    const anyIndexing = Object.values(indexStatusMap).some((statuses) =>
      statuses.some((s) => s.status === "indexing"),
    );
    if (!anyIndexing) return;
    const id = setInterval(fetchAllIndexStatuses, 5000);
    return () => clearInterval(id);
  }, [indexStatusMap, fetchAllIndexStatuses]);

  const handleUpdate = useCallback(() => {
    setOpenVendor(null);
    fetchIntegrations();
  }, [fetchIntegrations]);

  const isAdmin =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  const currentVendor = VENDORS.find((v) => v.id === openVendor);
  const FormComponent = currentVendor?.formComponent;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-base-text">
        Integrations
      </h1>
      <p className="mt-3 text-base-text-muted">
        Connect OR with your existing tools — CI/CD pipelines, IDEs, Git
        providers, and more.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-base-text-muted">Loading...</p>
      ) : (
        <VendorList
          vendors={VENDORS}
          integrations={integrations}
          indexStatusMap={indexStatusMap}
          onVendorClick={setOpenVendor}
        />
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
