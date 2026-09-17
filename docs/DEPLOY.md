# Deploying SAVE US

**The recommendation: Vercel Hobby for the app, Neon free for the database.**
Free, no card, and the only combination in which every part of this platform has
a home. The rest of this page is what that costs you, what the alternatives are,
and the exact steps.

> Free tiers change, and the terms below were true when this was written rather
> than when you are reading it. Check the current limits before relying on them.
> The configuration in this repository is deliberately portable — `vercel.json`,
> `render.yaml` and a `Dockerfile` all describe the same application — so a tier
> that disappears costs you a redeploy, not a rewrite.

---

## What this application actually needs

Worth knowing before comparing providers, because it is what rules most of them
out:

| Need                | Detail                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| A Node server       | Next.js with the Hono API mounted in-process. No edge runtime: it uses `pg`.   |
| PostgreSQL 14+      | ~25 MB seeded. Migrations are plain SQL applied in order.                      |
| A daily trigger     | One intake cycle per day. **Not** a long-running process — see below.          |
| Nothing else        | Redis is optional; without it the queue is in-memory and agent runs go inline. |

The daily trigger is the only awkward part, and it is solved rather than
worked around. The worker process exists and is the better shape, but its two
jobs — consume the queue, run the clock — both have serverless answers. Agent
runs already execute inline when there is no worker (`INLINE_AGENT_RUNS`), and
the clock became `GET /api/cron/intake`, which any platform scheduler can call.

So the whole platform fits in **one Next.js deployment plus a database**.

---

## The comparison

| Option                      | Web                            | Postgres                         | Daily job                      | Verdict                                              |
| --------------------------- | ------------------------------ | -------------------------------- | ------------------------------ | ---------------------------------------------------- |
| **Vercel Hobby + Neon**     | Free, no sleep, global CDN     | Free, generous, scales to zero   | Vercel Cron, once a day        | **Recommended.** Non-commercial use only.            |
| Vercel Hobby + Supabase     | Same                           | Free, 500 MB                     | Same                           | Fine. The instance pauses after a week of inactivity. |
| Render free                 | Free, **sleeps after 15 min**  | Free but **time-limited**        | Cron jobs are a paid feature   | The database expiring is the dealbreaker.            |
| Fly.io                      | Excellent fit, real processes  | Managed or self-hosted           | The real worker                | No free allowance any more. A few dollars a month.   |
| Railway / Koyeb             | Good                           | Good                             | Good                           | Trial credit, then paid.                             |
| A €4 VPS + Docker           | Everything, properly           | Yours                            | The real worker                | The best deployment. Not free.                       |

Two things to know about the recommended path before you take it:

- **Vercel Hobby is for non-commercial use.** An open-source research platform
  qualifies. A company's product does not.
- **Hobby cron jobs fire once a day**, which is exactly the cadence intake wants,
  so this is not a compromise. The endpoint is idempotent for the day anyway.

---

## Vercel + Neon, start to finish

### 1. The database

