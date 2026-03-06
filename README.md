# OR

OR is an AI-powered control plane for product-driven engineering teams.

## Concept

### The problem

AI coding tools (Copilot, Cursor, agent IDEs) have dramatically increased code output — more PRs, more lines changed — but overall product cycle time has not improved proportionally.

The bottleneck has shifted from *writing code* to *workflow orchestration and context management*.

The root issue is structural: AI accelerates the middle of the pipeline but leaves the upstream (spec clarity, acceptance criteria) and downstream (validation, measurement) stages unchanged. You get more code, but not more outcomes.

### What OR does

OR introduces a structured workflow layer that sits between product intent and execution:

```
Intent → Execution → Evidence → Outcome → Feedback
```

It connects and coordinates the tools teams already use — Jira, Linear, Confluence, Notion, GitHub, GitLab, CI/CD, IDEs — rather than replacing them.

**Control Plane** (OR): context synthesis, execution planning, evidence validation, outcome tracking.
**Execution Plane** (your tools): code editors, Git, CI/CD, test frameworks — OR coordinates and validates this layer, not replaces it.

### Core concepts

| Concept | Description |
|---------|-------------|
| **Execution Bundle** | A structured, machine-readable execution plan derived from a ticket + spec. Contains tasks, dependencies, acceptance criteria, and relevant context. Input for AI-assisted development in the IDE. |
| **Context Synthesis** | OR pulls context from tickets, documents (Confluence/Notion), and code to produce a unified context for each bundle — reducing the manual reconstruction that happens at every handoff. |
| **Acceptance Criteria Traceability** | Criteria are linked from requirement through to code diffs and test coverage, making them programmatically verifiable rather than free-text checklists. |
| **Evidence** | Structured payload capturing test results, coverage, CI status, and validation signals — ingested from CI/CD pipelines and submitted from the IDE. |
| **Evidence Validation** | Before human review, OR validates whether the evidence satisfies the bundle's acceptance criteria, reducing review bottlenecks and clarification loops. |
| **Outcome Feedback Loop** | Post-release KPI signals are tied back to the bundle and the original spec, closing the loop from idea to measurable outcome and feeding insights into the next cycle. |

### Flow

```
Idea → Spec → Ticket
                ↓
         [OR: Context Synthesis]
                ↓
         Execution Bundle ──→ Dev (IDE + AI)
                                    ↓
                                   PR → CI
                                         ↓
                              [OR: Evidence Validation]
                                         ↓
                                      Release → Measure
                                                  ↓
                              [OR: Outcome Tracking]
                                                  ↓
                                              Feedback ──→ (next Idea)
```

For the full architecture and RFC index, see [docs/orca.md](docs/orca.md) and [docs/rfc/](docs/rfc/).

---

Control Plane for the product flow: Intent → Execution → Evidence → Outcome → Feedback. Orchestrates workspaces, tickets, execution bundles, evidence, and AI-assisted chat.

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (with pgvector for vector search)

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` in `apps/api` and fill in the required values (at minimum `DATABASE_URL` and `JWT_SECRET`).

## Development

```bash
pnpm dev          # build packages + run API with hot reload
pnpm dev:web      # run Next.js web app
pnpm dev:worker   # run background worker
```

API runs at `http://localhost:3000`.

## Build and run

```bash
pnpm build
pnpm start   # starts @or/api
```

## Configuration (env)

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | JWT signing secret (min 16 chars) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_DATABASE_URL` | `DATABASE_URL` | Separate DB for pgvector (falls back to `DATABASE_URL`) |
| `AI_DECOMPOSER_PROVIDER` | `stub` | `stub`, `openai`, or `anthropic` — AI bundle decomposition |
| `AI_DECOMPOSER_MODEL` | provider default | Override decomposer model |
| `AI_CHAT_PROVIDER` | `stub` | `stub`, `openai`, or `anthropic` — AI chat agent |
| `AI_CHAT_MODEL` | provider default | Override chat model (`gpt-4o-mini` / `claude-sonnet-4-20250514`) |
| `OPENAI_API_KEY` | — | Required for OpenAI providers |
| `ANTHROPIC_API_KEY` | — | Required for Anthropic providers |
| `CONTEXT_CACHE_TTL_MINUTES` | `5` | Context synthesis cache TTL |

## Packages

| Package | Description |
|---------|-------------|
| `@or/agent` | Standalone AI chat agent (provider-agnostic, streamable) |
| `@or/domain` | Shared Zod schemas and types |
| `@or/sdk` | Typed API client |
| `@or/code-chunker` | Code chunking for vector indexing |
| `@or/ui` | Shared UI components (used by `@or/web`) |

## Apps

| App | Description |
|-----|-------------|
| `@or/api` | Hono API server |
| `@or/web` | Next.js web dashboard |
| `@or/worker` | Background worker |

## License

See [LICENSE](LICENSE).
