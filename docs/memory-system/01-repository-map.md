# 01 — Repository Map (Memory System Planning)

> **Role:** Cortaix Repository Mapper  
> **Scope:** Locate every area potentially related to chat, messages, conversations, users, auth, memories, embeddings, retrieval, context creation, OpenRouter, Supabase, migrations, background processing, documents, tests, administration, and observability.  
> **Constraints:** Planning document only. No production code, migrations, API, prompt, dependency, configuration, or behavior changes.  
> **Prior docs under `docs/memory-system/`:** none existed at time of writing (directory created by this document). Related non-memory planning docs under `docs/` were consulted for cross-references: `admin-commercial-architecture.md`, `demo-mode-test-matrix.md`, `private-beta-readiness.md`, `legal-readiness-checklist.md`.

This document maps **where things live**. It does not deeply assess implementation correctness.

---

## Legend (evidence classes)

| Label | Meaning |
| --- | --- |
| **Verified** | Observed directly in repository files (paths, exports, tables, routes). |
| **Conclusion** | Architectural interpretation grounded in verified facts. |
| **Assumption** | Reasonable inference not proven by exhaustive reading of every call site. |
| **Unknown** | Requires deeper inspection by specialist agents. |
| **Recommendation** | Suggested next mapping / analysis steps (not implementation). |

---

## 1. Repository structure overview

### Verified — top-level layout

| Path | Apparent responsibility |
| --- | --- |
| `src/app/` | Next.js App Router: marketing, auth pages, authenticated Vault UI, Admin Console, API route handlers |
| `src/components/` | React UI (Thinking, Vault, memories, billing, admin panels) |
| `src/lib/` | Domain libraries: memory, AI/context, inference, orchestration, documents, embeddings, billing, admin, Supabase clients |
| `src/middleware.ts` | Edge middleware entry → session refresh + auth redirects |
| `src/types/` | Ambient TS declarations (e.g. `pdf-parse.d.ts`) |
| `supabase/migrations/` | Postgres schema, RLS, RPCs, storage, grants (28 SQL files) |
| `supabase/config.toml` | Local Supabase CLI config (auth, disabled services, Google OAuth env substitution) |
| `supabase/seed.sql` | CLI seed placeholder (no-op); demo data comes from `scripts/seed.ts` |
| `tests/` | Vitest unit + integration suites |
| `scripts/` | Bootstrap, health (`doctor`), env sync, seed |
| `docs/` | Architecture / readiness markdown (commercial, legal, demo matrix) |
| `public/` | Static assets |
| `README.md`, `AGENTS.md`, `CONTRIBUTING.md` | Product architecture, agent process, contribution rules |
| `.env.example` | Documented environment variables |
| `package.json` | Next 14.2.15, React 18, Supabase SSR/JS, Stripe, Zod, Vitest, pdf-parse |

### Verified — app route groups

```
src/app/
  page.tsx                 # Landing (anon) OR Thinking shell (authed)
  layout.tsx, globals.css
  login/, signup/, onboarding/, auth/callback/
  (marketing)/legal/…      # Terms, privacy, AUP, billing legal
  (app)/                   # Auth-gated layout → Vault pages + legacy redirects
    vault/…                # Primary product UI (memories, files, review, plan, settings, search)
    chat/, dashboard/, …   # Several legacy pages redirect elsewhere
  admin/                   # Staff Admin Console (RBAC)
  api/                     # REST-style route handlers
```

### Architectural conclusion

The product surface has consolidated around **Thinking** (`/` when authenticated + `/api/think`) and **Vault** (`/vault/*`), while `/api/chat` + `runChatOrchestrator` remain a parallel chat path used by `ChatView`. Billing/admin form a large adjacent commercial layer that gates inference and storage but is not the memory core.

---

## 2. Runtime architecture overview

### Verified request paths (high level)

```text
Browser
  ├── ThinkingView  ──POST──► /api/think   (inline orchestration in route)
  ├── ChatView      ──POST──► /api/chat    ──► runChatOrchestrator
  ├── Vault UI      ──CRUD──► /api/memories*, /api/documents*, /api/search, /api/sessions/[id]
  └── Admin UI      ─────────► /api/admin/*

Middleware (src/middleware.ts → lib/supabase/middleware.updateSession)
  └── Refresh Supabase session cookies; redirect unauthenticated users away from PROTECTED_PREFIXES

Chat / Think turn (conceptual)
  auth (getSessionContext)
    → rate limit / operational controls
    → MemoryProvider.retrieve + DocumentRetriever (+ profile memories)
    → buildSystemPrompt / composeChatMessages (lib/ai/context)
    → runInference (lib/inference) OR directIdentityAnswer short-circuit
    → ConversationStore / chat_sessions + chat_messages + message_context
    → extractCandidates → MemoryProvider.insert (status: proposed)
    → credits / plan usage settlement (platform turns)
```

### Verified provider selection

