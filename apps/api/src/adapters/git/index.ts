import type { GitProvider } from "./contract.js";
import { createGitHubGitProvider } from "./github.js";
import { createStubGitProvider } from "./stub.js";
import { getGitProvider, getGitHubToken } from "../../config.js";

export type { GitProvider } from "./contract.js";
export type { PullRequestDto, PullRequestState } from "./types.js";
export { extractTicketIdFromText } from "./extract-ticket.js";

export function createGitProvider(): GitProvider {
  const kind = getGitProvider();
  if (kind === "github") {
    const token = getGitHubToken();
    if (token) return createGitHubGitProvider(token);
  }
  return createStubGitProvider();
}
