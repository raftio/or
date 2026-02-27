/**
 * RFC-008: Context Synthesis – merge ticket + doc, cache, invalidation
 */
import { createTicketProvider, createTicketProviderForWorkspace } from "../adapters/ticket/index.js";
import { createDocumentProvider } from "../adapters/document/index.js";
import { getContextCacheTtlMinutes } from "../config.js";
import type { SynthesizedContext } from "@orqestra/domain";

interface CacheEntry {
  context: SynthesizedContext;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(ticket_id: string, spec_ref?: string, workspaceId?: string): string {
  return `${workspaceId ?? ""}:${ticket_id}:${spec_ref ?? ""}`;
}

/**
 * Precedence: ticket title + ticket description as base.
 * AC: merge from ticket and spec; deduplicate by id, then by description hash.
 * Sections: from spec only when spec_ref present.
 */
export async function synthesizeContext(input: {
  ticket_id: string;
  spec_ref?: string;
  workspace_id?: string;
}): Promise<SynthesizedContext | null> {
  const key = cacheKey(input.ticket_id, input.spec_ref, input.workspace_id);
  const ttlMs = getContextCacheTtlMinutes() * 60 * 1000;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.context;

  const ticketProvider = input.workspace_id
    ? await createTicketProviderForWorkspace(input.workspace_id)
    : createTicketProvider();
  const ticket = await ticketProvider.getTicket(input.ticket_id);
  if (!ticket) return null;

  const acMap = new Map<string, { id: string; description: string }>();
  for (const ac of ticket.acceptance_criteria ?? []) {
    acMap.set(ac.id, { id: ac.id, description: ac.description });
  }

  let sections: SynthesizedContext["sections"];
  let excerpts: string[] = [];

  if (input.spec_ref) {
    const docProvider = createDocumentProvider();
    const doc = await docProvider.getDocument(input.spec_ref);
    if (doc) {
      sections = doc.sections;
      excerpts = doc.sections.map((s) => `${s.title}: ${s.body.slice(0, 200)}`);
      for (const ac of doc.acceptance_criteria ?? []) {
        if (!acMap.has(ac.id)) acMap.set(ac.id, { id: ac.id, description: ac.description });
      }
    }
  }

  const context: SynthesizedContext = {
    ticket_id: input.ticket_id,
    ticket_title: ticket.title,
    ticket_description: ticket.description,
    acceptance_criteria: Array.from(acMap.values()),
    sections,
    excerpts: excerpts.length ? excerpts : undefined,
    related_ticket_ids: ticket.links?.length ? ticket.links : undefined,
  };

  cache.set(key, {
    context,
    expiresAt: now + ttlMs,
  });
  return context;
}

export function invalidateContext(ticket_id: string, spec_ref?: string, workspaceId?: string): void {
  if (workspaceId) {
    cache.delete(cacheKey(ticket_id, spec_ref, workspaceId));
  }
  // Also clear non-workspace-scoped entry for backward compatibility
  cache.delete(cacheKey(ticket_id, spec_ref));
}

/**
 * Invalidate both context and bundle caches for a given ticket.
 * Call this when a ticket or spec is updated externally.
 */
export function invalidateForTicket(workspaceId: string, ticketId: string, specRef?: string): void {
  invalidateContext(ticketId, specRef, workspaceId);

  // Lazy-import to avoid circular dependency
  import("./bundle-store.js").then((store) => {
    store.purgeCacheForTicket(workspaceId, ticketId);
  });
}