| Concern | Factory | Default | Alternate |
| --- | --- | --- | --- |
| Chat completion (legacy `ChatProvider`) | `src/lib/ai/index.ts` `getChatProvider()` | `MockChatProvider` if no `OPENROUTER_API_KEY` | `OpenRouterChatProvider` |
| Inference (product path) | `src/lib/inference/complete.ts` `runInference` | Mock / adapters via router | OpenRouter, OpenAI, Anthropic, Google, Groq adapters |
| Memories | `src/lib/memory/index.ts` `getMemoryProvider()` | `SupabaseMemoryProvider` | `Mem0MemoryProvider` if `MEMORY_PROVIDER=mem0` + key |
| Extraction | `src/lib/memory/extraction/index.ts` `getExtractionProvider()` | Heuristic if no OpenRouter key | `LlmExtractionProvider` |
| Embeddings | `src/lib/embeddings/index.ts` `getEmbeddingProvider()` | `LocalEmbeddingProvider` | `OpenAIEmbeddingProvider` if `EMBEDDING_PROVIDER=openai` |

### Architectural conclusion

Memory-related runtime is concentrated in `src/lib/memory/**`, `src/lib/ai/context.ts`, `src/lib/orchestration/chat.ts`, `src/lib/documents/**`, `src/lib/embeddings/**`, and the dual API surfaces `/api/think` and `/api/chat`. Persistence is Supabase Postgres + Storage; semantic search uses `pgvector` RPCs (`match_memories`, `match_document_chunks`) unless Mem0 is enabled for memory retrieval.

### Assumption

There is **no separate background worker process** in-repo for extraction, embedding, or reindex jobs. Document upload embedding appears to run **inline** in `POST /api/documents` (`maxDuration = 60`). Post-chat extraction appears **inline** in the think/chat handlers/orchestrator.

### Unknown

Whether any Vercel Cron / external queue exists outside this repository for rotation, reconcile, or embedding backfill.

---

## 3. Relevant file inventory

Brief responsibility per relevant file. Grouped by topic. Line counts are approximate (`wc -l`) where noted.

### 3.1 Chat / messages / conversations

| File | Responsibility |
| --- | --- |
| `src/app/api/chat/route.ts` (~101) | `POST` chat entry: auth, rate limit, operational controls, delegates to `runChatOrchestrator` |
| `src/app/api/think/route.ts` (~548) | Primary Thinking `POST`: intent classification, retrieval, inference, persistence, extraction (self-contained) |
| `src/app/api/sessions/[id]/route.ts` (~31) | `GET` session + messages for restore |
| `src/lib/orchestration/chat.ts` (~277) | Context Orchestrator application service for `/api/chat` |
| `src/lib/conversation/store.ts` (~122) | `ConversationStore` port + `createSupabaseConversationStore` (sessions/messages/`message_context`) |
| `src/lib/think/intent.ts` (~34) | Heuristic `classifyIntent` / `stripRememberPrefix` for Thinking |
| `src/components/ChatView.tsx` | Legacy/alternate chat UI → `/api/chat` |
| `src/components/ThinkingView.tsx` | Primary composer UI → `/api/think` |
| `src/components/ThinkingShell.tsx` | Chrome around Thinking |
| `src/components/ResponseInfoButton.tsx` | Provenance / response metadata UI |
| `src/components/ComposerPlusMenu.tsx` | Model/attachment extras in composer |
| `src/app/page.tsx` | Authed home = Thinking; anon = Landing |
| `src/app/(app)/chat/page.tsx` | Legacy redirect to `/` |
| `supabase/migrations/20260720000004_chat.sql` | Tables `chat_sessions`, `chat_messages`, `message_context` |

### 3.2 Users / authentication / profiles

| File | Responsibility |
| --- | --- |
| `src/lib/auth.ts` (~35) | `getCachedUser`, `getSessionContext` (request-cached) |
| `src/lib/profile.ts` | `ensureUserProfile`, `displayNameFromUser`, `needsOnboarding` |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server/RSC Supabase client |
| `src/lib/supabase/admin.ts` | Service-role admin client |
| `src/lib/supabase/middleware.ts` (~80) | Cookie session refresh + protected-route redirects |
| `src/middleware.ts` (~12) | Next middleware wrapper |
| `src/app/auth/callback/route.ts` | OAuth code exchange callback |
| `src/app/login/page.tsx`, `src/app/signup/page.tsx` | Auth pages |
| `src/app/onboarding/page.tsx` | First-run profile / memory onboarding |
| `src/components/AuthForm.tsx`, `SignOutButton.tsx` | Auth UI |
| `src/app/api/profile/route.ts` | Profile `PATCH` |
| `src/app/api/account/route.ts` | Destructive account / wipe-all memories `DELETE` |
| `supabase/migrations/20260720000001_init.sql` | `profiles`, `handle_new_user`, enums |
| `supabase/migrations/20260720180000_ensure_profile_bootstrap.sql` | Profile bootstrap hardening |
| `supabase/config.toml` | Local auth (email confirm off, Google `env(...)`) |

### 3.3 Memories / extraction / redaction / Mem0

