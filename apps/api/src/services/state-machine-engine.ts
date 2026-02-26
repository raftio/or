/**
 * RFC-007: State machine engine – transitions, store, idempotency
 */
import {
  FlowState,
  type FlowStateType,
  type FlowEventType,
  type FlowEventPayload,
} from "@orqestra/domain";

const INITIAL_STATE: FlowStateType = FlowState.Intent;

/** (currentState, event) -> nextState; empty means no transition (no-op) */
const TRANSITIONS: ReadonlyMap<string, FlowStateType> = new Map([
  [`${FlowState.Intent}:spec_ready`, FlowState.Bundled],
  [`${FlowState.Intent}:ticket_created`, FlowState.Intent],
  [`${FlowState.Bundled}:dev_started`, FlowState.InProgress],
  [`${FlowState.Bundled}:spec_updated`, FlowState.Intent],
  [`${FlowState.InProgress}:pr_opened_or_updated`, FlowState.EvidenceSubmitted],
  [`${FlowState.InProgress}:pr_opened`, FlowState.EvidenceSubmitted],
  [`${FlowState.InProgress}:pr_updated`, FlowState.EvidenceSubmitted],
  [`${FlowState.EvidenceSubmitted}:evidence_validated`, FlowState.Validated],
  [`${FlowState.EvidenceSubmitted}:validation_failed`, FlowState.InProgress],
  [`${FlowState.Validated}:pr_merged`, FlowState.Released],
  [`${FlowState.Released}:metrics_collected`, FlowState.OutcomeMeasured],
  [`${FlowState.OutcomeMeasured}:feedback_applied`, FlowState.Intent],
]);

const DEFAULT_TENANT = "default";

function tk(tenantId: string, id: string): string {
  return `${tenantId}:${id}`;
}

const ticketStore = new Map<
  string,
  { state: FlowStateType; updated_at: string }
>();
const processedEventIds = new Set<string>();

function now(): string {
  return new Date().toISOString();
}

function transitionKey(state: FlowStateType, event: FlowEventType): string {
  return `${state}:${event}`;
}

export interface TicketStateResult {
  state: FlowStateType;
  updated_at: string;
}

export function getState(
  ticket_id: string,
  tenantId: string = DEFAULT_TENANT
): TicketStateResult | null {
  const entry = ticketStore.get(tk(tenantId, ticket_id));
  if (!entry) return null;
  return { state: entry.state, updated_at: entry.updated_at };
}

export interface ProcessEventResult {
  state: FlowStateType;
  previous_state: FlowStateType;
  transitioned: boolean;
}

export function processEvent(
  ticket_id: string,
  event: FlowEventType,
  payload?: FlowEventPayload,
  tenantId: string = DEFAULT_TENANT
): ProcessEventResult {
  const event_id = payload?.event_id;
  const eventKey = event_id ? tk(tenantId, event_id) : null;
  if (eventKey && processedEventIds.has(eventKey)) {
    const entry = ticketStore.get(tk(tenantId, ticket_id));
    const state = entry?.state ?? INITIAL_STATE;
    return {
      state,
      previous_state: state,
      transitioned: false,
    };
  }

  const storeKey = tk(tenantId, ticket_id);
  const currentEntry = ticketStore.get(storeKey);
  const currentState: FlowStateType = currentEntry?.state ?? INITIAL_STATE;
  const key = transitionKey(currentState, event);
  const nextState = TRANSITIONS.get(key);

  if (nextState == null) {
    if (!currentEntry) {
      ticketStore.set(storeKey, {
        state: INITIAL_STATE,
        updated_at: now(),
      });
    }
    return {
      state: currentState,
      previous_state: currentState,
      transitioned: false,
    };
  }

  const updated_at = now();
  ticketStore.set(storeKey, { state: nextState, updated_at });
  if (eventKey) processedEventIds.add(eventKey);

  return {
    state: nextState,
    previous_state: currentState,
    transitioned: true,
  };
}
