# Context Vault

**Save your context once. Use it with every AI.**

Context Vault is a model-independent personal AI memory platform. It lets an
individual store personal context once and reuse it across many AI models, with
a strong emphasis on user control, provenance ("why does the AI know this?")
and privacy.

Built with **Next.js (App Router) + TypeScript**, **Supabase** (Auth,
PostgreSQL, `pgvector`, Storage, Row Level Security) and **OpenRouter** for
multi-model chat. A dedicated memory provider such as **Mem0** can be connected
behind an internal memory-service interface.

---

## Features

- **Landing, sign-up/login, onboarding** flows.
- **Memory dashboard** — a personal control centre with search, filters and stats.
- **Add / edit / archive / delete** memories with confirmation before permanent deletion.
- **Review queue** — LLM-extracted (or heuristic, offline) memories are always `proposed` and must be approved; sensitive items are never auto-approved.
- **Documents** — upload PDF/text, extract + chunk + embed with `pgvector`, cited by filename and page.
- **Multi-model chat** — pick an OpenRouter model; relevant memories/documents are retrieved and injected into a separated `USER CONTEXT` block; every reply shows exactly which memories were used.
- **Privacy** — JSON export, delete-all-memories, and full account deletion; audit log of security-relevant actions.

Works fully **offline for development**: with no `OPENROUTER_API_KEY` a local
mock model is used, memory extraction falls back to heuristics, and embeddings
default to a deterministic local provider.

---

## Local setup

### Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- [Docker](https://docs.docker.com/get-docker/) (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Start the local Supabase stack (Postgres, Auth, Storage, pgvector)
supabase start

# 3. Apply migrations (and reset the DB to a clean state)
supabase db reset

# 4. Configure environment
cp .env.example .env.local
#   Fill NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from
#   the output of `supabase status`. The defaults point at the local stack.

# 5. Seed demo data (optional but recommended)
pnpm db:seed
#   Demo login →  demo@contextvault.local  /  demo-password-123

# 6. Run the app
pnpm dev            # http://localhost:3000
```

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Vitest (auth, memory isolation, retrieval, deletion) |
| `pnpm db:reset` | Reapply migrations + seed |
| `pnpm db:seed` | Seed the demo user and sample data |

### Using real AI providers

Set these in `.env.local` (server-only — never exposed to the browser):

- `OPENROUTER_API_KEY` — enables real multi-model chat via OpenRouter and
  structured LLM memory extraction (optional `EXTRACTION_MODEL`).
- `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY` — use real embeddings.

### Chat provider (OpenRouter)

Chat goes through a `ChatProvider` interface (`src/lib/ai/`). When
`OPENROUTER_API_KEY` is set, `OpenRouterChatProvider` calls OpenRouter's
`/chat/completions` API using the `vendor/model` ids in `src/lib/ai/models.ts`;
otherwise `MockChatProvider` is used so the app runs offline. No code changes
are needed to switch — just set the key.

The same key enables `LlmExtractionProvider` for post-chat memory extraction
(see Architecture → Memory extraction). Without it, extraction uses offline
heuristics.

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. Put it in `.env.local` as `OPENROUTER_API_KEY=...` (and restart `pnpm dev`).
3. Optional: `OPENROUTER_BASE_URL`, `OPENROUTER_SITE_URL`, `EXTRACTION_MODEL`.

The key is only ever read server-side (chat + extraction) and is never sent to
the browser.

### Google Sign-In (Supabase Auth)

The login/signup pages have a "Continue with Google" button that uses
`supabase.auth.signInWithOAuth({ provider: 'google' })`. Supabase redirects back
to `/auth/callback`, which exchanges the code for a session. To enable it you
need a Google OAuth client and matching Supabase config.

**Google Cloud Console**

1. APIs & Services → **OAuth consent screen** → configure (External), add your
   email as a test user.
2. APIs & Services → **Credentials** → Create Credentials → **OAuth client ID**
   → Application type **Web application**.
3. Add an **Authorized redirect URI** pointing at Supabase's callback:
   - Local: `http://127.0.0.1:54321/auth/v1/callback`
   - Hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the generated **Client ID** and **Client secret**.

**Supabase — local**

The provider is already enabled in `supabase/config.toml`; it reads the client
id/secret from the environment when the stack starts. Export them (the CLI only
substitutes `env(...)` values that are present in the shell), then restart:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="<client-id>"
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="<client-secret>"
supabase stop && supabase start
```

Also set the app's Site URL for redirects (already `http://127.0.0.1:3000`
locally in `config.toml`).

**Supabase — hosted**

In the dashboard: **Authentication → Providers → Google** → enable and paste the
Client ID/secret. Under **Authentication → URL Configuration** set the Site URL
and add your deployed domain (and `.../auth/callback`) to the redirect allow
list. No `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` env vars are needed for hosted.

Without credentials the button still appears and initiates the flow, but Google
rejects the request — so leave it unconfigured locally unless you have a client.

