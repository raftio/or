/**
 * Stub ticket provider for dev without API keys
 */
import type { TicketProvider } from "./contract.js";
import type { TicketDto } from "./types.js";

const MOCK_TICKETS: Record<string, TicketDto> = {
  "PROJ-1": {
    id: "proj-1",
    key: "PROJ-1",
    title: "Implement user login",
    description: "Add email/password login with session handling.",
    status: "Todo",
    acceptance_criteria: [
      { id: "PROJ-1/ac/1", description: "User can log in with valid credentials" },
      { id: "PROJ-1/ac/2", description: "Invalid credentials show error message" },
    ],
    links: [],
    updated_at: new Date().toISOString(),
  },
  "PROJ-123": {
    id: "proj-123",
    key: "PROJ-123",
    title: "Sample feature ticket",
    description: "Sample description for bundle creation.",
    status: "Backlog",
    acceptance_criteria: [
      { id: "PROJ-123/ac/1", description: "Feature works as specified in spec" },
    ],
    links: [],
    updated_at: new Date().toISOString(),
  },
};

export function createStubTicketProvider(): TicketProvider {
  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      const key = id.toUpperCase().replace(/\s/g, "-");
      const ticket = MOCK_TICKETS[key];
      if (ticket) return { ...ticket };
      return {
        id: key.toLowerCase(),
        key,
        title: `Ticket ${id}`,
        description: `Mock description for ${id}`,
        status: "Todo",
        acceptance_criteria: [{ id: `${key}/ac/1`, description: "Default AC" }],
        links: [],
        updated_at: new Date().toISOString(),
      };
    },
  };
}
