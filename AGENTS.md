# AGENTS.md

Context Vault — a model-independent personal AI memory platform. Next.js
(App Router) + TypeScript + Tailwind, Supabase (Auth/Postgres/pgvector/Storage)
and OpenRouter for chat. See [`README.md`](README.md) for architecture and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for branch / commit / PR rules.

## Agent process (required)

1. **Feature branch only.** Create or use a dedicated branch (e.g.
   `cursor/<topic>-…`). Never commit to, push to, or reset `main`.
2. **Small commits.** Prefer reviewable, imperative commits; stage only
   task-related files.
3. **Validate.** Run `pnpm check` before handoff. Run `pnpm check:full` when
   touching DB, auth, memory, API routes, or migrations (Supabase must be up).
4. **Preserve features.** Do not delete pages, providers, APIs, or tests unless
   they are proven obsolete/broken and explicitly in scope.
5. **Scope.** Do not invent CI/CD, Vercel, or hosted Supabase work unless asked
   (Phase 2). Do not change product scope while working on tooling/docs.

## Cursor Cloud boot

The base VM already has Node, pnpm, Docker and the Supabase CLI installed, and
the update script runs `pnpm install`. The Docker daemon and the Supabase
containers are **not** running at session start — start them manually, then use
the same scripts as a laptop:

```bash
# 1. Start the Docker daemon (needed for the local Supabase stack) and make the
#    socket usable without sudo. daemon.json is preconfigured for fuse-overlayfs.
sudo dockerd > /tmp/dockerd.log 2>&1 &
sleep 8
sudo chmod 666 /var/run/docker.sock

# 2. One-command bootstrap (env + supabase start + migrate + demo seed).
pnpm setup
#    Or step-by-step:
#    pnpm db:start && pnpm env:sync && pnpm db:reset

# 3. Confirm health, then run the app.
pnpm doctor
pnpm dev                # http://localhost:3000
```

Demo login: `demo@contextvault.local` / `demo-password-123`.

## Local scripts (agents)

| Command | Purpose |
| --- | --- |
| `pnpm setup` | Install, sync `.env.local`, start Supabase, migrate + seed |
| `pnpm env:sync` | Create/update `.env.local` (from example + `supabase status`) |
| `pnpm doctor` | Validate Node/pnpm/Docker/CLI/env/Supabase API |
| `pnpm db:start` | `supabase start` |
| `pnpm db:reset` | Migrations + `pnpm db:seed` |
| `pnpm db:seed` | Demo user + sample data (`scripts/seed.ts`) |
| `pnpm check` | lint + typecheck + unit tests |
| `pnpm check:full` | `check` + integration tests |
| `pnpm test:unit` / `pnpm test:integration` | Split suites |

## Gotchas

- **`.env.local`:** git-ignored. Create it with `pnpm env:sync` or `pnpm setup`
  **before** `pnpm db:seed`. `.env.example` ships well-known **local-only**
  demo JWTs; `env:sync` refreshes them from `supabase status` when the stack
  is up. Never use those JWTs in hosted environments.
- **`db:reset` vs `db:seed`:** `pnpm db:reset` = `supabase db reset` then the
  Node demo seed. `supabase/seed.sql` is a no-op placeholder so CLI reset
  succeeds; demo data always comes from `scripts/seed.ts`.
- **Offline by default:** no `OPENROUTER_API_KEY` → mock chat + heuristic
  extraction; `EMBEDDING_PROVIDER=local` → deterministic embeddings.
- **Table grants:** new `public` tables need grants in
  `supabase/migrations/*_grants.sql` or PostgREST returns permission denied.
- **pgvector dimension is fixed at 1536** (`EMBEDDING_DIM`).
- **Disabled Supabase services:** realtime, edge runtime, analytics and vector
  storage are off in `supabase/config.toml` to speed up `supabase start`.
  Email confirmations are disabled locally so signup logs in immediately.
- **Integration tests** need a running local stack and filled env
  (`pnpm check:full` / `pnpm test:integration`).
- **Google Sign-In:** `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` must be exported in the
  shell **before** `supabase start` (CLI `env(...)` substitution). OAuth
  returns to `/auth/callback`. Leave unset to keep Google disabled locally.

For chat / memory / extraction / Mem0 provider details, see `README.md`.
