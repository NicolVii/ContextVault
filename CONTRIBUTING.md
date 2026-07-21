# Contributing to Context Vault

Thanks for contributing. This document covers the **human and agent** process
for working on the MVP. Product architecture lives in [`README.md`](README.md);
Cursor Cloud boot details live in [`AGENTS.md`](AGENTS.md).

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- Docker (running) for the local Supabase stack
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Bootstrap

```bash
pnpm setup          # install, env, supabase start, migrate + seed
pnpm doctor         # validate toolchain, .env.local, Supabase API
pnpm dev            # http://localhost:3000
```

Demo login after setup: `demo@contextvault.local` / `demo-password-123`.

If `.env.local` is missing or keys are empty: `pnpm env:sync` (prefers live
values from `supabase status`; falls back to the local demo JWTs in
`.env.example`).

## Validation

| Command | When |
| --- | --- |
| `pnpm check` | Before every handoff — lint + typecheck + unit tests (no Docker) |
| `pnpm check:full` | When touching DB, auth, memory, API, or migrations — also runs integration tests (Supabase must be up) |
| `pnpm test` | Full Vitest suite (unit + integration) |
| `pnpm test:unit` / `pnpm test:integration` | Split suites |

## Branching

- **Never commit directly to `main`.**
- Always work on a dedicated feature branch branched from `main`.
- Preferred names: `cursor/<topic>-…` (Cloud agents) or `feat/<topic>`, `fix/<topic>`.
- Open a pull request into `main`; keep the PR focused on one concern.

## Commits

- Prefer **small, reviewable commits** over one large dump.
- Use imperative, descriptive subjects (e.g. `Add doctor script for local health checks`).
- Stage only files related to the task — no drive-by refactors or unrelated docs.

## Preserve existing features

- **Do not delete or gut** existing features, pages, providers, APIs, or tests
  unless they are proven obsolete or broken **and** that removal is explicitly
  in scope for the task.
- Prefer additive changes. If something is broken, fix it or flag it — do not
  remove it to “simplify.”

## Schema and data

- New `public` tables need a migration **and** grants in
  `supabase/migrations/*_grants.sql` for `authenticated` / `service_role`.
- Keep pgvector dimension at **1536** (`EMBEDDING_DIM`).
- Demo data is seeded by `pnpm db:seed` (`scripts/seed.ts`), not SQL.
  `pnpm db:reset` runs migrations then the Node seed.
  Raw migrate-only: `supabase db reset` (skips the Node seed).

## Environment and secrets

- Copy `.env.example` → `.env.local` (or use `pnpm env:sync`).
- Never commit `.env.local` or production secrets.
- Offline defaults work without `OPENROUTER_API_KEY` / Mem0 / OpenAI keys.

## Pull requests

PRs should include:

1. What changed and why (short).
2. How it was tested (`pnpm check` / `pnpm check:full`, manual steps).
3. No unrelated refactors or feature removals.

## Agents

Cursor / Cloud agents must follow this file **and** [`AGENTS.md`](AGENTS.md):

1. Create or use a feature branch — never push to or reset `main`.
2. Prefer small commits.
3. Run `pnpm check` before handoff; run `pnpm check:full` for DB/auth/memory/API work.
4. Do not remove features to simplify.
5. Do not invent CI/CD or hosted-deploy work unless the task asks for it
   (that is Phase 2 of the development-process rebuild).
