import type { ExecutionBundle } from "@orqestra/domain";

const DEFAULT_TENANT = "default";

function tk(tenantId: string, id: string): string {
  return `${tenantId}:${id}`;
}

export interface CreateBundleInput {
  ticket_ref: string;
  spec_ref?: string;
  tasks?: ExecutionBundle["tasks"];
  dependencies?: ExecutionBundle["dependencies"];
  acceptance_criteria_refs?: string[];
  context?: ExecutionBundle["context"];
}

const store = new Map<string, ExecutionBundle>();

function now(): string {
  return new Date().toISOString();
}

export function createBundle(
  input: CreateBundleInput,
  tenantId: string = DEFAULT_TENANT
): ExecutionBundle {
  const id = crypto.randomUUID();
  const version = 1;
  const created_at = now();
  const updated_at = created_at;
  const bundle: ExecutionBundle = {
    id,
    version,
    spec_ref: input.spec_ref ?? "",
    ticket_ref: input.ticket_ref,
    tasks: input.tasks ?? [],
    dependencies: input.dependencies,
    acceptance_criteria_refs: input.acceptance_criteria_refs ?? [],
    context: input.context,
    created_at,
    updated_at,
  };
  store.set(tk(tenantId, id), bundle);
  return bundle;
}

export function getBundle(
  id: string,
  tenantId: string = DEFAULT_TENANT
): ExecutionBundle | undefined {
  return store.get(tk(tenantId, id));
}

export function getBundlesByTicket(
  ticket_ref: string,
  tenantId: string = DEFAULT_TENANT
): ExecutionBundle[] {
  const prefix = tenantId + ":";
  return Array.from(store.entries())
    .filter(([k]) => k.startsWith(prefix))
    .map(([, b]) => b)
    .filter((b) => b.ticket_ref === ticket_ref);
}

/** Store a pre-built bundle (e.g. from bundling engine). Used for idempotency. */
export function storeBundle(
  bundle: ExecutionBundle,
  tenantId: string = DEFAULT_TENANT
): void {
  store.set(tk(tenantId, bundle.id), bundle);
}
