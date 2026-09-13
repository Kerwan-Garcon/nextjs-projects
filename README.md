# SAVE US

**AI might destroy us. Let's make it save us first.**

A collaborative research platform where humans and AI agents work on unsolved
real-world problems. Not a chatbot, not a feed: a place where a problem is
stated properly, a hypothesis is a structured object you can attack, and every
factual claim is traceable to a source.

The design rule everything else follows from: **a measured fact, a claim made by
a source, a human proposal, a machine proposal, an inference and an admitted gap
never look alike on screen.**

---

## Product overview

```
REAL WORLD PROBLEM → EVIDENCE → HUMAN HYPOTHESES → DISCUSSION
    → AI RESEARCH / CRITIQUE → VALIDATION → SCORING → BETTER HYPOTHESIS
```

| Surface                                 | What it is                                                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem board** (`/problems`)         | 21 documented, unsolved problems as missions: domain, geographic scope, difficulty, urgency, evidence count, active researchers, hypotheses, status. Filterable by domain, status, scope and difficulty. |
| **Problem detail** (`/problems/[slug]`) | The most important page. The problem, why it matters, constraints, measurable success criteria, evidence, current knowledge, open questions, hypotheses, live research, discussion.                      |
| **Hypothesis** (`/hypotheses/[id]`)     | Claim, mechanism, expected impact, required assumptions, declared unknowns, risks, cost, scalability, validation method — with supporting and contradicting evidence side by side.                       |
| **Research** (`/research`)              | Every agent run on the platform, the agent registry with each agent's tool permissions, and the ingestion curation queue.                                                                                |
| **Method** (`/research/method`)         | How claims are labelled, how contributions are scored, and exactly what is synthetic in this deployment.                                                                                                 |
| **Leaderboard** (`/leaderboard`)        | Global, weekly and per-domain standing; top problems; recent validations _and rejections_ — a well-reasoned rejection is a result.                                                                       |
| **My work / Profile**                   | A researcher's problems, hypotheses, evidence and a fully auditable reputation history. No credentials required or recorded.                                                                             |

### Rules the code enforces, not just documents

- **Nobody validates their own work.** `VALIDATED`, `REJECTED` and `PROMISING`
  are unreachable by an author or by the system; they require a recorded
  `Validation` against explicit criteria. Every other status is _derived_ from
  the evidence record (`deriveStatusFromEvidence`).
- **A statement claiming to be a fact must carry a source.** A `FACT` or
  `SOURCE_CLAIM` with no source degrades to `UNKNOWN` rather than rendering as
  established (`enforceSourceRequirement`, and the same check in
  `validateFindings`).
- **Agents cannot fabricate citations.** Every run is given an explicit list of
  citable source ids; citations outside it are stripped and counted on the run.
- **Nothing publishes itself.** Ingestion produces _candidates_ with a failed
  checklist attached. A named human curator decides, and approval only unlocks
  the problem editor.
- **Volume is not a path to standing.** A contribution's reputation award is
  damped by how much the same author has already posted on the same problem.

### What is real and what is DEMO DATA

The 141 seeded `Source` records reference **real, publicly available
publications, datasets and institutional programmes** — IPCC AR6, WHO fact
sheets, IEA sector analyses, IPBES assessments, the Charney report,
_The Limits to Growth_ (1972) and the later World3 comparisons, Hausfather et
al. (2020) on the skill of past climate projections, and so on. Titles,
publishers and URLs point at the actual publisher; where a permanent deep link
was not certain at seed time the URL points at the publisher's landing page for
that publication rather than at a guessed path.

`pnpm check:sources` verifies every seeded URL resolves — it is a command you
can run, not a claim in a README. Publishers behind bot protection answer 403 to
a script and 200 to a browser, so those are counted separately from a genuine
404; the run fails only on a document that has actually gone.

Everything else in the seed — hypotheses, discussion, researcher accounts,
reputation history, validation records — is written for the demonstration
dataset, stored with `origin = DEMO_SEED`, and marked **DEMO DATA** everywhere
it appears. No invented paper, DOI, author or finding is attributed to a real
publication anywhere in this repository.

