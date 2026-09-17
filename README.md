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
| **Learn** (`/learn`)                    | 6 free interactive courses, 18 lessons: how to work here, and the systems themselves. Written in the product's own notation, cited to the same source library, open with no account.                      |
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
  checklist attached. A named human curator decides, approval only unlocks the
  problem editor, and the checklist runs again on the server against what the
  curator wrote.
- **An open question with nothing riding on it is not a problem.** The intake
  gate requires gap language *and* stated stakes *and* a societal subject before
  a document reaches a human, and records the verdict on everything it refused.
- **Volume is not a path to standing.** A contribution's reputation award is
  damped by how much the same author has already posted on the same problem.
- **Reading is not contributing.** Finishing a lesson records that you read it
  and awards no reputation. Standing comes from research other people can check,
  and the API test suite asserts that no reputation event exists after a lesson
  is completed.
- **A publisher who says "wait" is not asked again.** `Retry-After` puts the
  whole host on a cooldown that survives the process, so a refusal from one
  endpoint stops the requests queued behind it and the next day's cycle too.

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
| `PUBLIC_APP_URL`      | for Google sign-in | Public origin of the web app. Builds the OAuth redirect URI and bounds where a sign-in may return to. Defaults to `http://localhost:3000`. |
| `GOOGLE_CLIENT_ID`     | no | Enables Google sign-in. Without it (or without the secret) the button is simply absent.                                        |
| `GOOGLE_CLIENT_SECRET` | no | Paired with the client id. Half-configured counts as unconfigured.                                                             |
| `INTAKE_LIVE`       | no                | `true` makes the worker fetch real feeds. Off by default: tests and CI never touch the network.                 |
| `INTAKE_HOUR_UTC`   | no                | UTC hour for the daily intake cycle. Default `5`.                                                               |
| `INTAKE_USER_AGENT` | no                | Sent on every outbound intake request. Put a real contact address in it.                                        |

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
6 ingestion candidates · ~450 reputation events.

---

## Identity

There are still no passwords. What the platform needs is a stable, credited
author for a contribution, not proof of who somebody is, and an anonymous
account is worth exactly as much reputation as any other.

Two doors:

- **A handle.** Pick one, or take a seeded demo identity to look around.
- **Google.** Optional, and absent from the sign-in page unless both
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set — half-configured counts
  as unconfigured, because a sign-in button that leads to an error is worse than
  no button.

Google sign-in exists because "pick a handle" is a poor door for anyone
returning on a second device, not because the platform wants an identity
document. It asks for `openid email profile` and nothing else. The address is
never shown on the board; a handle derived from it is.

It is the authorization-code flow with PKCE, written out rather than pulled from
a library, because each of its four steps has to be done exactly right and a
dependency would hide which of them this code performs:

- the PKCE verifier never leaves the server — only its SHA-256 goes to Google;
- `state` is stored server-side with an expiry and **deleted on use**, so a
  replayed callback finds nothing;
- `nonce` is echoed in the ID token, tying it to this authorisation request;
- the ID token is fully verified: RS256 signature against Google's published
  keys (cached per their `Cache-Control`), then issuer, audience, expiry and
  nonce. TLS to the token endpoint arguably makes the signature check redundant;
  doing it anyway costs one cached request and removes the argument.
- the post-sign-in redirect accepts a path on this app and nothing else. An open
  redirect on a sign-in endpoint is the classic way to make a phishing link look
  genuine.

The provider's **subject** is the link, never the email: an email can be
reassigned, and Google says so. An unverified address cannot claim an account,
and a handle-only account is never claimed by an email — nobody proved they own
that handle.

`apps/api/tests/google-oauth.test.ts` mints its own RSA key and forges its own
tokens, so the whole verification path runs for real: a token with the wrong
audience, the wrong issuer, the wrong nonce, `alg: none`, a past expiry, or a
signature from a key Google does not publish is refused by the same code that
will see Google's.

---

## Daily problem intake

The board is fed by a scheduled pipeline that reads real publishers, not by
someone pasting links. It is off by default (`INTAKE_LIVE=true` turns it on) and
it runs once a day, because a daily feed published once a day does not reward
being fetched more often.

```
FETCH → NORMALIZE → DEDUPLICATE → CLASSIFY → ASSESS RELEVANCE
      → EXTRACT CLAIMS → IDENTIFY OPEN PROBLEMS → GENERATE CANDIDATE
      → CURATE (human) → PUBLISH (human)
```

### Where it reads

| Connector             | Source                                                           | Why                                                                                        |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `institutional-feeds` | WHO, UNEP, EEA newsroom feeds                                     | Assessments and policy publications, which is where institutions state what they cannot yet do. |
| `journal-feeds`       | Nature, Nature Climate Change, The Lancet Planetary Health        | Peer-reviewed tables of contents. Low yield by design — most of a journal issue is commentary — but high value when it lands. |
| `analysis-feeds`      | Carbon Brief                                                      | Specialist analysis. Classified MEDIUM reliability; useful for framing, never as the only source. |
| `europepmc`           | Europe PMC REST API, open-access filtered                         | The highest-signal source in the set: an abstract is where authors state their own limitations. |

