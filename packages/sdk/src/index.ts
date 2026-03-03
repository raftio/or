/**
 * Typed API client for OR.
 */
import type { EvidencePayload, ExecutionBundle } from "@or/domain";

export interface ORClientOptions {
  baseUrl: string;
  apiToken?: string;
}

export interface SyncBundlesResult {
  total: number;
  synced: number;
  skipped: number;
  errors: string[];
}

export interface SyncCodeIndexResult {
  triggered: number;
  message?: string;
}

export function createClient(options: ORClientOptions) {
  const { baseUrl, apiToken } = options;

  function headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (apiToken) h["Authorization"] = `Bearer ${apiToken}`;
    return h;
  }

  return {
    async getHealth(): Promise<{ status: string }> {
      const res = await fetch(`${baseUrl}/health`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async submitEvidence(payload: EvidencePayload): Promise<EvidencePayload & { id: string }> {
      const res = await fetch(`${baseUrl}/v1/evidence`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async getBundles(ticketId: string): Promise<{ bundles: ExecutionBundle[] }> {
      const res = await fetch(
        `${baseUrl}/v1/bundles?ticketId=${encodeURIComponent(ticketId)}`,
        { headers: headers() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async syncBundles(): Promise<SyncBundlesResult> {
      const res = await fetch(`${baseUrl}/v1/bundles/sync`, {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async syncCodeIndex(): Promise<SyncCodeIndexResult> {
      const res = await fetch(`${baseUrl}/v1/code-index/sync`, {
        method: "POST",
        headers: headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  };
}

export type ORClient = ReturnType<typeof createClient>;
