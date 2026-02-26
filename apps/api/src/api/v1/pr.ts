import { Hono } from "hono";
import { createGitProvider } from "../../adapters/git/index.js";

const app = new Hono();

app.get("/pr", async (c) => {
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");
  if (!repo || !prId) {
    return c.json({ error: "repo and prId query required" }, 400);
  }
  const provider = createGitProvider();
  const pr = await provider.getPullRequest(repo, prId);
  if (!pr) {
    return c.json({ error: "PR not found" }, 404);
  }
  const ticket_id = provider.extractTicketId(pr);
  return c.json({ ...pr, ticket_id });
});

export default app;
