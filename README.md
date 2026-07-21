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
- **Multi-model chat** — Auto / presets / explicit models via the Inference Router; relevant memories/documents are retrieved and injected into a separated `USER CONTEXT` block; every reply shows exactly which memories were used.
- **Privacy** — JSON export, delete-all-memories, and full account deletion; audit log of security-relevant actions.

Works fully **offline for development**: with no `OPENROUTER_API_KEY` a local
mock model is used, memory extraction falls back to heuristics, and embeddings
default to a deterministic local provider.

---

## Local setup

### Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- [Docker](https://docs.docker.com/get-docker/) running (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Quick start

```bash
pnpm bootstrap          # install, .env.local, supabase start, migrate + seed
pnpm health         # optional health check
pnpm dev            # http://localhost:3000
```

Demo login: `demo@contextvault.local` / `demo-password-123`.

`pnpm bootstrap` creates `.env.local` from `.env.example` (well-known **local-only**
demo JWTs) and refreshes keys from `supabase status` when the stack is up.
To refresh env later: `pnpm env:sync`.

Contributing (branches, commits, PR rules): see [`CONTRIBUTING.md`](CONTRIBUTING.md).
Cursor Cloud agents: see [`AGENTS.md`](AGENTS.md).

### Scripts

| Command | Description |
| --- | --- |
| `pnpm bootstrap` | Install deps, sync env, start Supabase, migrate + seed |
| `pnpm health` | Validate Node/pnpm/Docker/CLI/env/Supabase API |
| `pnpm env:sync` | Create/update `.env.local` from example + `supabase status` |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm check` | lint + typecheck + unit tests (no Docker) |
| `pnpm check:full` | `check` + integration tests (requires Supabase) |
| `pnpm test` | Full Vitest suite (unit + integration) |
| `pnpm test:unit` | Unit tests only |
| `pnpm test:integration` | DB-backed tests (requires Supabase) |
| `pnpm db:start` | `supabase start` |
| `pnpm db:reset` | Reapply migrations + run Node demo seed |
| `pnpm db:seed` | Seed the demo user and sample data |

Migrate-only (no Node seed): `supabase db reset`. Demo data always comes from
`scripts/seed.ts`; `supabase/seed.sql` is a no-op placeholder for the CLI.

### Using real AI providers

Set these in `.env.local` (server-only — never exposed to the browser):

- `OPENROUTER_API_KEY` — enables real multi-model chat via OpenRouter and
  structured LLM memory extraction (optional `EXTRACTION_MODEL`).
- `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY` — use real embeddings.

### Chat / inference

Product chat goes through the **Context Orchestrator**
(`src/lib/orchestration/`) which assembles identity, memories, and documents,
then calls the **Inference Router** (`src/lib/inference/`). The router resolves
Auto / presets / explicit models to a logical `cortaix` model id, maps that to
a provider binding, gates the credit wallet, and calls a `ChatProvider`
adapter.

OpenRouter is the first adapter (`src/lib/ai/openrouter.ts`), not the product
backend. When `OPENROUTER_API_KEY` is set, `OpenRouterChatProvider` is used;
otherwise `MockChatProvider` keeps the app offline-demoable (mock turns are
free on the credit ledger).

Canonical usage is recorded in `usage_events` and settled against
`credit_accounts` using the Cortaix price book — independent of any vendor
response shape.

The same OpenRouter key enables `LlmExtractionProvider` for post-chat memory
extraction (see Architecture → Memory extraction). Without it, extraction uses
offline heuristics.

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. Put it in `.env.local` as `OPENROUTER_API_KEY=...` (and restart `pnpm dev`).
3. Optional: `OPENROUTER_BASE_URL`, `OPENROUTER_SITE_URL`, `EXTRACTION_MODEL`
   (cortaix id such as `openai.gpt-4o-mini`, or a legacy provider id).

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
    api/                  # memories, chat, documents, credits, export, account, profile
  components/             # UI components
  lib/
    supabase/             # server / browser / admin clients + middleware
    memory/               # MemoryProvider interface, Supabase + Mem0 providers,
                          # ExtractionProvider (LLM + heuristic), redaction
    embeddings/           # pluggable embedding providers (local + OpenAI)
    inference/            # model registry, router, usage drafts, credits, metering
    orchestration/        # Context Orchestrator (chat application service)
    conversation/         # ConversationStore port
    ai/                   # ChatProvider adapters (OpenRouter + mock), context builder
    documents/            # PDF/text extraction, chunking, DocumentRetriever
    ratelimit.ts, audit.ts, validation.ts
supabase/migrations/      # schema, RLS, functions, storage, grants, metering
tests/                    # automated tests (unit + integration)
scripts/                  # bootstrap, health, env-sync, seed
CONTRIBUTING.md           # branch / commit / PR process
AGENTS.md                 # Cursor Cloud + agent rules
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
as `mem0:<uuid>` for updates. Deletes, bulk wipes, and review-queue status
changes are synced back to Mem0 automatically.

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
`openai.gpt-4o-mini`); `EXTRACTION_TIMEOUT_MS` caps each call (default 8000).
Invalid JSON or schema-invalid LLM output triggers the heuristic fallback for
that request; a valid `{"memories":[]}` is kept as intentionally empty.

---

## Shipped foundation

Historical checklist of the MVP work that is already in tree (not a roadmap):

1. **Foundation** — Next.js + TypeScript + Tailwind; Supabase local stack.
2. **Data model** — enums, tables (`profiles`, `memories`, `documents`,
   `document_chunks`, `chat_*`, `audit_log`, `rate_limits`, `usage_events`,
   `credit_accounts`, `credit_ledger`, `price_book`), `pgvector` columns
   and match functions.
3. **Security first** — RLS on every table, explicit role grants, storage
   policies, service-role isolation.
4. **Memory service** — provider interface, embeddings, ExtractionProvider
   (LLM + heuristic) + redaction; optional hybrid Mem0 provider.
5. **Product surface** — the ten pages and their API routes.
6. **Chat** — Context Orchestrator → Inference Router → provider adapter;
   retrieval → context injection → provenance → post-response structured
   extraction into the review queue; credit-gated metering on platform turns.
7. **Documents** — upload → validate → store → extract → chunk → embed → cite.
8. **Quality** — automated tests, lint, typecheck, build, seed data; local
   `bootstrap` / `health` / `check` scripts for reproducible development.

**Next process work (Phase 2, not implemented here):** GitHub Actions, required
checks, Vercel preview/production, hosted Supabase, and env separation.

## Billing & providers

Inference is metered in **Cortaix credits**. Users buy credit packs or subscribe
via Stripe (`/vault/settings` → Billing). OpenRouter / OpenAI / Anthropic /
Google / Groq are adapters behind the Inference Router; optional BYOK keys are
encrypted at rest and skip credit debit for matching providers.

**Model selection vs configuration:** everyday Auto / presets / models live in
the Thinking composer **+** menu. Provider keys and the account default model
live under Vault → Settings → Advanced.

Locally, when `STRIPE_SECRET_KEY` is unset and `NODE_ENV !== production`, use
**Dev top-up** on the billing panel. Dev top-up is **unconditionally disabled**
in production (no env override). Configure Stripe price ids via `STRIPE_PRICE_*`
env vars (see `.env.example`).

### BYOK encryption

- Set `BYOK_ENCRYPTION_KEY` to a long random secret (32+ bytes recommended).
- **Production requires** `BYOK_ENCRYPTION_KEY`. The service role key is **not**
  an allowed fallback outside local development.
- Keys are stored as AES-256-GCM ciphertext + IV in `user_provider_keys`.
- Missing key → API returns an error; existing ciphertext cannot be decrypted
  with a different secret.
- **Rotation path (future):** introduce `BYOK_ENCRYPTION_KEY_PREVIOUS`, decrypt
  with previous then re-encrypt with current in a background job, then remove
  the previous secret. Derivation salt version is `cortaix-byok-v1`
  (`BYOK_KEY_DERIVATION_VERSION`).

### Stripe webhooks

Each Stripe `event.id` is inserted into `stripe_webhook_events` (unique PK)
before credits are granted. Retries of the same event return success without
double-granting. If handling fails after claim, the row is deleted so Stripe
can retry safely.

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