| File | Responsibility |
| --- | --- |
| `src/lib/memory/provider.ts` | `MemoryProvider` interface (`insert`, `retrieve`, `reembed`, `remove`, `syncMetadata`, `removeAll`) |
| `src/lib/memory/index.ts` | Provider factory (`MEMORY_PROVIDER`, Mem0 key) |
| `src/lib/memory/supabase-provider.ts` (~79) | Default pgvector-backed provider |
| `src/lib/memory/mem0-provider.ts` (~301) | Hybrid Mem0 retrieval + Supabase canonical store |
| `src/lib/memory/mem0/client.ts` (~196) | HTTP client for Mem0 API |
| `src/lib/memory/mem0/mapping.ts` (~63) | Metadata / `source_detail` `mem0:<id>` helpers |
| `src/lib/memory/redaction.ts` | Forbidden-secret scan + sensitivity heuristics |
| `src/lib/memory/extraction/provider.ts` | `ExtractionProvider` interface |
| `src/lib/memory/extraction/index.ts` (~151) | Factory, timeout, `extractCandidates` pipeline |
| `src/lib/memory/extraction/llm.ts` (~74) | `EXTRACTION_SYSTEM_PROMPT` + `LlmExtractionProvider` |
| `src/lib/memory/extraction/heuristic.ts` | Offline regex/heuristic extractor |
| `src/lib/memory/extraction/schema.ts` | Zod parse for LLM extraction JSON |
| `src/lib/memory/extraction/skip.ts` | Skip greetings / impersonal questions |
| `src/app/api/memories/route.ts` | List/create memories |
| `src/app/api/memories/[id]/route.ts` | Get/update/delete single memory |
| `src/app/api/memories/[id]/related/route.ts` | Semantic related memories |
| `src/components/MemoryCard.tsx`, `MemoriesExplorer.tsx`, `ReviewQueue.tsx`, `RelatedMemoriesStrip.tsx` | Memory UI |
| `src/app/(app)/vault/memories/**`, `vault/review/**`, `(app)/memories/**`, `(app)/review/**` | Memory pages (Vault + possible legacy) |
| `supabase/migrations/20260720000002_memories.sql` | `memories` table + embedding index |
| `supabase/migrations/20260721190000_memory_pinned_at.sql` | `pinned_at` column |

### 3.4 Embeddings / retrieval / context creation

| File | Responsibility |
| --- | --- |
| `src/lib/embeddings/index.ts` (~109) | `EMBEDDING_DIM=1536`, local + OpenAI providers, `toVectorLiteral` |
| `src/lib/documents/retrieve.ts` (~38) | `DocumentRetriever` + Supabase `match_document_chunks` wrapper |
| `src/lib/ai/context.ts` (~183) | `BASE_SYSTEM_PROMPT`, `buildSystemPrompt`, identity helpers, message composition |
| `src/lib/ai/mock.ts` | Offline chat that asserts USER CONTEXT injection |
| `supabase/migrations/20260720000007_functions.sql` | `match_memories`, `match_document_chunks` |
| `src/app/api/search/route.ts` (~160) | Unified Vault search (memories, conversations, files) |

### 3.5 OpenRouter / inference adapters

| File | Responsibility |
| --- | --- |
| `src/lib/ai/openrouter.ts` (~85) | Legacy `OpenRouterChatProvider` (`ChatProvider` port) |
| `src/lib/ai/provider.ts` | `ChatProvider` / `ChatMessage` types |
| `src/lib/ai/index.ts` | Chat provider factory |
| `src/lib/ai/models.ts` | Back-compat re-exports of inference catalog for UI |
| `src/lib/inference/adapters/types.ts` | Shared OpenAI-compatible complete helper |
| `src/lib/inference/adapters/index.ts` | openrouter / openai / groq / google / anthropic / mock adapters |
| `src/lib/inference/complete.ts` (~425) | `runInference` — routing, credits, BYOK, metering, ops controls |
| `src/lib/inference/router.ts` (~241) | Auto/preset/explicit model resolution |
| `src/lib/inference/models.ts` (~323) | `MODEL_CATALOG`, presets, selection helpers |
| `src/lib/inference/pricing.ts`, `meter.ts`, `credits.ts`, `usage.ts` | Price book, settlement, wallet, usage mapping |
| `src/lib/inference/provider-ops.ts` (~1097) | Admin provider/model ops, health probes, ceilings |
| `src/lib/inference/types.ts` | Inference request/result types |

### 3.6 Documents

| File | Responsibility |
| --- | --- |
| `src/lib/documents/extract.ts` | PDF (`pdf-parse`) + plain text extraction |
| `src/lib/documents/chunk.ts` | Overlapping page-attributed chunking |
| `src/app/api/documents/route.ts` (~197) | List + upload → extract → chunk → embed → store |
| `src/app/api/documents/[id]/route.ts` | Delete document |
| `src/components/DocumentLibrary.tsx` | Files UI |
| `src/app/(app)/vault/files/**`, `(app)/documents/**` | Document pages |
| `supabase/migrations/20260720000003_documents.sql` | `documents`, `document_chunks` |
| `supabase/migrations/20260720000008_storage.sql` | Private `documents` storage bucket + policies |