There is no HTML scraping anywhere in it. Scraping a page that was not offered
for machine reading is fragile, rude, and the first thing to break.

**OpenAlex was dropped.** It was the obvious choice for the scholarly connector
and it now meters requests against a paid budget, answering with
`Insufficient budget`. Europe PMC is free, needs no key, and returns real
abstracts. Semantic Scholar rate-limited anonymous requests; Crossref works but
its abstract coverage is too thin for a filter that reads abstracts.

### The relevance gate

The way an automated problem feed fails is not by fetching too little. It is by
filling the board with announcements that look like problems. So intake is a
gate, not a funnel, and a document has to answer three questions:

1. **Is something unresolved?** Gap language — *remains unclear*, *has not been
   quantified*, *knowledge gap*, *no consensus*.
2. **Does anything ride on it?** Stakes — mortality, exposure, scarcity, loss,
   contamination, resistance, displacement.
3. **Is the subject societal?** The title has to name a consequence or a
   population, not a technique, a molecule or a specimen.

Plus outright disqualifiers: awards, appointments, partnership signings,
obituaries, webinars, corrections, launches, study protocols, taxonomic records,
genomic surveys, method papers.

The second and third questions exist because of what the first run against live
literature actually returned. Searching for gap language alone surfaces
excellent science that is not a problem for this board — a novel record of a
brown hyaena in a national park, xylem sap metabolomics in two bean genotypes, a
silage substitution trial. Every one of those states an open question; none is
something anybody needs solved. Those exact documents are now test cases in
`packages/common/tests/intake.test.ts`.

A representative live cycle:

```
institutional-feeds  fetched 60 →  1 queued   (34 narrow subject, 15 no gap, 6 too thin)
journal-feeds        fetched 51 →  0 queued   (24 narrow subject, 12 disqualified, 12 too thin)
analysis-feeds       fetched 12 →  2 queued
europepmc            fetched 70 → 10 queued   (17 held over the per-run cap)
```

**A cycle that fetches sixty documents and queues one is the filter working.**
Every fetched document is stored with the verdict it received, its score and the
signals that fired, and the rejected panel on `/research` shows them — so the
filter is tuned against what it actually discarded, not against a guess.

Only `ACCEPT` reaches the queue. `WEAK` is recorded in full and visible in the
health panel, but a curator's attention is a scarce resource and filling their
queue with things the gate itself doubts is how it stops being read. Each
connector may add at most `MAX_CANDIDATES_PER_RUN` candidates per cycle,
highest-scoring first; the rest wait for the next cycle.

### Being a good citizen of other people's servers

`HttpFetcher` is deliberately conservative: one request at a time per host with
a minimum gap, a User-Agent naming the project and a contact address,
conditional requests so an unchanged feed costs a 304, `Retry-After` honoured
**and remembered** — the host goes on a cooldown, stored in the database, that
the next request checks before opening a socket, so a publisher who said wait is
not asked again by the seven other URLs on that host or by tomorrow's cycle — a response size cap, a content-type check, and the
same SSRF guard used everywhere else re-applied after **every** redirect rather
than trusted once.

Two things it learned from real feeds:

- **feeds.nature.com redirects to www.nature.com, which redirects back.** An
  earlier version re-entered the per-host queue on each hop and deadlocked the
  moment two hosts pointed at each other. Redirects are now followed inside the
  slot already held, with a visited-URL set and a hop bound.
- **The EEA's feed hands back item links pointing at `10.140.145.84:3000`** —
  the CMS behind its load balancer. The SSRF guard correctly refused all 25
  items, which cost the whole feed. Such a link is now re-based onto the origin
  we actually fetched from: the path is real, the origin is the publisher's
  mistake.

Similarly, `fast-xml-parser`'s billion-laughs guard counts ordinary `&amp;` and
throws past a thousand of them, which silently cost the WHO and UNEP feeds
entirely. Entity decoding is now done here, from a fixed table, in a single
non-recursive pass — which removes the attack the guard exists to stop rather
than raising its limit.

### Nothing publishes itself

A problem never becomes public because a model produced it. The pipeline's only
output is a candidate in the curation queue, with its failing checklist items
attached. From there:

1. A named human **approves** or **rejects** it. The decision is audit-logged.
2. Approval unlocks the **problem editor**, and nothing else. The curator writes
   the factual description, the quantified consequences, the constraints and the
   success criteria themselves — the intake draft is a starting point, not text
   to publish.
3. On submission the publication checklist runs **again, on the server, against
   what the curator actually wrote**. An approval cannot buy a pass: a statement
   with no quantified consequence or no measurable success criterion is refused
   at 422 with the failing items named.

Run one cycle by hand and see what the gate did with everything it saw:

