import type { TicketProvider } from "./contract.js";
import { createJiraTicketProvider } from "./jira.js";
import { createLinearTicketProvider } from "./linear.js";
import { createStubTicketProvider } from "./stub.js";
import {
  getTicketProvider,
  getLinearApiKey,
  getJiraBaseUrl,
  getJiraEmail,
  getJiraApiToken,
} from "../../config.js";

export type { TicketProvider } from "./contract.js";
export type { TicketDto, ListTicketsQuery, AcceptanceCriterionDto } from "./types.js";

export function createTicketProvider(): TicketProvider {
  const kind = getTicketProvider();
  if (kind === "linear") {
    const key = getLinearApiKey();
    if (key) return createLinearTicketProvider(key);
  }
  if (kind === "jira") {
    const baseUrl = getJiraBaseUrl();
    const email = getJiraEmail();
    const apiToken = getJiraApiToken();
    if (baseUrl && email && apiToken)
      return createJiraTicketProvider({ baseUrl, email, apiToken });
  }
  return createStubTicketProvider();
}
