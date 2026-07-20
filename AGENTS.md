# AGENTS.md

Context Vault — a model-independent personal AI memory platform. Next.js
(App Router) + TypeScript + Tailwind, Supabase (Auth/Postgres/pgvector/Storage)
and OpenRouter for chat. See `README.md` for full setup and architecture.

## Cursor Cloud specific instructions

The base VM already has Node, pnpm, Docker and the Supabase CLI installed, and
the update script runs `pnpm install`. The Docker daemon and the Supabase
containers are **not** running at session start — start them manually:

```bash
# 1. Start the Docker daemon (needed for the local Supabase stack) and make the
#    socket usable without sudo. daemon.json is preconfigured for fuse-overlayfs.
sudo dockerd > /tmp/dockerd.log 2>&1 &
sleep 8
sudo chmod 666 /var/run/docker.sock

# 2. Start Supabase and apply migrations + seed the demo data.
supabase start          # prints ANON_KEY / SERVICE_ROLE_KEY (also: supabase status)
supabase db reset       # applies migrations in supabase/migrations
pnpm db:seed            # demo@contextvault.local / demo-password-123

# 3. Run the dev server.
pnpm dev                # http://localhost:3000
```

Notes and non-obvious gotchas:

- **`.env.local`** holds the well-known local Supabase keys and is git-ignored.
  If it is missing, copy `.env.example` and fill `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  and `SUPABASE_SERVICE_ROLE_KEY` from `supabase status`. The local demo keys
  are stable across `supabase start` runs, so the committed values usually work.
- **Offline by default:** with no `OPENROUTER_API_KEY` the chat uses a local
  mock model that echoes the injected context, and memory extraction falls
  back to deterministic heuristics; with `EMBEDDING_PROVIDER=local`
  (default) embeddings are deterministic and need no network. The app is fully
  demoable without any external API keys.
- **Table grants matter:** recent Supabase does not auto-expose new `public`
  tables to the PostgREST roles. `supabase/migrations/*_grants.sql` grants the
  `authenticated` and `service_role` roles. If you add a new table you must add
  grants there or every API query fails with "permission denied for table".
- **pgvector dimension is fixed at 1536** (`EMBEDDING_DIM`). Keep local and
  OpenAI providers at the same dimension or the vector columns break.
- **Disabled Supabase services:** realtime, edge runtime, analytics and vector
  storage are turned off in `supabase/config.toml` to speed up `supabase start`.
  Email confirmations are disabled locally so signup logs in immediately.
- **Tests** (`pnpm test`) run against the running local stack and create/delete
  real users via the service role, so Supabase must be started first.
- Lint / typecheck / build: `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- **Chat provider:** chat uses the `ChatProvider` interface in `src/lib/ai/`.
  With `OPENROUTER_API_KEY` set it calls OpenRouter; otherwise it uses the
  offline `MockChatProvider`. No code change is needed to switch.
- **Memory extraction:** uses the `ExtractionProvider` interface in
  `src/lib/memory/extraction/`. With a real chat backend it runs structured
  LLM extraction; offline (or on LLM failure) it uses
  `HeuristicExtractionProvider`. Candidates are always inserted as `proposed`;
  redaction in `src/lib/memory/redaction.ts` still blocks secrets and flags
  sensitive content. Optional `EXTRACTION_MODEL` overrides the extraction model.
- **Google Sign-In:** enabled in `supabase/config.toml`, reading
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`. The Supabase CLI only
  substitutes `env(...)` values that are exported in the shell **before**
  `supabase start`, so export them (or leave unset to keep Google disabled) and
  restart the stack after changing them. OAuth returns to `/auth/callback`.