```bash
INTAKE_LIVE=true pnpm intake
```

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
     // Documents from any other host are rejected at normalisation, so a
     // connector cannot smuggle in a source from somewhere else.
     readonly allowedHosts = ['example.org'];

     async fetch(): Promise<RawDocument[]> {
       return [
         /* externalId, title, url, publisher, publishedAt, body,
                  bodyProvenance, suggestedDomains */
       ];
     }
   }
   ```

   For anything that speaks RSS or Atom, `FeedConnector` already does this:
   give it a `FeedDefinition[]`, an `HttpFetcher` and a state store.

2. Register it: in `DEFAULT_CONNECTORS` (`connectors/mock.ts`) for the offline
   set, in `liveConnectors()` (`ingestion/registry.ts`) for the live set, or
   pass it straight to `runIngestion({ db, connectors })` for a one-off.

3. Use `HttpFetcher` rather than `fetch`. It applies the SSRF guard on every
   redirect hop, serialises requests per host with a minimum interval, sends
   conditional requests, honours and remembers `Retry-After` as a per-host
   cooldown, caps the response size and checks the content type.

Nothing else changes. The pipeline normalises, deduplicates, runs the relevance
gate, classifies, extracts claims, drafts a candidate and scores it against the
publication checklist. The candidate lands in the curation queue with its
failing checks attached. It never becomes a public problem on its own.

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

## Video

Three, all produced by driving the real application rather than by editing
footage. `tools/video/` holds the recorders and `tools/video/README.md` explains
how to run them.

- **Walkthrough** (`pnpm video:demo`) signs in, reads a problem, posts a
  counterargument and runs the four-agent pipeline against the seeded database.
  The agent findings on screen were computed while the camera was rolling.
  Captions are generated from when the script actually narrated each beat, so
  re-recording on a slower machine re-times them with it, and a click that
  misses or an agent run that does not complete fails the recording rather than
  producing a confident video of a page where nothing happened.
- **Tour** (`pnpm video:tour`) is the narrated one: the real application driven
  by a real cursor, opening a problem, a hypothesis and its evidence, then going
  into the courses to open a lesson and answer a question. The narration is cut
  first and every scroll sizes itself from the time left in its beat, so the
  picture cannot drift behind the voice — and the take fails if it does.
- **Films** (`pnpm video:film`, and `pnpm video:film learn` for the courses) are
  pages composed from the product's own design tokens and its own screenshots,
  animated in the browser and recorded. There is no stock footage and no
  generated imagery in them, and every number they show is one this repository
  can produce. The narration is synthesised locally and the score is written as
  a function of its length, so editing a sentence re-cuts the picture without
  anybody opening a timeline.

---

## Under load

Measured, not assumed — [`docs/SCALING.md`](docs/SCALING.md) has the numbers and
how to reproduce them with `pnpm --filter @saveus/db loadgen` and
`node tools/bench/http.mjs`.

The board's activity sort was 556 ms on 5 000 problems, because ordering by
`max(created_at)` has to evaluate the subquery for every candidate row before
anything can be sorted — so the `LIMIT` saved nothing and the cost grew with the
product of problems and contributions. The counts now live on the problem row,
maintained by triggers and checked against the computed truth by the test suite:
**556 ms to 0.63 ms**. Search went from a sequential scan to a trigram index,
12.2 ms to 0.19 ms.

After that the database is no longer the bottleneck — unloaded, every endpoint
answers in single-digit milliseconds, and under concurrency latency rises while
throughput does not, which is a saturated CPU rather than slow SQL. The levers
that remain are the shared-cache headers on the public board and more instances,
not more indexes.

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
| `packages/common/tests` | Scoring weights and volume damping, reputation tiers, confidence from evidence, the validation gate, hypothesis lifecycle transitions, URL and source normalisation, deduplication, SHA-256 vectors, prompt-injection flagging, rate limits, the problem publication checklist, and the intake relevance gate pinned against documents live feeds actually returned. |
| `packages/agents/tests` | Agent registry and tool permissions, output validation and citation whitelisting, every role's deterministic behaviour, prompt construction and untrusted-text wrapping, JSON extraction. Plus intake: RSS/Atom/entity parsing against the shapes real publishers serve, feed-link repair, the HTTP client's refusals, claim extraction. |
| `apps/api/tests`        | The HTTP surface against a real seeded database: filters, epistemic invariants on responses, auth, contribution scoring and damping, the self-validation ban, evidence attachment and status derivation, private-host rejection, the full-review pipeline, agent-run rate limiting, leaderboard ordering, profiles, ingestion, publishing from a candidate, the Google OAuth flow against forged tokens, and the courses: every lesson citation resolving to a real source record, and no reputation moving when a lesson is completed. |
| `packages/db/tests`     | The connection configuration, the Postgres rate limiter's atomicity, and course seed integrity: no citation that the source library cannot resolve, no unsourced FACT or SOURCE_CLAIM, no lesson pointing at a problem that is not on the board.                                                                                  |
| `apps/worker/tests`     | The daily schedule: it must not fetch other people's servers twice in a day, and must still fetch them once after a restart.                                                                                                                                                                                                    |
| `tests/e2e`             | Three journeys. The researcher's: sign in → board → problem → hypothesis → contribute → run a research action → inspect the agent run → see it in the record. The curator's: the intake health panel, approving a candidate, the editor that approval unlocks, and the checklist refusing an empty statement. And the newcomer's: reading a course with no account, answering a check and getting the explanation, then marking a lesson read and confirming reputation did not move. |

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
