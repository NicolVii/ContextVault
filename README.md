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
- **Review queue** — automatically-extracted memories are `proposed` and must be approved; sensitive items are never auto-approved.
- **Documents** — upload PDF/text, extract + chunk + embed with `pgvector`, cited by filename and page.
- **Multi-model chat** — pick an OpenRouter model; relevant memories/documents are retrieved and injected into a separated `USER CONTEXT` block; every reply shows exactly which memories were used.
- **Privacy** — JSON export, delete-all-memories, and full account deletion; audit log of security-relevant actions.

Works fully **offline for development**: with no `OPENROUTER_API_KEY` a local
mock model is used, and embeddings default to a deterministic local provider.

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

- `OPENROUTER_API_KEY` — enables real multi-model chat via OpenRouter.
- `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY` — use real embeddings.

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
                          # extraction and redaction (secret/sensitive guards)
    embeddings/           # pluggable embedding providers (local + OpenAI)
    ai/                   # OpenRouter client, model list, USER CONTEXT builder
    documents/            # PDF/text extraction + chunking
    ratelimit.ts, audit.ts, validation.ts
supabase/migrations/      # schema, RLS, functions, storage, grants
tests/                    # automated tests
scripts/seed.ts           # demo data
```

### Swapping the memory backend

All memory storage/retrieval goes through the `MemoryProvider` interface
(`src/lib/memory/provider.ts`). The default `SupabaseMemoryProvider` uses
`pgvector`. To connect Mem0, implement `Mem0MemoryProvider` and set
`MEMORY_PROVIDER=mem0` with `MEM0_API_KEY`.

---

## Development plan

1. **Foundation** — Next.js + TypeScript + Tailwind; Supabase local stack.
2. **Data model** — enums, tables (`profiles`, `memories`, `documents`,
   `document_chunks`, `chat_*`, `audit_log`, `rate_limits`), `pgvector` columns
   and match functions.
3. **Security first** — RLS on every table, explicit role grants, storage
   policies, service-role isolation.
4. **Memory service** — provider interface, embeddings, extraction + redaction.
5. **Product surface** — the ten pages and their API routes.
6. **Chat** — retrieval → context injection → provenance → post-response
   extraction into the review queue.
7. **Documents** — upload → validate → store → extract → chunk → embed → cite.
8. **Quality** — automated tests, lint, typecheck, build, seed data.

## Security risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-user data access | Row Level Security on every table (`auth.uid() = user_id`); retrieval functions filter on `auth.uid()`; tested in `tests/memory.test.ts`. |
| Provider keys leaking to the browser | All AI calls run server-side; keys read only from server env; `NEXT_PUBLIC_*` limited to safe values. |
| Service-role key overreach | Used only for auditing, rate limiting and account deletion, with `user_id` set explicitly; never shipped to the client. |
| Secrets captured as memories | Automatic extraction blocks passwords, API keys, payment, medical and government-ID patterns; sensitive items can never be auto-approved. |
| Prompt-context leakage | Only the current user's memories/chunks are retrieved and injected; provenance is recorded per message. |
| Malicious/oversized uploads | MIME allow-list (PDF/text) + size limit enforced in the API and the storage bucket. |
| Abuse / cost blow-ups | Per-user, per-bucket rate limiting on chat, memory writes and uploads. |
| Accidental data loss | Confirmation (with typed phrase) before permanent deletion; JSON export available. |
| Auditability | Security-relevant actions written to an append-only `audit_log`. |

> **Note:** the local stack uses well-known default keys and binds to
> `0.0.0.0`. These are for development only — never use them in production.