### 3.7 Supabase / DB / grants / RLS

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260720000006_rls.sql` | Core RLS policies |
| `supabase/migrations/20260720000009_grants.sql` | Table grants for PostgREST roles |
| Later `*_grants.sql` migrations | Grants for metering, provider ops, promotions, system controls |
| `scripts/seed.ts` | Demo + admin users, sample memories/documents (uses local embeddings) |
| `scripts/env.ts`, `env-sync.ts`, `setup.ts`, `doctor.ts`, `seed-runner.ts` | Local stack bootstrap / health |

### 3.8 Administration

| File | Responsibility |
| --- | --- |
| `src/lib/admin/auth.ts`, `roles.ts` | RBAC (`user`/`support`/`admin`/`super_admin`) |
| `src/lib/admin/console.ts` | Overview stats, user list/detail, audit browse |
| `src/lib/admin/mutations.ts` | Usage resets, bonus grants |
| `src/lib/admin/audit.ts` | `admin_audit_log` writes |
| `src/lib/admin/system-controls.ts`, `system-health.ts` | Operational kill-switches + health report |
| `src/lib/admin/usage-economics.ts` | Usage & economics aggregates |
| `src/app/admin/**` | Admin pages |
| `src/components/admin/**` | Admin UI panels |
| `src/app/api/admin/**` | Admin APIs (session, users, plans, providers, promotions, system, usage, …) |

### 3.9 Billing (adjacent; gates memory/chat)

Large tree under `src/lib/billing/**` and `src/app/api/billing/**` — Stripe, entitlements, plan usage, BYOK, promotions. Documented in `docs/admin-commercial-architecture.md`. Relevant to memory system because chat/think/document paths enforce plan/credit/ops gates.

### 3.10 Observability / cross-cutting

| File | Responsibility |
| --- | --- |
| `src/lib/audit.ts` | User `audit_log` writes |
| `src/lib/ratelimit.ts` | Per-user bucket rate limits via RPC |
| `src/lib/perf.ts` | Optional Server-Timing / console perf |
| `src/lib/request-cache.ts` | React `cache` shim for per-request memoization |
| `src/lib/validation.ts` | Zod schemas for memories, chat, profile; upload limits |
| `src/lib/types.ts` | Shared domain types (Memory, Profile, Retrieved*, enums) |
| `src/lib/utils.ts`, `brand.ts` | Helpers + brand constants |
| `src/app/api/status/route.ts` | Safe public diagnostics (provider names, key presence) |
| `src/lib/billing/telemetry.ts` | Billing telemetry events |
| `supabase/migrations/20260720000005_audit_ratelimit.sql` | `audit_log`, `rate_limits`, `increment_rate_limit` |

### 3.11 Background processing

| Observation | Evidence |
| --- | --- |
| **No dedicated worker/cron package** in `package.json` | Verified dependencies: Next, Supabase, Stripe, Zod, pdf-parse only |
| Inline document pipeline | `src/app/api/documents/route.ts` (`maxDuration = 60`) |
| Inline post-turn extraction | Orchestrator / think route call `extractCandidates` |
| Mem0 add may poll event completion | `Mem0Client` waits on `event_id` (client-side wait, still in request) |
| Stripe webhook is event-driven HTTP | `src/app/api/billing/webhook/route.ts` |
| Future BYOK rotation described as background job | README only — **not implemented** in `src/` |

**Conclusion:** Background work is request-inline or webhook-driven; no first-class job queue in this repo.

---

## 4. Relevant database migration inventory

Ordered by filename (timestamp prefix). Purpose from headers / `CREATE` statements.

| Migration | Tables / functions / focus |
| --- | --- |
| `20260720000001_init.sql` | Extensions `pgcrypto`, `vector`; enums `memory_type|status|source`; `profiles`; `handle_new_user`; `set_updated_at` |
| `20260720000002_memories.sql` | `memories` + ivfflat embedding index |
| `20260720000003_documents.sql` | `documents`, `document_chunks` |
| `20260720000004_chat.sql` | `chat_sessions`, `chat_messages`, `message_context` |
| `20260720000005_audit_ratelimit.sql` | `audit_log`, `rate_limits`, `increment_rate_limit` |
| `20260720000006_rls.sql` | RLS enable + policies for core tables |
| `20260720000007_functions.sql` | `match_memories`, `match_document_chunks` |
| `20260720000008_storage.sql` | Storage bucket `documents` + object policies |
| `20260720000009_grants.sql` | Grants for PostgREST roles |
| `20260720180000_ensure_profile_bootstrap.sql` | Hardened `handle_new_user` |
| `20260721140000_inference_metering.sql` | `price_book`, `usage_events`, `credit_accounts`, `credit_ledger`, `apply_credit_delta` |
| `20260721140001_inference_grants.sql` | Grants for metering tables |
| `20260721180000_billing_byok_workspaces.sql` | `stripe_customers`, `subscriptions`, `user_provider_keys`, `workspaces`, `workspace_members` |
| `20260721190000_memory_pinned_at.sql` | `memories.pinned_at` |
| `20260721200000_stripe_webhook_events.sql` | Idempotent Stripe event claims |
| `20260721210000_commercial_plan_usage.sql` | Plan usage periods, grants, billing settings/telemetry, `record_plan_usage_turn` |
| `20260721220000_founding_offer_dismissed.sql` | Founding offer dismiss flag on profile/settings |
| `20260722000000_admin_roles.sql` | `user_roles`, `admin_audit_log`, role bootstrap trigger |
| `20260722120000_admin_entitlement_overrides.sql` | `admin_entitlement_grants`, `admin_plan_simulations` |
| `20260722140000_plan_entitlement_config.sql` | `plans`, `plan_versions`, `plan_entitlements` |
| `20260722160000_plan_editor_campaigns.sql` | Campaign overrides for plan editor |
| `20260722160001_plan_publish_rpc.sql` | `admin_publish_plan_version` |
| `20260722180000_provider_ops.sql` | `inference_providers`, `inference_model_overrides`, health/events tables |
| `20260722180001_provider_ops_grants.sql` | Grants |
| `20260722190000_promotions.sql` | `promotions`, `promotion_redemptions`, `redeem_promotion` |
| `20260722190001_promotions_grants.sql` | Grants |
| `20260722200000_system_operational_controls.sql` | `system_operational_controls`, registration shutdown trigger |
| `20260722200001_system_operational_controls_grants.sql` | Grants |

**Memory-core subset (highest priority for memory-system work):** init → memories → documents → chat → RLS → match functions → storage → grants → `memory_pinned_at`.

---

## 5. API route inventory

### Product / memory-adjacent

| Method | Route | File | Apparent role |
| --- | --- | --- | --- |
| POST | `/api/chat` | `api/chat/route.ts` | Chat orchestrator entry |
| POST | `/api/think` | `api/think/route.ts` | Thinking primary entry |
| GET | `/api/sessions/[id]` | `api/sessions/[id]/route.ts` | Restore session messages |
| GET/POST | `/api/memories` | `api/memories/route.ts` | List / create |
| GET/PATCH/DELETE | `/api/memories/[id]` | `api/memories/[id]/route.ts` | CRUD one memory |
| GET | `/api/memories/[id]/related` | `…/related/route.ts` | Related by similarity |
| GET/POST | `/api/documents` | `api/documents/route.ts` | List / upload+embed |
| DELETE | `/api/documents/[id]` | `api/documents/[id]/route.ts` | Delete file |
| GET | `/api/search` | `api/search/route.ts` | Vault unified search |
| PATCH | `/api/profile` | `api/profile/route.ts` | Profile update |
| DELETE | `/api/account` | `api/account/route.ts` | Wipe memories / delete account |
| GET | `/api/export` | `api/export/route.ts` | JSON export |
| GET | `/api/status` | `api/status/route.ts` | Diagnostics |
| GET | `/api/credits` | `api/credits/route.ts` | Wallet + recent usage |
| GET/POST/PATCH | `/api/workspaces` | `api/workspaces/route.ts` | Workspace CRUD |

### Billing (gates usage)

`/api/billing/checkout`, `portal`, `webhook`, `usage`, `settings`, `byok`, `dev-topup`, `promotions`

### Admin

`/api/admin/session`, `overview`, `users`, `users/[userId]`, `users/[userId]/actions`, `actions`, `audit`, `entitlements`, `plans`, `plans/[planId]`, `plans/campaigns`, `providers`, `providers/[providerId]`, `providers/[providerId]/health`, `models/[modelId]`, `promotions`, `promotions/redemptions`, `usage`, `system`, `billing/readiness`

---

## 6. Service and utility inventory

| Module | Key exports / role |
| --- | --- |
| `lib/memory` | `getMemoryProvider`, Supabase/Mem0 implementations |
| `lib/memory/extraction` | `extractCandidates`, LLM/heuristic providers, skip/schema |
| `lib/embeddings` | `getEmbeddingProvider`, `EMBEDDING_DIM`, `toVectorLiteral` |
| `lib/ai/context` | Prompt assembly + identity short-circuit |
| `lib/ai` | Legacy chat provider factory |
| `lib/orchestration/chat` | `runChatOrchestrator` |
| `lib/conversation/store` | Session/message/provenance persistence port |
| `lib/documents/*` | Extract, chunk, retrieve |
| `lib/inference/*` | Router, complete, meter, credits, adapters, provider-ops |
| `lib/think/intent` | Thinking intent heuristics |
| `lib/auth`, `profile` | Session + profile bootstrap |
| `lib/supabase/*` | Clients + middleware session |
| `lib/audit`, `ratelimit`, `validation`, `perf` | Cross-cutting |
| `lib/admin/*` | Staff console services |
| `lib/billing/*` | Commercial gating (adjacent) |
| `scripts/*` | Local ops only |

---

## 7. Prompt inventory

| Prompt / template | Location | Used by |
| --- | --- | --- |
| `BASE_SYSTEM_PROMPT` (brand assistant guidelines) | `src/lib/ai/context.ts` ~L8–13 | `buildSystemPrompt` → chat/think |
| Dynamic `USER IDENTITY` / `USER CONTEXT` / `END USER CONTEXT` fences | `src/lib/ai/context.ts` `buildSystemPrompt` ~L127+ | Chat + Think context injection |
| `formatIdentityFacts` / `augmentUserMessageForModel` | `src/lib/ai/context.ts` | Soft identity injection |
| `EXTRACTION_SYSTEM_PROMPT` | `src/lib/memory/extraction/llm.ts` L11–28 | `LlmExtractionProvider.extract` |
| Mock provider USER CONTEXT detection regexes | `src/lib/ai/mock.ts` | Offline demo assertions |
| Intent heuristics (not LLM prompts) | `src/lib/think/intent.ts` | Think route branching |
| Heuristic extraction patterns | `src/lib/memory/extraction/heuristic.ts` | Offline extraction |

**Assumption:** No other first-class system prompts exist outside `context.ts` and `extraction/llm.ts` for product chat/memory (admin/provider health probes may send trivial probe messages — not product memory prompts).

**Unknown:** Exact prompt text differences (if any) between `/api/think` additions vs orchestrator after statement-mode / intent branches — think route appends conditional content in places (~L416+).

---

## 8. Test inventory

| File | Focus (from imports/describe) |
| --- | --- |
| `tests/memory.test.ts` | Integration: RLS / memory provider (requires Supabase; in `test:integration`) |
| `tests/extraction.test.ts` | Extraction pipeline |
| `tests/redaction.test.ts` | Secret/sensitivity detection |
| `tests/context.test.ts` | Context / prompt builder |
| `tests/chat-provider.test.ts` | Mock vs OpenRouter provider selection |
| `tests/mem0-client.test.ts`, `mem0-mapping.test.ts` | Mem0 HTTP + metadata helpers |
| `tests/intent.test.ts` | Think intent classifier |
| `tests/inference.test.ts`, `models.test.ts` | Inference router / catalog |
| `tests/provider-ops.test.ts`, `provider-ops.integration.test.ts` | Provider ops routing / DB |
| `tests/profile.test.ts` | Profile helpers |
| `tests/perf.test.ts` | Perf helpers |
| `tests/production-safety.test.ts` | Dev top-up / production guards |
| Billing/admin suites | `commercial-*`, `plan-*`, `promotions*`, `stripe-*`, `admin-*`, `entitlement-*`, `live-readiness`, `system-controls`, `billing-providers` |
| `tests/helpers.ts`, `setup-env.ts` | Shared test utilities / env gate |

**Verified package scripts:** `pnpm check` = lint + typecheck + unit (excludes `*.integration.test.ts` and `memory.test.ts`); `pnpm check:full` adds integration.

---

## 9. Environment variable inventory

Sources: `.env.example` + `process.env.*` references under `src/`, `scripts/`, `tests/`.

### Core / Supabase

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client; local BYOK fallback |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | Local Google OAuth (CLI `config.toml`) |

### AI / memory / embeddings

| Variable | Role |
| --- | --- |
| `OPENROUTER_API_KEY` | Chat + LLM extraction + primary inference path |
| `OPENROUTER_API_KEYS` | Key pool |
| `OPENROUTER_BASE_URL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_TITLE` | OpenRouter client knobs |
| `EXTRACTION_MODEL`, `EXTRACTION_TIMEOUT_MS` | Extraction model + timeout |
| `EMBEDDING_PROVIDER` (`local` \| `openai`) | Embedding backend |
| `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL` | OpenAI embeddings / adapter |
| `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` | Direct provider adapters |
| `MEMORY_PROVIDER` (`supabase` \| `mem0`) | Memory backend |
| `MEM0_API_KEY`, `MEM0_API_BASE_URL` | Mem0 |

### Commercial / ops

| Variable | Role |
| --- | --- |
| `COMMERCIAL_MODE` | `disabled` \| `demo` \| `live` |
| `STRIPE_*` price/secret/webhook/coupon/live-ack | Payments |
| `NEXT_PUBLIC_APP_URL` | App base URL for Stripe redirects |
| `BYOK_ENCRYPTION_KEY` | Encrypt user provider keys |
| `FEATURE_VOICE`, `FEATURE_AUTO_TOPUP`, `FEATURE_SPEND_CAP_ENFORCEMENT`, `FEATURE_WORKSPACE_BUDGETS`, `FEATURE_DAILY_FAIR_USE`, `FEATURE_CREDIT_PACK_STOREFRONT` | Unfinished feature flags |
| `DEPLOYMENT_ID`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV` | Status/admin deployment identity |
| `PERF_TIMING` | Middleware/server timing logs |
| `NODE_ENV` | Production safety gates |
| `CV_INTEGRATION`, `CV_REQUIRE_SUPABASE` | Test gates |

---

## 10. External service inventory

| Service | Where integrated | Purpose |
| --- | --- | --- |
| **Supabase** (Auth, Postgres, Storage, pgvector) | `lib/supabase/*`, migrations, middleware | Auth, data, RLS, files, vectors |
| **OpenRouter** | `lib/ai/openrouter.ts`, inference adapters, extraction | Multi-model chat completions |
| **OpenAI** | Embeddings + inference adapter | Embeddings / optional chat |
| **Anthropic / Google / Groq** | `lib/inference/adapters` | Optional direct chat adapters |
| **Mem0** | `lib/memory/mem0*` | Optional semantic memory index |
| **Stripe** | `lib/billing/*`, webhook route | Subscriptions, checkout, portal |
| **Google OAuth** | Supabase Auth external provider | Sign-in (optional locally) |
| **Vercel** (hosting env vars only) | `VERCEL_*` in status/health | Deployment metadata — no Vercel SDK in deps |

---

## 11. Areas that appear duplicated

| Duplication | Evidence | Notes |
| --- | --- | --- |
| **`/api/chat` vs `/api/think`** | `ChatView` → chat; `ThinkingView` → think; think reimplements orchestration inline (~548 lines) while chat uses `runChatOrchestrator` | Primary product path appears to be Think (`/` redirect from `/chat`) |
| **Legacy `ChatProvider` (`lib/ai`) vs Inference adapters (`lib/inference/adapters`)** | Both talk to OpenRouter; extraction still uses `ChatProvider`; product chat uses `runInference` | README describes OpenRouter as first adapter, not product backend |
| **`lib/ai/models.ts` vs `lib/inference/models.ts`** | ai/models re-exports inference catalog for UI back-compat | Thin compatibility layer |
| **Vault pages vs legacy `(app)/memories|review|documents|settings|profile|chat|dashboard`** | Several legacy pages redirect; Vault is canonical under `/vault/*` | Preserve until specialists confirm which pages still linked |
| **User `audit_log` vs `admin_audit_log`** | `lib/audit.ts` vs `lib/admin/audit.ts` | Different audiences |
| **Search paths** | Semantic `MemoryProvider.retrieve` / `match_*` RPCs vs textual `/api/search` | Different UX purposes |
| **Brand naming** | Package/README “Context Vault”; inference/credits “Cortaix”; `BRAND.name` still “Context Vault” | Naming drift across layers |

---

## 12. Areas whose purpose is unclear

| Area | Why unclear | Verification needed |
| --- | --- | --- |
| Long-term status of `/api/chat` + `ChatView` | `/chat` redirects to `/`; Think is home | Confirm any remaining callers besides `ChatView` |
| Whether Think will be refactored onto `runChatOrchestrator` | Parallel logic, shared helpers only | Diff think vs orchestrator step-by-step |
| Workspaces vs single-user vault | Tables + API exist; product positioning unclear for memory scoping | Check if memories are workspace-scoped (likely user-scoped only) |
| Document `source: "document"` memory path | Enum includes it; upload path embeds chunks — may not create `memories` rows | Trace document → memory creation |
| Mem0 hybrid edge cases | Mirroring, delete sync, proposed status | Read `mem0-provider.ts` fully |
| Embedding metering vs chat metering | `meter-embed.ts` only for OpenAI embeddings | Confirm cost attribution for RAG |
| “Import” memory source | Enum value exists | Find import UI/API or dead enum |
| Background re-embed / backfill | No worker; `reembed` exists on provider | Who calls `reembed` besides edit API? |
| Admin vs product observability overlap | `/api/status` public vs `/admin/system` | Clarify intended ops model |

---

## Distilled: facts / conclusions / assumptions / unknowns / recommendations

### Verified repository facts

1. Next.js App Router app with Supabase + optional OpenRouter/Mem0/Stripe.
2. Memory domain code lives under `src/lib/memory/**` with DB in early migrations `*memories*`, `*documents*`, `*chat*`, `*functions*`.
3. Context injection is centralized in `src/lib/ai/context.ts`.
4. Two chat entrypoints exist: `/api/think` (primary UI) and `/api/chat` (orchestrator).
5. Extraction is always proposed into review queue per README + `extractCandidates` docs.
6. `pgvector` dimension fixed at 1536 (`EMBEDDING_DIM`).
7. No `docs/memory-system/` documents existed before this file.

### Architectural conclusions

1. Memory system is a **provider-port architecture** (Memory / Extraction / Embedding / DocumentRetriever / ConversationStore) with Supabase as default durable store.
2. Product “brain” loop is **retrieve → prompt → infer → provenance → extract(proposed)**.
3. Commercial/admin layers wrap the loop with credits, plan turns, and kill-switches but are separable from core memory semantics.

### Assumptions

1. Specialists can treat Vault + Think as the live UX; many `(app)/*` routes are legacy redirects.
2. No external job runner is required for current MVP behavior.
3. Mem0 is optional and off by default in local/demo matrices.

### Unknowns requiring verification

1. Exact behavioral delta between Think route and `runChatOrchestrator`.
2. All write paths that create/update embeddings and when metering applies.
3. Whether workspace IDs ever scope memory retrieval.
4. Completeness of provenance (`message_context`) for Think statement-only paths.
5. Dead code vs intentional dual OpenRouter stacks (`lib/ai/openrouter` vs adapters).

### Recommendations

1. Keep this map as the index; do not implement architecture changes from it.
2. Next agents should deep-read the file list below before proposing designs.
3. Prefer evidence citations (path + symbol + line range) in subsequent `docs/memory-system/0N-*.md` docs.
4. When comparing chat vs think, produce a side-by-side sequence diagram before recommending consolidation.

---

## Files next specialist agents must inspect

Priority ordered for memory-system architecture follow-on (context, retrieval, extraction, storage, chat loop).

### Tier A — core memory loop (mandatory)

1. `src/lib/orchestration/chat.ts`
2. `src/app/api/think/route.ts`
3. `src/app/api/chat/route.ts`
4. `src/lib/ai/context.ts`
5. `src/lib/memory/provider.ts`
6. `src/lib/memory/supabase-provider.ts`
7. `src/lib/memory/index.ts`
8. `src/lib/memory/extraction/index.ts`
9. `src/lib/memory/extraction/llm.ts`
10. `src/lib/memory/extraction/heuristic.ts`
11. `src/lib/memory/extraction/schema.ts`
12. `src/lib/memory/extraction/skip.ts`
13. `src/lib/memory/redaction.ts`
14. `src/lib/embeddings/index.ts`
15. `src/lib/documents/retrieve.ts`
16. `src/lib/documents/chunk.ts`
17. `src/lib/documents/extract.ts`
18. `src/lib/conversation/store.ts`
19. `src/lib/types.ts`
20. `src/lib/validation.ts`

### Tier B — persistence & retrieval SQL

21. `supabase/migrations/20260720000001_init.sql`
22. `supabase/migrations/20260720000002_memories.sql`
23. `supabase/migrations/20260720000003_documents.sql`
24. `supabase/migrations/20260720000004_chat.sql`
25. `supabase/migrations/20260720000006_rls.sql`
26. `supabase/migrations/20260720000007_functions.sql`
27. `supabase/migrations/20260720000008_storage.sql`
28. `supabase/migrations/20260720000009_grants.sql`
29. `supabase/migrations/20260721190000_memory_pinned_at.sql`

### Tier C — optional / alternate providers & inference bridge

30. `src/lib/memory/mem0-provider.ts`
31. `src/lib/memory/mem0/client.ts`
32. `src/lib/memory/mem0/mapping.ts`
33. `src/lib/ai/openrouter.ts`
34. `src/lib/ai/index.ts`
35. `src/lib/ai/mock.ts`
36. `src/lib/inference/complete.ts`
37. `src/lib/inference/router.ts`
38. `src/lib/inference/adapters/index.ts`
39. `src/lib/think/intent.ts`
40. `src/lib/billing/meter-embed.ts`

### Tier D — API + UI surfaces that exercise the loop

41. `src/app/api/memories/route.ts`
42. `src/app/api/memories/[id]/route.ts`
43. `src/app/api/memories/[id]/related/route.ts`
44. `src/app/api/documents/route.ts`
45. `src/app/api/search/route.ts`
46. `src/app/api/sessions/[id]/route.ts`
47. `src/app/api/export/route.ts`
48. `src/app/api/account/route.ts`
49. `src/app/api/status/route.ts`
50. `src/components/ThinkingView.tsx`
51. `src/components/ChatView.tsx`
52. `src/components/ReviewQueue.tsx`
53. `src/components/RelatedMemoriesStrip.tsx`
54. `src/app/page.tsx`
55. `src/app/(app)/vault/memories/page.tsx`
56. `src/app/(app)/vault/review/page.tsx`

### Tier E — tests & product docs (behavior contracts)

57. `tests/memory.test.ts`
58. `tests/extraction.test.ts`
59. `tests/context.test.ts`
60. `tests/redaction.test.ts`
61. `tests/chat-provider.test.ts`
62. `tests/mem0-client.test.ts`
63. `tests/mem0-mapping.test.ts`
64. `tests/intent.test.ts`
65. `README.md` (Architecture / Memory extraction sections)
66. `docs/demo-mode-test-matrix.md`
67. `AGENTS.md` (local/env gotchas)

### Tier F — auth & gates (as needed for end-to-end designs)

68. `src/lib/auth.ts`
69. `src/lib/profile.ts`
70. `src/lib/supabase/middleware.ts`
71. `src/lib/ratelimit.ts`
72. `src/lib/audit.ts`
73. `src/lib/admin/system-controls.ts`
74. `.env.example`

---

*End of repository map. Next suggested planning doc: deep dive on the chat/think orchestration delta and memory provider contracts (`02-…`).*
