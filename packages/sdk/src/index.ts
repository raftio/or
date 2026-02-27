/**
 * Typed API client for Orqestra.
 */
import type { EvidencePayload, ExecutionBundle } from "@orqestra/domain";

export interface OrqestraClientOptions {
  baseUrl: string;
}

export function createClient(options: OrqestraClientOptions) {
  const { baseUrl } = options;
  return {
    async getHealth(): Promise<{ status: string }> {
      const res = await fetch(`${baseUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async submitEvidence(payload: EvidencePayload): Promise<EvidencePayload & { id: string }> {
      const res = await fetch(`${baseUrl}/v1/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async getBundles(ticketId: string): Promise<{ bundles: ExecutionBundle[] }> {
      const res = await fetch(`${baseUrl}/v1/bundles?ticketId=${encodeURIComponent(ticketId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  };
}

export type OrqestraClient = ReturnType<typeof createClient>;
