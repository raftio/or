/**
 * GitHub webhook: release / tag → create release and link tickets (RFC-019).
 * Verify X-Hub-Signature-256 with GITHUB_WEBHOOK_SECRET.
 */
import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getGitHubWebhookSecret, getGitHubToken } from "../../../config.js";
import * as outcomeStore from "../../../services/outcome-store.js";
import { extractTicketIdFromText } from "../../../adapters/git/extract-ticket.js";

const GITHUB_API = "https://api.github.com";

function verifySignature(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function getMergedPrsForRef(repo: string, ref: string, token: string): Promise<string[]> {
  const [owner, rep] = repo.split("/");
  if (!owner || !rep) return [];
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${repo}/commits?sha=${encodeURIComponent(ref)}&per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!res.ok) return [];
    const commits = (await res.json()) as Array<{ sha: string }>;
    const ticketIds = new Set<string>();
    for (const commit of commits.slice(0, 50)) {
      const prRes = await fetch(
        `${GITHUB_API}/repos/${repo}/commits/${commit.sha}/pulls`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!prRes.ok) continue;
      const prs = (await prRes.json()) as Array<{
        number: number;
        title?: string;
        body?: string | null;
        head?: { ref?: string };
      }>;
      for (const pr of prs) {
        const tid = extractTicketIdFromText(
          pr.title ?? "",
          pr.body ?? "",
          pr.head?.ref ?? ""
        );
        if (tid) ticketIds.add(tid);
      }
    }
    return [...ticketIds];
  } catch {
    return [];
  }
}

const app = new Hono();

app.post("/github", async (c) => {
  const secret = getGitHubWebhookSecret();
  if (!secret) {
    return c.json({ error: "GitHub webhook not configured" }, 503);
  }
  const rawBody = await c.req.text();
  const sig = c.req.header("X-Hub-Signature-256");
  if (!verifySignature(secret, rawBody, sig)) {
    return c.json({ error: "Invalid signature" }, 401);
  }
  let payload: {
    ref?: string;
    repository?: { full_name?: string };
    action?: string;
    release?: { tag_name?: string };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const repo = payload.repository?.full_name;
  if (!repo) {
    return c.json({ ok: true, message: "Ignored: no repository" });
  }

  let releaseId: string | null = null;
  let refForPrs: string | null = null;

  if (payload.release?.tag_name) {
    releaseId = `${repo}:${payload.release.tag_name}`;
    refForPrs = payload.release.tag_name;
  } else if (payload.ref?.startsWith("refs/tags/")) {
    const tag = payload.ref.replace(/^refs\/tags\//, "");
    releaseId = `${repo}:${tag}`;
    refForPrs = tag;
  }

  if (!releaseId) {
    return c.json({ ok: true, message: "Ignored: not a release or tag event" });
  }

  let ticketIds: string[] = [];
  const token = getGitHubToken();
  if (token && refForPrs) {
    ticketIds = await getMergedPrsForRef(repo, refForPrs, token);
  }

  outcomeStore.linkReleaseToTickets(releaseId, ticketIds);
  return c.json({
    ok: true,
    releaseId,
    ticket_ids: ticketIds,
  });
});

export default app;
