/**
 * Extract ticket id from PR title, description, or branch name.
 * Patterns: PROJ-123, feature/PROJ-123-xxx, PROJ-123: title, [PROJ-123]
 */
const TICKET_PATTERN = /(?:^|[\s\/\[:\]])([A-Z][A-Z0-9]*-[0-9]+)(?=[\s\/\]:]|$)/gi;

export function extractTicketIdFromText(
  title: string,
  description: string,
  branchName: string
): string | null {
  const combined = [title, description, branchName].filter(Boolean).join(" ");
  const match = TICKET_PATTERN.exec(combined);
  TICKET_PATTERN.lastIndex = 0;
  return match ? match[1]!.toUpperCase() : null;
}
