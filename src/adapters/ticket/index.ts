import type { TicketProvider } from "./contract.js";
import { createLinearTicketProvider } from "./linear.js";
import { createStubTicketProvider } from "./stub.js";
import { getTicketProvider, getLinearApiKey } from "../../config.js";

export type { TicketProvider } from "./contract.js";
export type { TicketDto, ListTicketsQuery, AcceptanceCriterionDto } from "./types.js";

export function createTicketProvider(): TicketProvider {
  const kind = getTicketProvider();
  if (kind === "linear") {
    const key = getLinearApiKey();
    if (key) return createLinearTicketProvider(key);
  }
  return createStubTicketProvider();
}
