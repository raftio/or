import type { ExecutionBundle } from "../schemas/bundle.js";

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

export function createBundle(input: CreateBundleInput): ExecutionBundle {
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
  store.set(id, bundle);
  return bundle;
}

export function getBundle(id: string): ExecutionBundle | undefined {
  return store.get(id);
}

export function getBundlesByTicket(ticket_ref: string): ExecutionBundle[] {
  return Array.from(store.values()).filter(
    (b) => b.ticket_ref === ticket_ref
  );
}

/** Store a pre-built bundle (e.g. from bundling engine). Used for idempotency. */
export function storeBundle(bundle: ExecutionBundle): void {
  store.set(bundle.id, bundle);
}