Create a project at [neon.tech](https://neon.tech). Take the **pooled**
connection string — the one whose host contains `-pooler`. Serverless functions
open a connection per invocation, and the pooler is what stops that becoming a
problem.

### 2. Schema and seed

From your machine, pointed at the new database:

```bash
export DATABASE_URL='postgres://…-pooler….neon.tech/saveus?sslmode=require'

pnpm db:migrate        # schema only
pnpm db:seed           # the demonstration dataset, and the demo agent runs
```

TLS turns itself on for any host that is not local, so there is nothing else to
configure. Skip `db:seed` for an empty board; the app renders correctly with no
data, but the demo journey needs it.

### 3. Deploy

```bash
npx vercel link
npx vercel --prod
```

**Set the Root Directory to `apps/web`** in Project → Settings → Build and
Deployment. This is a pnpm workspace and `next` is a dependency of
`apps/web/package.json`, not of the repository root; pointed at the root, Vercel
looks for Next.js, does not find it, and fails the build with:

```
Error: No Next.js version detected. Make sure your package.json has "next" in
either "dependencies" or "devDependencies".
```

Leave **Include files outside the Root Directory** enabled — it is the default
for a detected monorepo, and the build needs the workspace packages above
`apps/web`. Vercel runs the install at the workspace root on its own.

`apps/web/vercel.json` sets the region, the cron schedule and the security
headers; the build command and output directory are the framework defaults,
which are correct once the root directory points at the app.

### 4. Environment

In **Project → Settings → Environment Variables**, for Production:

| Variable         | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| `DATABASE_URL`   | The pooled Neon string.                                    |
| `APP_SECRET`     | `openssl rand -base64 32`. **The app refuses to start in production without a real one.** |
| `CRON_SECRET`    | `openssl rand -base64 32`. Vercel sends it to the cron endpoint automatically. |
| `PUBLIC_APP_URL` | `https://your-deployment.vercel.app`. **Optional** — left unset, it is taken from Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`, so you do not need to know the URL before the first deploy. Set it once you have a custom domain. |

Optional:

| Variable                                   | Effect                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `INTAKE_LIVE=true`                         | The daily cycle fetches real publishers. Off by default — see the intake section of the README for what it fetches. |
| `INTAKE_HOUR_UTC`                          | Earliest hour the cycle may run. Default 5.                        |
| `ANTHROPIC_API_KEY`                        | Agent runs use Claude instead of the deterministic provider.       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`| Google sign-in. Redirect URI: `<PUBLIC_APP_URL>/api/auth/google/callback`. |

Redeploy after setting them — Vercel does not apply new variables to an existing
build.

### 5. Check it

```bash
curl -s https://your-deployment.vercel.app/api/health
# {"status":"ok","database":"up"}

# The cron endpoint, by hand. `force` skips the once-a-day rule.
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  'https://your-deployment.vercel.app/api/cron/intake?force=true' | jq
```

Without the header it answers `401`, and with no `CRON_SECRET` configured at all
it answers `404`. Both are deliberate: an open endpoint that makes the platform
fetch a dozen other people's servers is a denial-of-service tool pointed at
publishers who never agreed to any of this.

---

## Docker, for a real worker

`Dockerfile` has two targets from one build. This is the shape to use on a VPS,
Fly.io, or anywhere with actual processes.

> The build commands in it are the same ones CI runs, and its package list is
> checked against the workspace, but the image has not been built end to end —
> it was written somewhere without a Docker daemon. Expect the first build to
> need a fix; the Vercel path above is the one that has been walked.

```bash
docker build --target web    -t saveus-web .
docker build --target worker -t saveus-worker .

docker run -p 3000:3000 \
  -e DATABASE_URL=… -e APP_SECRET=… -e PUBLIC_APP_URL=http://localhost:3000 \
  saveus-web

docker run -e DATABASE_URL=… -e APP_SECRET=… -e INTAKE_LIVE=true saveus-worker
```

The web container migrates on start. The worker holds the queue and its own
clock, and needs no `CRON_SECRET` — it is the thing the cron endpoint stands in
for. Running both is safe: the daily rule is read from the last recorded run in
the database, not from an in-process timer, so they cannot ingest twice.

`render.yaml` describes the same thing as a Render blueprint. Note the comments
in it: a free Render web service sleeps, free Postgres is time-limited, and
background workers are not on the free plan at all — which is why Vercel is the
documented default rather than this.

---

## Things that will bite you

**`APP_SECRET` is not optional in production.** The app throws on boot rather
than signing sessions with the published development key. If the deployment
fails to start, this is the first thing to check.

**Use the pooled connection string.** A direct Neon string works until concurrent
invocations exhaust the connection limit, which happens under traffic rather than
during your testing.

**The intake cycle carries its own stopwatch.** `maxDuration` is 60 seconds on
Hobby; the cycle stops between connectors inside `INTAKE_BUDGET_MS` and reports
what it skipped. A skipped connector is first in line the next day — connectors
are independent, and everything fetched is already stored with its verdict. If
the response shows connectors in `skipped` every day, lower the number of feeds
rather than raising the budget.

**Live intake is off by default, and should stay off until you have read what it
fetches.** Turning it on makes your deployment a daily client of the WHO, UNEP,
the EEA, Nature, the Lancet and Europe PMC. `INTAKE_USER_AGENT` should carry a
real contact address before you do: publishers are entitled to know who is
fetching them and how to ask you to stop.

**Rate-limit counters need to be shared, and are by default.** They live in
Postgres because an in-memory counter on a serverless host is one empty map per
invocation — the middleware runs, decides yes, and protects nothing. If you set
`RATE_LIMIT_DRIVER=memory`, do it only for a single long-running process.

**A publisher who answers 429 is put on a cooldown that outlives the run.** It
is recorded per host, not per URL, so a refusal from one endpoint stops the
seven other requests queued behind it. Cooldowns and lapsed rate-limit windows
are swept by the daily cron call, so nothing needs pruning by hand.

**`db:seed` refuses to run twice.** It checks for existing problems and exits
rather than duplicating them. Use `pnpm db:reset` to start over — which drops the
schema, so never against anything you care about.