---

## Architecture

```
apps/
  web/        Next.js 15 App Router. Server components dispatch into the API
              in-process; the browser talks to the same app over HTTP.
  api/        Hono + Zod. The whole HTTP surface, usable standalone so a future
              desktop or mobile client talks to exactly this API.
  worker/     Queue consumer: ingestion cycles and agent pipelines.

packages/
  common/     The domain. Enums, Zod schemas, the scoring engine, reputation,
              the epistemic layer, hypothesis lifecycle rules, source
              normalisation, the agent registry, URL/text/rate-limit security.
              No I/O, no framework, fully unit-tested.
  db/         Postgres schema, SQL migrations, Kysely types, the seed loader.
  agents/     AI provider port, search port, the agent runtime, research
              pipelines, the ingestion pipeline and its connectors.
  ui/         Design tokens and the interface primitives, including the
              epistemic components that make the labelling visible.
```

The boundaries are deliberate and one-directional:

```
ui ← web → api → agents → db → common
                    ↘_______________↗
```

`common` knows nothing about the database. `db` knows nothing about agents.
`agents` knows nothing about HTTP. AI code does not leak into the domain: the
scoring engine, the lifecycle rules and the publication gate are pure functions
that run identically with or without a model.

### The AI provider port

```ts
interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}
```

Two implementations ship:

- **`DeterministicProvider`** (default, no credentials needed). Computes
  findings from records already in the database — which sources were retrieved,
  which assumptions carry no evidence, which publisher the evidence base depends
  on, which constraint the hypothesis does not address — and writes `UNKNOWN`
  where the record is empty. It never asserts a fact it was not given. Its
  output is duller than a language model's and completely checkable; that trade
  is the point.
- **`AnthropicProvider`** (when `ANTHROPIC_API_KEY` is set). Same port, same
  validation: structured context in, Zod-validated findings out, citations
  whitelisted against the retrieval set, external text wrapped as untrusted data.

### Security posture

External documents and model output are untrusted input throughout:
Zod validation on every request body, output validation on every agent run, URL
validation that rejects non-HTTP schemes / embedded credentials / private and
link-local hosts, connector host allowlists, prompt-injection detection that
_flags rather than silently strips_, per-agent tool permissions enforced at the
runtime boundary, per-identity rate limits (stricter for agent runs than for
writes), and an append-only `audit_log` for every write and every agent run.

---

## Setup

Requirements: **Node 20.11+**, **pnpm 10+**, **PostgreSQL 14+**. Redis is
optional.

```bash
# 1. Dependencies
pnpm install

# 2. Environment
cp .env.example .env      # then set APP_SECRET, and DATABASE_URL if needed

# 3. Database: create the schema and load the demonstration dataset
createdb saveus           # or: psql -c 'CREATE DATABASE saveus'
pnpm db:reset
pnpm db:seed

# 4. Run
pnpm dev                  # http://localhost:3000
```

`pnpm setup` runs steps 1, 3 and 4's prerequisites in one go.

The app is fully usable straight after seeding: open a problem, read its
evidence, open a hypothesis, contribute, run an AI research action, watch the
reputation change. No empty states, no placeholder text, no buttons that do
nothing.

### Environment variables

| Variable            | Required          | Purpose                                                                                                         |
| ------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | yes               | Postgres connection string. Defaults to `postgres://saveus:saveus@127.0.0.1:5432/saveus`.                       |
| `APP_SECRET`        | yes in production | HMAC key for session cookies. `openssl rand -base64 32`.                                                        |
| `TEST_DATABASE_URL` | for API tests     | A **separate** database; the suite drops and recreates its schema.                                              |
| `ANTHROPIC_API_KEY` | no                | Switches agent runs to the Anthropic provider. Without it everything still works on the deterministic provider. |
| `ANTHROPIC_MODEL`   | no                | Defaults to `claude-opus-5`.                                                                                    |
| `AI_PROVIDER`       | no                | Set to `deterministic` to force the offline provider even with a key present.                                   |
| `REDIS_URL`         | no                | Switches the worker queue from in-memory to Redis.                                                              |
| `PORT`              | no                | Port for the standalone API server (`apps/api`).                                                                |

