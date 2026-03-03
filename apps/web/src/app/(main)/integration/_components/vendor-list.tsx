import type { VendorConfig, IndexStatus } from "./vendor-registry";
import { CicdCard } from "./cicd-card";
import { GitProviderCard } from "./git-provider-card";

interface VendorListProps {
  vendors: VendorConfig[];
  integrations: Record<string, any>;
  indexStatusMap?: Record<string, IndexStatus[]>;
  onVendorClick: (vendorId: string) => void;
}

function getIntegration(
  vendor: VendorConfig,
  integrations: Record<string, any>,
): any | undefined {
  return vendor.integrationProvider
    ? integrations[vendor.integrationProvider]
    : undefined;
}

function getDetail(
  vendor: VendorConfig,
  integration: any | undefined,
): string | undefined {
  if (!integration || !vendor.describeConnection) return undefined;
  return vendor.describeConnection(integration);
}

export function VendorList({
  vendors,
  integrations,
  indexStatusMap,
  onVendorClick,
}: VendorListProps) {
  const connectedVendors = vendors.filter((v) => getIntegration(v, integrations));

  return (
    <>
      {connectedVendors.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-base-text-muted">
            Connected
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {connectedVendors.map((v) => {
              const integration = getIntegration(v, integrations);
              return (
                <v.cardComponent
                  key={v.id}
                  connected
                  vendorTitle={v.title}
                  detail={getDetail(v, integration)}
                  indexStatuses={indexStatusMap?.[v.id]}
                  onClick={() => onVendorClick(v.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-base-text-muted">
          Available
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((v) => (
            <v.cardComponent
              key={v.id}
              connected={false}
              onClick={() => onVendorClick(v.id)}
            />
          ))}
          <CicdCard />
          <GitProviderCard />
        </div>
      </section>
    </>
  );
}