---

## Architecture

```
src/
  app/                    # Pages (App Router) + API route handlers
    (app)/                # Authenticated area (dashboard, chat, documents, …)
    api/                  # memories, chat, documents, export, account, profile
  components/             # UI components
  lib/
    supabase/             # server / browser / admin clients + middleware
    memory/               # MemoryProvider interface, Supabase + Mem0 providers,
                          # ExtractionProvider (LLM + heuristic), redaction
    embeddings/           # pluggable embedding providers (local + OpenAI)
    ai/                   # ChatProvider interface (OpenRouter + mock), model
                          # list, USER CONTEXT builder
    documents/            # PDF/text extraction + chunking
    ratelimit.ts, audit.ts, validation.ts
supabase/migrations/      # schema, RLS, functions, storage, grants
tests/                    # automated tests
scripts/seed.ts           # demo data
```

### Swapping the memory backend

All memory storage/retrieval goes through the `MemoryProvider` interface
(`src/lib/memory/provider.ts`). The default `SupabaseMemoryProvider` uses
`pgvector`. To use Mem0 for semantic search instead, set
`MEMORY_PROVIDER=mem0` with `MEM0_API_KEY`.

With Mem0 enabled the app uses a **hybrid** model: Supabase remains the
canonical store (UI, review queue, RLS, export) while Mem0 owns embeddings and
retrieval. Each memory is mirrored to Mem0 with `infer: false` (verbatim
content) and Context Vault metadata; the Mem0 id is stored in `source_detail`
as `mem0:<uuid>` for updates.

### Memory extraction

After each chat turn, candidate memories are extracted and inserted with
`status: proposed` (never auto-active). Extraction goes through the
`ExtractionProvider` interface (`src/lib/memory/extraction/`):

| Provider | When | Behaviour |
| --- | --- | --- |
| `LlmExtractionProvider` | `OPENROUTER_API_KEY` is set (real chat backend) | Structured JSON extraction via the active `ChatProvider` |
| `HeuristicExtractionProvider` | No API key / offline, or LLM call fails / times out | Deterministic regex heuristics (demo fallback) |

Obvious greetings, acknowledgements, and impersonal factual questions are
skipped before the model is called. Security is applied **after** the provider
returns candidates and is never delegated to the model alone: forbidden secrets
(passwords, API keys, payment data, government IDs) are dropped; medical /
financial / identity-attribute content is flagged `is_sensitive` for human
review. Optional `EXTRACTION_MODEL` selects the extraction model (default
`openai/gpt-4o-mini`); `EXTRACTION_TIMEOUT_MS` caps each call (default 8000).
Invalid JSON or schema-invalid LLM output triggers the heuristic fallback for
that request; a valid `{"memories":[]}` is kept as intentionally empty.

---

## Development plan

1. **Foundation** — Next.js + TypeScript + Tailwind; Supabase local stack.
2. **Data model** — enums, tables (`profiles`, `memories`, `documents`,
   `document_chunks`, `chat_*`, `audit_log`, `rate_limits`), `pgvector` columns
   and match functions.
3. **Security first** — RLS on every table, explicit role grants, storage
   policies, service-role isolation.
4. **Memory service** — provider interface, embeddings, ExtractionProvider
   (LLM + heuristic) + redaction.
5. **Product surface** — the ten pages and their API routes.
6. **Chat** — retrieval → context injection → provenance → post-response
   structured extraction into the review queue.
7. **Documents** — upload → validate → store → extract → chunk → embed → cite.
8. **Quality** — automated tests, lint, typecheck, build, seed data.

## Security risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-user data access | Row Level Security on every table (`auth.uid() = user_id`); retrieval functions filter on `auth.uid()`; tested in `tests/memory.test.ts`. |
| Provider keys leaking to the browser | All AI calls run server-side; keys read only from server env; `NEXT_PUBLIC_*` limited to safe values. |
| Service-role key overreach | Used only for auditing, rate limiting and account deletion, with `user_id` set explicitly; never shipped to the client. |
| Secrets captured as memories | Automatic extraction blocks passwords, API keys, payment and government-ID patterns; medical/financial/identity-attribute content is flagged sensitive and can never be auto-approved. All extractions items stay `proposed` until review. |
| Prompt-context leakage | Only the current user's memories/chunks are retrieved and injected; provenance is recorded per message. |
| Malicious/oversized uploads | MIME allow-list (PDF/text) + size limit enforced in the API and the storage bucket. |
| Abuse / cost blow-ups | Per-user, per-bucket rate limiting on chat, memory writes and uploads. |
| Accidental data loss | Confirmation (with typed phrase) before permanent deletion; JSON export available. |
| Auditability | Security-relevant actions written to an append-only `audit_log`. |

> **Note:** the local stack uses well-known default keys and binds to
> `0.0.0.0`. These are for development only — never use them in production.
