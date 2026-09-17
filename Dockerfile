# The portable deployment.
#
# Vercel is the cheapest way to put the web app online, but it is serverless:
# there is no process to hold a queue or a clock, so the scheduled intake has to
# be an HTTP endpoint somebody calls. This image is the other shape - one that
# runs the worker properly - and it is here so the project is not married to one
# provider's free tier.
#
# Two targets: `web` and `worker`. Same build, same dependencies, different
# entry point.
#
# Caveat worth stating plainly: the build steps here are the same commands CI
# runs and the package list is checked against the workspace, but this image has
# not been built end to end - the environment it was written in has no Docker
# daemon. Treat the first `docker build` as part of your deployment, not as a
# formality. The Vercel path in docs/DEPLOY.md is the one that has been walked.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies. Copied manifests only, so a source edit does not reinstall.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json           apps/web/
COPY apps/api/package.json           apps/api/
COPY apps/worker/package.json        apps/worker/
COPY packages/common/package.json    packages/common/
COPY packages/db/package.json        packages/db/
COPY packages/agents/package.json    packages/agents/
COPY packages/ui/package.json        packages/ui/
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build. The workspace ships TypeScript source; only the web app is compiled.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build renders no page that reads the database - every route is dynamic -
# so it needs no connection string, and is given an obviously fake one to keep
# it that way.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
RUN pnpm --filter @saveus/web build

# ---------------------------------------------------------------------------
# Web
# ---------------------------------------------------------------------------
FROM build AS web
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Migrations run at start rather than at build: the database exists at run time,
# and a container that starts against an older schema is worse than one that
# takes a few seconds longer.
CMD ["sh", "-c", "pnpm db:migrate && pnpm --filter @saveus/web exec next start --port ${PORT:-3000} --hostname 0.0.0.0"]

# ---------------------------------------------------------------------------
# Worker. The queue consumer and the intake clock.
# ---------------------------------------------------------------------------
FROM build AS worker
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@saveus/worker", "start"]
