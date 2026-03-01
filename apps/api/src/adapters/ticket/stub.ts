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

const STUB_TITLES = [
  "Implement user authentication flow",
  "Add dark mode toggle to settings",
  "Refactor database connection pooling",
  "Build notification system for events",
  "Create dashboard analytics widgets",
  "Fix pagination in search results",
  "Add CSV export for reports",
  "Implement role-based access control",
  "Set up CI/CD pipeline for staging",
  "Add WebSocket support for real-time updates",
  "Migrate legacy API to REST v2",
  "Build onboarding wizard for new users",
  "Add multi-language support (i18n)",
  "Implement file upload with drag-and-drop",
  "Create audit log for admin actions",
  "Add two-factor authentication",
  "Build API rate limiting middleware",
  "Implement full-text search with filters",
  "Add automated backup scheduling",
  "Create Slack integration for alerts",
];

function stableStubTitle(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return STUB_TITLES[Math.abs(hash) % STUB_TITLES.length];
}

export function createStubTicketProvider(): TicketProvider {
  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      const key = id.toUpperCase().replace(/\s/g, "-");
      const ticket = MOCK_TICKETS[key];
      if (ticket) return { ...ticket };
      return {
        id: key.toLowerCase(),
        key,
        title: stableStubTitle(id),
        description: `Mock description for ${id}`,
        status: "Todo",
        acceptance_criteria: [{ id: `${key}/ac/1`, description: "Default AC" }],
        links: [],
        updated_at: new Date().toISOString(),
      };
    },
  };
}