### Database

Plain SQL migrations in `packages/db/src/migrations`, applied in filename order
and recorded in `_migrations`. No migration DSL: the schema is reviewable as
SQL.

```bash
pnpm db:migrate   # apply pending migrations
pnpm db:reset     # drop the public schema and re-apply everything
pnpm db:seed      # load the demonstration dataset, then run the demo pipelines
```

`db:seed` runs in two stages. The first loads domains, agents, users, sources,
problems, hypotheses, evidence, contributions, comments, endorsements,
validations and reputation events. The second (`@saveus/worker seed:research`)
produces the demo agent runs by **actually executing the pipelines** against the
seeded corpus — so every finding on screen was computed from records that are in
the database, by an agent whose permissions are recorded, in a run you can open.

Seed volume: 11 domains · 11 agents · 20 researchers · 141 sources ·
21 problems · 53 hypotheses · ~174 evidence links · ~255 contributions ·
~101 replies · 5 research sessions · 11 agent runs · ~77 findings ·
7 ingestion candidates · ~450 reputation events.

---

## Agent architecture

Eleven narrow agents, not one omnipotent one. Each declares the tools it may use
and what it may write; the runtime refuses anything outside that declaration, so
"the model decided to" is never an explanation for a write that should not have
happened.

| Agent         | Mission                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `SCOUT`       | Surface situations that may contain an unsolved, well-posed problem.    |
| `RESEARCHER`  | Retrieve the literature, datasets and existing work bearing on a claim. |
| `SYNTHESIZER` | Turn a set of runs into one structured state of the question.           |
| `SCIENTIST`   | Assess whether the proposed mechanism is plausible.                     |
| `ENGINEER`    | Confront the proposal with the problem's deployment constraints.        |
| `ECONOMIST`   | Cost, who pays, and whether the incentives permit adoption.             |
| `SKEPTIC`     | Find the weaknesses, the missing evidence and the contradictions.       |
| `RED_TEAM`    | Construct the conditions under which it fails.                          |
| `SIMULATOR`   | Run registered models — and report `UNKNOWN` when none exists.          |
| `EDITOR`      | Improve readability without removing a qualifier or a source.           |
| `CURATOR`     | Apply the publication checklist. It can block; it cannot publish.       |

**Contextual actions, never one "Ask AI" button.** Each action on a hypothesis
names the pipeline it runs:

| Action                   | Pipeline                                            |
| ------------------------ | --------------------------------------------------- |
| Find evidence            | `RESEARCHER`                                        |
| Find counterevidence     | `RESEARCHER → SKEPTIC`                              |
| Identify assumptions     | `SCIENTIST → SKEPTIC`                               |
| Red team this            | `RED_TEAM → SKEPTIC`                                |
| Generate a test          | `ENGINEER → SIMULATOR`                              |
| Compare with existing    | `RESEARCHER → ECONOMIST`                            |
| **Full research review** | **`RESEARCHER → SKEPTIC → ENGINEER → SYNTHESIZER`** |

Every run records its agent, provider, model, input digest, duration, token
counts, findings and errors. Every finding carries its epistemic kind, its
confidence, its sources, its reasoning and what it could not resolve.

---

## Extending the platform

### Add a source connector

1. Implement the port in `packages/agents/src/ingestion/connectors/`:

   ```ts
   export class MyConnector implements SourceConnector {
     readonly name = 'my-connector';
     readonly description = 'What this feed is.';
     // Documents from any other host are rejected at normalisation.
     readonly allowedHosts = ['example.org'];

     async fetch(): Promise<RawDocument[]> {
       return [
         /* externalId, title, url, publisher, publishedAt, body,
                  bodyProvenance, suggestedDomains */
       ];
     }
   }
   ```

2. Register it in `DEFAULT_CONNECTORS` (same directory), or pass it to
   `runIngestion({ db, connectors })` for a one-off run.

Nothing else changes: the pipeline normalises, deduplicates, classifies,
extracts claims, decides whether an open problem is present, drafts a candidate
and scores it against the publication checklist. The candidate lands in the
curation queue with its failing checks attached. It never becomes a public
problem on its own.

### Add an AI agent

1. Add the role to `AgentRole` in `packages/common/src/domain/enums.ts`.
2. Add the definition to `AGENTS` in `packages/common/src/domain/agents.ts` —
   mission, description, the tools it may use, its permissions (including
   `maxFindings`), and its role instructions.
3. Teach the deterministic provider what the role computes, in
   `packages/agents/src/provider/deterministic.ts`. The switch is exhaustive, so
   TypeScript will tell you exactly where.
4. Put it in a pipeline in `ACTION_PIPELINES`
   (`packages/agents/src/pipeline.ts`), or give it a new `ResearchAction`.
5. Re-run `pnpm db:reset && pnpm db:seed` so the `agents` table carries the new
   row and its permissions.

### Add a problem domain

1. Add the key to `DomainKey` in `packages/common/src/domain/enums.ts`.
2. Add the label, description and accent colour to `DOMAIN_REFERENCE` in
   `packages/db/src/seed/domains.ts`.
3. Add keywords to `DOMAIN_KEYWORDS` in
   `packages/agents/src/ingestion/pipeline.ts` so ingestion can classify into it.
4. Re-seed, or insert the `domains` row directly.

The board filter, the leaderboard scope, the profile and the domain accent all
read from that one row.

### Add a problem

Problems reach the board one of two ways: a curator writes one (the ingestion
queue leads here), or one is added to `packages/db/src/seed/problems.ts` and the
database is re-seeded. `evaluateProblemCandidate` is the gate either way — at
least three distinct sources, at least one high-reliability publisher, at least
one _quantified_ consequence traceable to a source, measurable success criteria,
and constraints on at least two dimensions.

---

## Testing

```bash
pnpm typecheck     # every package, strict, no `any`
pnpm lint          # eslint, `any` banned
pnpm test          # unit + API tests (vitest)
pnpm test:unit     # domain only: scoring, reputation, epistemics, sources, security
pnpm test:api      # HTTP surface against a real Postgres (TEST_DATABASE_URL)
pnpm test:e2e      # Playwright happy path against the production build
pnpm verify        # typecheck + lint + test
```

| Suite                   | Covers                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/common/tests` | Scoring weights and volume damping, reputation tiers, confidence from evidence, the validation gate, hypothesis lifecycle transitions, URL and source normalisation, deduplication, SHA-256 vectors, prompt-injection flagging, rate limits, the problem publication checklist.                                                |
| `packages/agents/tests` | Agent registry and tool permissions, output validation and citation whitelisting, every role's deterministic behaviour, prompt construction and untrusted-text wrapping, JSON extraction.                                                                                                                                      |
| `apps/api/tests`        | The HTTP surface against a real seeded database: filters, epistemic invariants on responses, auth, contribution scoring and damping, the self-validation ban, evidence attachment and status derivation, private-host rejection, the full-review pipeline, agent-run rate limiting, leaderboard ordering, profiles, ingestion. |
| `tests/e2e`             | The journey: sign in → board → problem → hypothesis → contribute → run a research action → inspect the agent run → see it in the record.                                                                                                                                                                                       |

The API suite needs `TEST_DATABASE_URL` pointing at a database it may drop.

---

## Designed for, not built yet

The architecture leaves room for — without implementing — scientist-verified
problems, organisations submitting problems, automated research scouts,
simulations, external datasets, citizen science, bounties, grants, expert
review, real-world experiments, a desktop client, mobile, and open APIs. The
two decisions that keep those open: the API is a standalone Hono app that Next
merely mounts, and every collaborative surface already reads from queryable
activity records, so polling can become realtime without a data model change.

## Product tone

Serious, curious, ambitious, scientific, direct. Optimistic without being naive.
Not doomer, not guilt-driven, not a sustainability brochure.

> Humanity has enormous intelligence distributed across billions of people. We
> currently waste most of it. SAVE US exists to organise that intelligence.

If something cannot be verified, the platform says **UNKNOWN**.
