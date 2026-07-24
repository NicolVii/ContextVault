# Stage 13 — Memory Framework Build-versus-Reuse Evaluation

| Field | Value |
| --- | --- |
| Stage | 13 — Framework evaluation |
| Status | Draft for architecture review |
| Document date | 2026-07-24 |
| Access / research cutoff | 2026-07-24 |
| Binding predecessors | Stages 0, 5–12 (especially 7–12) |
| Output | Evaluation only — **no implementation authorized** |
| Repository context | Cortaix / Context Vault (`NicolVii/ContextVault`) |

---

## 0. Executive summary

**Recommended architecture: Recommendation B — Native canonical core plus optional framework adapters.**

Evidence from Stages 7–12 and current primary-source research (accessed 2026-07-24) shows:

1. **No evaluated complete memory platform may become Cortaix’s canonical memory layer.** Every full-stack candidate fails at least one hard gate when treated as authoritative personal truth (Gates 1, 2, 8, and often 4–7).
2. **PostgreSQL + Supabase + pgvector + native Stage 8–12 services remain the only path that preserves approved contracts** for trust, lifecycle, disclosure, conflict, WRRF×policy retrieval, and deletion/export.
3. **Narrow optional adapters remain plausible** after Stage 15 tests: current Mem0 (hardened to ID-only `ExternalMemoryIndexPort`), optional Graphiti-derived relationship projection (PoC), commodity rerankers, and possibly connector services. None are required for correctness of Stage 12 Option B.
4. **Current Mem0 hybrid support must stop treating remote text as authority** and must gain native fallback when Mem0 is unavailable. It should migrate to an optional derived-index adapter or be retired, not remain a co-authority retrieval path.
5. **Weighted scores do not override failed hard gates.** Native baseline scores highest on architecture/governance; several managed products score well on operational convenience but fail as core dependencies.

This stage does **not** authorize Stages 14–17 implementation work beyond planning handoffs.

---

## 1. Scope and method

### 1.1 In scope

- Evidence-based build-versus-reuse evaluation of memory frameworks and vendors
- Hard-gate qualification, weighted scoring, cost/TCO scenarios, lock-in, security threats
- Current repository assessment against Stages 7–12
- Component-level decisions (`build_native` … `reject_external_ownership`)
- Proof-of-concept **specifications only** (no PoC implementation in this PR)
- Handoffs to Stages 14–17

### 1.2 Out of scope

- Production TypeScript, React, APIs, migrations, SQL, prompts, tests, dependencies, config, env vars, provider integrations, feature flags, deployment settings
- Edits to Stages 0–12
- Beginning Stages 14–17 implementation
- Proof-of-concept coding

### 1.3 Binding architecture (non-reopened)

This evaluation **preserves** Stages 7–12. It does not redefine eligibility, trust, conflict packing, disclosure, embedding-space rules, or:

```text
Final(c) = WRRF(c) × (1 + λ_policy × Policy(c))
```

with `λ_policy = 0.15`, `k = 60`.

### 1.4 Non-negotiable Cortaix contracts

1. PostgreSQL remains canonical for memory assertions, ownership, trust, lifecycle, temporal state, conflict state, disclosure, entity identity, user decisions, provenance, influence records, and operational coordination.
2. External systems are derived, rebuildable, and replaceable.
3. An external framework may never become the authoritative source of personal truth.
4. External retrieval results must return canonical Cortaix IDs or IDs deterministically mapped to canonical Cortaix records.
5. Remote text must never bypass canonical reconciliation.
6. External frameworks cannot decide trust, eligibility, ownership, disclosure, conflict resolution, current versus historical truth, required versus optional evidence, final context packing, or provider compatibility.
7. Graph edges never independently grant truth.
8. Retrieval semantics remain: WRRF × bounded multiplicative policy → deterministic deduplication → conflict-safe grouping → disclosure-aware provider planning → token-aware packing.
9. No framework may redefine `Final(c) = WRRF(c) × (1 + λ_policy × Policy(c))`.
10. Query disclosure must be checked before every external embedding, index search, planner-model, reranker, and final inference call.
11. BYOK does not automatically bypass disclosure policy.
12. Embedding spaces remain pinned and separate; cross-space similarity is forbidden.
13. Cortaix must continue safely when an optional external framework is unavailable.
14. Cortaix must preserve provider and model independence.
15. Agent-autonomous memory writes may not bypass Stages 8–10 validation, trust, deduplication, and conflict pipelines.
16. “Always visible” or automatically injected framework memory cannot bypass Stage 12 relevance and context-budget rules.
17. User deletion, export, correction, retention, and purge semantics must remain enforceable from canonical Cortaix state.

### 1.5 Research method

Primary sources preferred: official docs, repos, API references, licenses, changelogs, papers, reproducible benchmarks, official pricing/deployment docs. Third-party reviews labelled secondary. Marketing claims are not treated as verified facts.

For material external claims, this document records source metadata in §3 and per-candidate evidence tables. Benchmark claims are labelled:

```text
vendor-reported | paper-reported | independently reproduced | not reproducible from available information
```

Confidence levels: `high | medium | low | unverified`.

**Access date for all research unless noted:** 2026-07-24.

---

## 2. Scoring models

### 2.1 Hard gates

| Gate | Question |
| --- | --- |
| G1 Canonical authority | Can Cortaix retain PostgreSQL as canonical truth? |
| G2 Canonical reconciliation | Can results return stable IDs mappable to current Cortaix records? |
| G3 User isolation | Can every operation be scoped to one Cortaix user with server-side enforcement? |
| G4 Disclosure and privacy | Can Cortaix prevent restricted query/evidence transfer? |
| G5 Deletion, purge, export | Delete one record/user; purge embeddings/graph; confirm; rebuild; export; exit? |
| G6 Deterministic fallback | Continue with PostgreSQL/FTS/pgvector/native retrieval if candidate unavailable? |
| G7 Embedding-space control | Pin provider, model, dimensions, normalization, version, reindex? |
| G8 Retrieval-semantic preservation | Retain WRRF, policy bound, eligibility, conflict-safe presentation, packing, influence? |
| G9 Model/provider independence | Avoid lock to one inference provider or agent runtime? |
| G10 Legal/licensing viability | OSS/commercial/hosted terms viable (flag legal review; not legal advice)? |

Outcomes: `pass | conditional_pass | fail | unknown`.

**Rule:** A failed hard gate blocks recommendation as Cortaix’s **canonical memory layer**. The candidate may still qualify for a narrower adapter role when the failed gate is irrelevant to that role.

### 2.2 Weighted model

| Category | Weight |
| --- | ---: |
| Architecture compatibility | 20 |
| Security, privacy, and governance | 18 |
| Data ownership and portability | 12 |
| Retrieval and temporal capability | 12 |
| Integration fit (Next.js, TypeScript, Supabase, PostgreSQL, Vercel) | 10 |
| Operational reliability and observability | 8 |
| Vendor and model independence | 7 |
| Performance and latency potential | 5 |
| Twelve-month total cost of ownership | 5 |
| Maturity, maintenance, community, and licensing clarity | 3 |
| **Total** | **100** |

```text
weightedScore = Σ ((categoryScore / 5) × categoryWeight)
```

Category scores are 0–5. High weighted scores **cannot** override a failed hard gate for core adoption.

### 2.3 Confidence and evidence completeness

Evidence completeness ≈ share of material claims backed by `high`/`medium` primary evidence for that candidate (approximate; unknowns listed explicitly).

---

## 3. Source register (primary and secondary)

| ID | Title | Owner | Type | Date / version signal | Access date | Verified independently? | Commercial interest? | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Stages 7–12 memory-system docs | Cortaix | Internal architecture | In-repo | 2026-07-24 | Yes (repo) | Product owner | high |
| S2 | Current repo memory/embeddings/docs code | Cortaix | Source code | In-repo | 2026-07-24 | Yes | Product owner | high |
| S3 | mem0ai/mem0 GitHub + Apache-2.0 LICENSE | Mem0 | OSS repo / license | Updated 2026-07-24 | 2026-07-24 | Yes (GitHub API) | Vendor | high |
| S4 | Mem0 OSS overview / REST API docs | Mem0 | Official docs | Live docs | 2026-07-24 | Partially (doc fetch) | Vendor | high |
| S5 | Mem0 Platform pricing | Mem0 | Official pricing | Page published signal 2026-07-24 | 2026-07-24 | Pricing page only | Vendor | medium |
| S6 | Mem0 Platform search API (v3) | Mem0 | Official API ref | Live docs | 2026-07-24 | Doc fetch | Vendor | high |
| S7 | getzep/graphiti README + Apache-2.0 | Zep AI | OSS repo | Updated 2026-07-24 | 2026-07-24 | Yes (raw README) | Vendor | high |
| S8 | arXiv:2501.13956 Zep/Graphiti paper | Zep AI authors | Research paper | 2025 | 2026-07-24 | Paper abstract/body | Vendor-authored | medium |
| S9 | Zep product + pricing pages | Zep | Official marketing/pricing | Live | 2026-07-24 | Pricing page | Vendor | medium |
| S10 | topoteretes/cognee README + Apache-2.0 | Cognee | OSS repo | Updated 2026-07-24 | 2026-07-24 | Yes | Vendor | high |
| S11 | Cognee docs + pricing | Cognee | Official docs/pricing | Live | 2026-07-24 | Doc fetch | Vendor | medium |
| S12 | letta-ai/letta README + Apache-2.0 | Letta | OSS repo | Updated 2026-07-24 | 2026-07-24 | Yes | Vendor | high |
| S13 | Letta documentation hub | Letta | Official docs | Live | 2026-07-24 | Partial | Vendor | medium |
| S14 | langchain-ai/langmem MIT + docs | LangChain | OSS + docs | Updated 2026-07-24 | 2026-07-24 | Yes | Vendor | high |
| S15 | supermemoryai/supermemory MIT + docs/pricing | Supermemory | OSS + managed docs | Updated 2026-07-24 | 2026-07-24 | Partial | Vendor | medium |
| S16 | LlamaIndex memory module docs | LlamaIndex | Official docs | Live | 2026-07-24 | Doc fetch | Vendor | high |
| S17 | run-llama/llama_index MIT | LlamaIndex | OSS repo | Updated 2026-07-24 | 2026-07-24 | Yes | Vendor | high |
| S18 | memodb-io/memobase Apache-2.0 | Memobase | OSS repo | Live | 2026-07-24 | Metadata only | Vendor | medium |
| S19 | OSU-NLP-Group/HippoRAG MIT | OSU NLP | Research OSS | Live | 2026-07-24 | Metadata | Academic | medium |
| S20 | Secondary comparison articles (Ry Walker, Vectorize) | Third parties | Secondary review | 2026 | 2026-07-24 | No | Mixed | low |

**Note:** Enterprise SLA pricing, DPA subprocessors, and purge attestation SLAs are often **unknown** without sales engagement. Marked `unknown` where not confirmed.

---

## 4. Current repository assessment

### 4.1 What is already implemented

| Area | Reality today |
| --- | --- |
| Store | `public.memories` in PostgreSQL via Supabase; RLS own-row policies |
| Vectors | pgvector `vector(1536)` + `match_memories` RPC |
| Provider port | `MemoryProvider` in `src/lib/memory/provider.ts` |
| Default provider | `SupabaseMemoryProvider` (embed + insert + RPC retrieve) |
| Optional provider | `Mem0MemoryProvider` hybrid when `MEMORY_PROVIDER=mem0` + `MEM0_API_KEY` |
| Embeddings | `LocalEmbeddingProvider` (default) or OpenAI; `EMBEDDING_DIM=1536` fixed |
| Documents | Upload → chunk (1000/150) → embed → `document_chunks` + `match_document_chunks` |
| Chat/Think | Route-level retrieve (limit 8, floor 0.05), force-merge profile memories, build system prompt |
| Extraction | LLM or heuristic candidates → often `proposed` |
| Export | JSON profile + memories (`select("*")`) + document metadata |
| Deletion | Single delete; account scopes; Think “forget” archives by ILIKE |
| Dependencies | No Mem0/LangChain/LlamaIndex packages; Mem0 via raw `fetch` |

Stages **8–12 are documentation only** in production code. Flat `type`/`status`/`source` model remains; no WRRF, no entity graph tables, no outbox, no Deletion Coordinator, no query-disclosure service.

### 4.2 What current Mem0 integration does

Documented in `src/lib/memory/mem0-provider.ts` and `src/lib/memory/mem0/*`:

1. Inserts Supabase rows with `embedding: null`.
2. Mirrors content to Mem0 Platform with `infer: false` and metadata including `cv_memory_id`.
3. Stores Mem0 id in `source_detail` as `mem0:<uuid>`.
4. On Mem0 failure after insert, **deletes** the Supabase row (fail-closed for writes).
5. On retrieve, prefers hits with `cv_memory_id` and rehydrates from Supabase.
6. **If no hit carries `cv_memory_id`, returns remote Mem0 text** as `RetrievedMemory` — known Stage 5/7/12 violation risk.
7. Mem0 API errors do **not** fall back to `match_memories`.
8. Supports update/delete/delete-all via Mem0 HTTP API.

### 4.3 Where Mem0 currently violates or risks Stages 7–12

| Risk | Stage conflict |
| --- | --- |
| Remote-text fallback without canonical reconcile | Stages 7, 12 — external index never supplies authoritative text |
| `embedding: null` on Mem0 path | Breaks native pgvector fallback / dual-channel readiness |
| No query-disclosure gate before Mem0 search | Stage 12 purposes |
| Mem0 outage → retrieval failure (no PG degrade) | Stage 12 degradation; Gate 6 |
| Delete ordering / account wipe edge cases | Stage 6/9 deletion coordinator needs |
| Vendor retention after delete | Unknown (Stage 9 contractual open) |
| Hybrid can become de-facto authority | Gate 1 |

### 4.4 Native Supabase/pgvector already available

- Canonical row store + RLS
- Cosine ANN via ivfflat + RPCs
- Document chunk store + retrieval
- Local deterministic embeddings for offline/dev
- Export of canonical rows
- Thin provider/embedding/document ports

**Not yet available natively (designed Stages 8–12):** assertion model, trust/lifecycle engines, WRRF fusion, conflict packing, entity/relationship projections, durable jobs, influence explainability schema, deletion workflows.

### 4.5 Must build regardless of framework choice

Strategic / correctness-critical (cannot be outsourced to a memory SaaS as authority):

1. Canonical assertion store and Gateway mutation path  
2. Trust, lifecycle, temporal, conflict, disclosure axes  
3. Validation / secret gates / dedupe / conflict pipeline (Stages 8–10)  
4. Query disclosure + evidence disclosure  
5. Eligibility before context  
6. WRRF × policy fusion, dedupe, conflict-safe grouping, packing  
7. Influence / provenance recording  
8. Deletion coordinator + purge confirmation across derived systems  
9. Entity operational identity and user decisions (Stage 11)  
10. Provider independence / BYOK disclosure rules  

### 4.6 Commodity / suitable for reuse

- Embedding **generation clients** (HTTP to OpenAI-compatible APIs) behind pinned spaces  
- PDF text extraction (`pdf-parse` already)  
- Optional **reranker HTTP APIs** behind `RetrievalReranker`  
- Optional **derived vector/FTS indexes** if ID-reconciled  
- Observability exporters (metrics/traces)  
- Connector sync **workers** if outputs land in Gateway as untrusted intake  

### 4.7 Strategically differentiating for Cortaix

- User-owned personal truth with orthogonal trust/lifecycle/disclosure  
- Conflict-safe, disclosure-aware, provider-compatible packing  
- Canonical reconciliation-first retrieval  
- Influence explainability  
- Model/provider independence as a product promise  

### 4.8 Dependency and runtime constraints

- Next.js 14 App Router, TypeScript, Vercel-oriented serverless routes  
- Local Supabase stack for Postgres/Auth/Storage  
- No Python runtime in production dependency tree today  
- Background work today is mostly request-path; Stage 9 designs durable Postgres outbox/workers  

### 4.9 TypeScript / Next.js / Vercel implications

- Prefer TypeScript adapters and HTTP APIs over embedding Python services in the critical path  
- Long-running graph builders / LLM extraction loops are poor fits for serverless request handlers; belong in workers  
- Optional external services must time out and degrade  

### 4.10 Preserve / adapt / retire

| Code | Disposition |
| --- | --- |
| `MemoryProvider`, `EmbeddingProvider`, `DocumentRetriever` ports | **Preserve** and evolve toward Stage 9/12 ports |
| `SupabaseMemoryProvider` + pgvector RPCs | **Preserve** as native baseline channel |
| Mem0 HTTP client + mapping helpers | **Adapt** into strict `ExternalMemoryIndexPort` (IDs only) or retire |
| Think/Chat prompt interpolation of memories as trusted system text | **Retire/replace** per Stage 12 untrusted rendering |
| Profile force-inject at similarity 1.0 | **Retire/replace** with ranked profile channel |
| Flat `memories` schema | **Migrate** under Stage 16 toward Stage 9 assertions (not authorized here) |

---

## 5. Candidate set and classification

### 5.1 Minimum set + discovery

| # | Candidate | Classification(s) | Substitute vs complementary |
| --- | --- | --- | --- |
| 1 | Native Cortaix (control) | complete memory platform (target) + supporting utilities | Control baseline |
| 2 | Mem0 open source | open-source memory engine; optional external derived index | Complementary index / engine — **not** identical to managed |
| 3 | Mem0 managed platform | managed memory API; complete memory platform posture | Complementary derived index only under adapters |
| 4 | Graphiti OSS | temporal graph framework; open-source memory engine (graph) | Complementary derived projection |
| 5 | Zep managed | managed memory API; temporal graph platform | Complete product — not a drop-in Stage 12 replacement |
| 6 | Cognee OSS | open-source memory engine; temporal/graph RAG platform | Complementary derived layer |
| 7 | Cognee managed/cloud | managed memory API | Complementary |
| 8 | Letta OSS | agent runtime | **Not** a memory-store substitute |
| 9 | Letta managed/cloud | agent runtime + managed hosting | Not a memory-store substitute |
| 10 | LangGraph / LangMem | orchestration framework + supporting memory utilities | Complementary tools; not Stage 12 substitute |
| 11 | Supermemory managed (+ OSS available) | managed memory API; document/RAG + connectors | Complementary; connectors interesting |
| 12 | LlamaIndex memory/retrieval | document/RAG framework; retrieval framework | Complementary components |
| 13 | **Memobase** (additional) | open-source memory engine / managed-adjacent profile memory | Complementary; credibility screen pass (Apache-2.0, active) |
| 14 | **HippoRAG** (additional) | retrieval framework (research) | Complementary retrieval research — not a product memory layer |
| 15 | **Cohere/Voyage-class rerankers** (additional category) | optional reranker | Complementary only |

**Credibility screen notes:** Memobase passes as a credible OSS memory engine (~2.8k stars, Apache-2.0). HippoRAG passes as credible retrieval research (NeurIPS’24 lineage, MIT) but is not a managed product. Emerging MCP memory servers are watchlisted as interoperability approaches, not scored as core platforms.

### 5.2 Architecture ports evaluated

```text
ExternalMemoryIndexPort
EmbeddingIndexPort
DocumentSearchPort
EntityProjectionPort
RelationshipProjectionPort
ExtractionAssistPort
CandidateGenerationPort
RetrievalReranker
ConversationSummaryPort
ConnectorIngestionPort
ObservabilityPort
```

---

## 6. Native baseline (control)

### 6.1 Composition

| Layer | Source |
| --- | --- |
| Canonical store | PostgreSQL / Supabase |
| Vectors | pgvector |
| Lexical | PostgreSQL FTS (Stage 12 channel; implementation pending) |
| Exact | PostgreSQL equality / structured filters |
| Services | Native Stage 8–12 services |
| Optional libs | Small commodity libs only (HTTP clients, PDF parse, metrics) |

### 6.2 Already available vs to build

| Component | Status |
| --- | --- |
| Row store + RLS | Available |
| pgvector ANN | Available (cosine) |
| Document chunk retrieval | Available (basic) |
| Embedding providers (local/OpenAI) | Available |
| FTS hybrid channel | Needs Cortaix service + SQL |
| Assertion/trust/lifecycle model | Needs Cortaix service + schema (Stage 9) |
| Processing pipeline | Needs workers + Gateway |
| WRRF fusion + packing | Needs Cortaix services |
| Entity/relationship projections | Needs Cortaix services; optional external assist |
| Deletion coordinator | Needs Cortaix services |
| Influence records | Needs schema + recorder |

### 6.3 Complexity

| Dimension | Assessment |
| --- | --- |
| Engineering complexity | **High** for Stages 8–12 delivery — but already designed |
| Operational complexity | **Medium** if staying on Supabase/Postgres; rises with workers |
| Differentiation | **Highest** |
| Lock-in | **Low** (own schema; Postgres portable) |
| Security control | **Highest** (RLS + Gateway + disclosure) |
| Migration flexibility | **Highest** |

### 6.4 Strengths / weaknesses

**Strengths:** Satisfies all hard gates by construction; matches product differentiation; offline-capable with local embeddings; no vendor memory authority; fits TypeScript/Next.js.

**Weaknesses:** Engineering time, testing, on-call, evaluation harnesses, reindexing, migrations, security reviews, and operational tooling are **real costs** (not free). Temporal graph sophistication lags Graphiti/Zep **as a derived graph product**, unless built or adapted later.

### 6.5 Twelve-month cost assumptions (native)

Non-vendor engineering dominates. Order-of-magnitude ranges (USD, illustrative; **not** accounting advice):

| Cost type | Scenario S | Scenario M | Scenario L |
| --- | --- | --- | --- |
| Engineering (design→ship Stage 8–12 core) | $80k–$200k | $150k–$350k | $250k–$600k |
| Maintenance / on-call / eval | $20k–$60k | $40k–$120k | $80k–$250k |
| Database / Supabase | $0–$200/mo local→small | $200–$2k/mo | $2k–$15k/mo **unknown** at true L without sizing |
| Model/embedding | low (local/mock possible) | moderate | high with traffic |
| Vendor memory fees | $0 | $0 | $0 |

Native is **not free**; it purchases control and differentiation.

---

## 7. Hard-gate results

Legend for “as core memory layer” vs “as narrow adapter”.

| Candidate | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | Core outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Native Cortaix | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass | **Only full pass as core** |
| Mem0 OSS | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | pass | pass | fail as core |
| Mem0 managed | fail | conditional_pass | conditional_pass | fail→cond. | conditional_pass | fail | unknown | fail | pass | conditional_pass | fail as core |
| Graphiti OSS | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | pass | pass | fail as core |
| Zep managed | fail | conditional_pass | conditional_pass | fail→cond. | unknown | fail | unknown | fail | pass | conditional_pass | fail as core |
| Cognee OSS | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | pass | pass | fail as core |
| Cognee managed | fail | unknown | conditional_pass | fail→cond. | unknown | fail | unknown | fail | pass | conditional_pass | fail as core |
| Letta OSS | fail | fail | conditional_pass | fail | unknown | fail | unknown | fail | fail | pass | fail as core |
| Letta managed | fail | fail | conditional_pass | fail | unknown | fail | unknown | fail | fail | conditional_pass | fail as core |
| LangGraph/LangMem | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | conditional_pass | pass | fail as core |
| Supermemory managed | fail | conditional_pass | conditional_pass | fail→cond. | conditional_pass | fail | unknown | fail | pass | conditional_pass | fail as core |
| LlamaIndex mem/retr | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | pass | conditional_pass | fail | pass | pass | fail as core |
| Memobase | fail | conditional_pass | conditional_pass | conditional_pass | unknown | conditional_pass | unknown | fail | pass | pass | fail as core |
| HippoRAG | fail | fail | n/a | n/a | n/a | pass | conditional_pass | fail | pass | pass | fail as core (not a store) |
| Reranker APIs | n/a | n/a | conditional_pass | conditional_pass | n/a | pass | n/a | conditional_pass | pass | conditional_pass | not a memory layer |

**Interpretation:** Only Native passes all gates as the canonical memory layer. Others may still be `adopt_as_optional_adapter`, `reuse_selected_components`, `proof_of_concept_before_decision`, `watchlist`, or `reject_for_cortaix` for specific ports.

---

## 8. Weighted scores (post hard gates)

Scores reflect **best realistic Cortaix use** (adapter/complementary), not pretending a failed core candidate is a core platform. Native scored as the core baseline.

| Candidate | Arch 20 | Sec 18 | Own 12 | Retr 12 | Integ 10 | Ops 8 | Indep 7 | Perf 5 | TCO 5 | Mat 3 | Weighted | Evidence % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native Cortaix | 5 | 5 | 5 | 4 | 5 | 4 | 5 | 3 | 3 | 4 | **88.4** | 90 |
| Mem0 OSS (adapter lens) | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 4 | 5 | **64.6** | 75 |
| Mem0 managed (adapter) | 2 | 2 | 2 | 4 | 4 | 4 | 3 | 4 | 3 | 5 | **58.6** | 70 |
| Graphiti OSS (projection) | 3 | 3 | 3 | 5 | 2 | 2 | 4 | 3 | 3 | 5 | **63.0** | 75 |
| Zep managed | 1 | 2 | 2 | 5 | 3 | 4 | 3 | 4 | 2 | 4 | **52.4** | 65 |
| Cognee OSS | 3 | 3 | 3 | 4 | 2 | 2 | 4 | 3 | 3 | 4 | **60.2** | 70 |
| Cognee managed | 2 | 2 | 2 | 4 | 2 | 3 | 3 | 3 | 3 | 3 | **50.4** | 55 |
| Letta OSS | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 4 | **36.0** | 60 |
| Letta managed | 1 | 1 | 1 | 2 | 2 | 3 | 1 | 2 | 2 | 3 | **31.8** | 50 |
| LangMem/LangGraph | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 3 | 4 | **44.0** | 70 |
| Supermemory managed | 2 | 2 | 2 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | **56.2** | 60 |
| LlamaIndex components | 2 | 3 | 4 | 3 | 2 | 3 | 4 | 3 | 4 | 5 | **59.4** | 75 |
| Memobase | 2 | 2 | 3 | 3 | 2 | 2 | 3 | 2 | 3 | 3 | **47.0** | 45 |
| HippoRAG | 2 | 3 | 4 | 4 | 1 | 2 | 4 | 2 | 4 | 4 | **55.4** | 55 |
| Reranker APIs | 3 | 2 | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 4 | **64.2** | 60 |

**Leaders:** Native (architecture/governance), then Mem0 OSS / rerankers / Graphiti as optional-capability leaders — **subject to hard gates**.

---

## 9. Per-candidate evaluations

### 9.1 Native Cortaix

**Primary outcome:** `adopt_as_core_dependency` (it *is* the core).

**Ports:** Owns all semantic ports internally; may call commodity embedding/rerank HTTP.

**Hard gates:** all `pass`.

**Evidence completeness:** ~90%.

### 9.2 Mem0 open source

**Classification:** open-source memory engine; Python-first library + self-hosted REST server; defaults include LLM extraction, embeddings, vector store (Qdrant/SQLite history; server can use Postgres+pgvector per docs).

**License:** Apache-2.0 (S3) — generally permissive; **legal review still required** for distribution/compliance posture.

**Hard gates as core:** G1 fail (own memory records/summaries become product center of gravity), G8 fail (prompt-oriented memory API ≠ Stage 12 pipeline). As **ExternalMemoryIndexPort** with `infer:false`, metadata IDs, no remote text, and PG fallback: several gates become `conditional_pass`.

**Port fit (acceptable role):**

| Port | Fit |
| --- | --- |
| ExternalMemoryIndexPort | **Best permitted role** if ID-only + reconcile |
| ExtractionAssistPort | Possible but duplicates Stage 10; high disclosure cost |
| CandidateGenerationPort | Only if scores map to channel ranks without owning Final |
| Others | Weak / reject as authority |

**Port contract sketch (ExternalMemoryIndexPort):**

1. **Owns:** derived embeddings/index entries only  
2. **Cortaix owns:** assertions, trust, eligibility, fusion, packing, disclosure  
3. **Input:** allowed memory text + metadata IDs when `allow_external_index_disclosure` and query disclosure permit  
4. **Output:** remote ids + opaque scores + **required** `cv_memory_id` / mapping keys — **no authoritative text**  
5. **ID mapping:** `external_memory_index_entries` ↔ assertion/revision  
6. **Disclosure:** purpose checks before embed/search  
7. **Failure:** timeout → skip channel; continue PG channels  
8. **Rebuild:** re-push from canonical  
9. **Deletion:** delete mapping + remote id; verify; job tracked  
10. **Replace:** swap provider behind port  

**Primary outcome:** `adopt_as_optional_adapter` (hardened), else retire if Stage 15 fails.

**PoC:** yes — smallest ID-only + outage + purge tests (§16).

### 9.3 Mem0 managed platform

**Pricing (S5, vendor page 2026-07-24):** Hobby free (10k add / 1k retrieval / mo); Starter $19; Pro $249 (graph memory); Enterprise custom. Usage-based option claimed — details **unknown** without sales.

**API:** v3 search returns scored memories with filters requiring entity ids inside `filters` (S6). Supports delete/delete_all (docs). Export completeness / purge attestation: **unknown**.

**Isolation:** API key + `user_id` filters. Server-side enforcement strength vs confused-deputy: **conditional** — must not trust client-only filters in Cortaix gateway design; still depends on vendor isolation. Operator access: managed service has operator access by definition.

**Hard gates as core:** fail G1/G8; G4 fails for sensitive workloads unless disclosure can deny all calls; G6 fails if made mandatory; G7 unknown (platform-managed embedders).

**Primary outcome:** `watchlist` for managed acceleration of **non-authoritative** index only; not default. Prefer OSS/self-host or native if disclosure-sensitive.

**Lock-in score:** 3 (high) if dual-write becomes load-bearing.

### 9.4 Graphiti open source

**What it is:** Temporal context graph framework (Zep). Facts with validity windows; episodes/provenance; hybrid semantic+BM25+graph retrieval (S7). Paper arXiv:2501.13956 is **vendor-authored** (S8) — label `paper-reported` / not independently reproduced here.

**Requirements:** Python ≥3.10; Neo4j 5.26 / FalkorDB / Neptune / (Kuzu deprecated); defaults to OpenAI for LLM+embeddings (S7).

**Conflict with Stage 11 Option E:** dedicated graph DB **rejected for v1 default**. Graphiti therefore cannot be a required dependency for v1.

**Port fit:** strongest as optional `RelationshipProjectionPort` / `EntityProjectionPort` **derived** builder — edges never grant truth; rebuild from assertions; zero-hop/one-hop caps remain Cortaix-owned.

**Hard gates as core:** G1/G8 fail. As derived projection: G6 conditional if optional; G7 conditional if Cortaix pins embed space used for projection search separately from canonical spaces.

**Primary outcome:** `proof_of_concept_before_decision` for **derived relationship projection only**.

**Lock-in:** 2–3 if Neo4j operations become habitual; keep rebuildable.

### 9.5 Zep managed platform

**Product:** Managed context lake / temporal graphs; `memory.get()` returns prompt-ready context string (official quickstart pattern) — **directly conflicts** with Stage 12 packing ownership if used as primary interface.

**Pricing (S9):** Flex ~$104/mo billed annually (50k credits); Flex Plus ~$312/mo annual; Enterprise custom. Credit semantics require workload mapping — **estimate only**.

**SDKs:** Python/TS/Go claimed on Graphiti/Zep materials.

**Primary outcome:** `reject_for_cortaix` as core/primary retrieval; `watchlist` only for enterprise graph features that could later feed derived projections **without** consuming prompt-ready context as authority.

**Lock-in:** 4 if used as primary memory API.

### 9.6 Cognee open source

**What it is:** OSS AI memory platform; vector + graph; Apache-2.0 (S10). Python engine; TS/Rust **clients** exist. Notable: can run memory layer on **Postgres** (graph+vectors+metadata) per README (S10) — better affinity than Neo4j-mandatory stacks, but still a competing memory engine.

**Primary outcome:** `watchlist` / possible later PoC for derived graph-on-Postgres — **not** adopted now because it wants to own ingest/recall semantics overlapping Stages 8–12.

**Hard gates as core:** fail G1/G8.

### 9.7 Cognee managed/cloud

**Pricing (S11):** Free tier 1M tokens; Standard $2.50 / 1M tokens + $5/workspace; Enterprise contact. Cloud model noted as gpt-oss-120b on pricing page — treat as **vendor claim**.

**Primary outcome:** `watchlist`. Lock-in 3+.

### 9.8 Letta open source / managed

**What it is:** Stateful **agent runtime** (formerly MemGPT), not a pluggable personal-memory store for an existing Next.js app (S12–S13). Memory tiers are inside the agent harness. Agent-autonomous memory edits conflict with Stages 8–10 unless completely subordinated — practically a product fork.

**G9:** fail as core (runtime lock). G8 fail. G1 fail.

**Primary outcome:** `reject_for_cortaix` as core dependency and as memory layer. No meaningful component reuse recommended for Stage 12 ports.

### 9.9 LangGraph / LangMem

**LangMem:** MIT Python SDK for long-term memory tools + background managers; integrates with LangGraph store (S14). Useful ideas for extraction tooling; **not** a retrieval authority.

**Primary outcome:** `reject_for_cortaix` as orchestration/memory core; `reuse_selected_components` only as design inspiration for `ExtractionAssistPort` — actual dependency optional and Python-heavy (`watchlist`).

**Agent-autonomous hot-path memory tools:** incompatible with Stage 10 unless wrapped as proposals through Gateway.

### 9.10 Supermemory managed (+ OSS repo)

**What it is:** Memory/context API with profiles, hybrid search, connectors (Drive/Notion/Gmail/GitHub…), TypeScript-friendly ecosystem (S15). OSS MIT repo exists; managed API is primary product path for many features.

**Benchmarks:** README claims #1 on LongMemEval/LoCoMo/ConvoMem — **vendor-reported**; methodology independence **not verified** in this evaluation → do not select on that basis.

**Connectors:** strongest differentiator vs native build cost for `ConnectorIngestionPort` — still must land as untrusted intake into Gateway.

**Forget APIs:** soft-delete / agentic forget exist in docs — purge attestation & cross-system confirm **unknown**.

**Primary outcome:** `watchlist` for connectors; `reject_for_cortaix` as canonical memory; possible future `optional_external_adapter` for connectors only after Stage 15.

**Lock-in:** 3–4 if connectors+memory couple.

### 9.11 LlamaIndex memory and retrieval

**Memory blocks** (static / fact extraction / vector) merge into prompt-oriented memory with token limits (S16–S17). Excellent **document/RAG** ecosystem; overlaps Stage 12 packing if used as agent Memory object.

**Primary outcome:** `reuse_selected_components` for document ingestion/retrieval patterns **selectively**; `reject_for_cortaix` as personal-memory authority. Prefer keeping current native document pipeline unless a clear gap appears.

### 9.12 Additional: Memobase

User-profile long-term memory (Apache-2.0, Python) (S18). Incomplete evidence on ID mapping, disclosure, and Next.js fit → `watchlist`. Not recommended for adoption now.

### 9.13 Additional: HippoRAG

Research retrieval (PPR over KG) (S19). Potential future inspiration for graph retrieval channel scoring — **not** a product dependency. `watchlist`.

### 9.14 Additional: Reranker APIs (Cohere/Voyage-class)

Fit `RetrievalReranker` optional port. Must respect disclosure; cannot change eligibility; default remains identity/noop. `adopt_as_optional_adapter` candidate after cost/latency PoC — **not required** for Stage 12 correctness.

---

## 10. Build-versus-reuse decomposition

| # | Component | Decision | Reuse candidate | Reason |
| --- | --- | --- | --- | --- |
| 1 | Canonical assertion store | `build_native` / `reject_external_ownership` | — | Gate 1 |
| 2 | Trust and lifecycle engine | `build_native` / `reject_external_ownership` | — | Stage 8 |
| 3 | Extraction assistance | `build_native` + `optional_external_adapter` | LLM providers; not Mem0-as-authority | Gateway-owned |
| 4 | Deduplication | `build_native` | — | Conflict/trust coupled |
| 5 | Conflict detection | `build_native` | — | Stage 10/12 |
| 6 | Entity extraction | `build_native` + optional LLM assist | — | Stage 11 |
| 7 | Entity resolution | `build_native` | — | User decisions canonical |
| 8 | Relationship projection | `build_native` + `proof_of_concept_required` | Graphiti (derived only) | Edges ≠ truth |
| 9 | Temporal graph | `defer` / optional PoC | Graphiti/Zep derived | Not v1 required DB |
| 10 | Embedding generation | `reuse_standard_library` / HTTP clients | OpenAI-compatible | Pinned spaces |
| 11 | Vector indexing | `build_native` (pgvector) + optional adapter | Mem0 index | PG primary |
| 12 | FTS | `build_native` | Postgres FTS | Stage 12 channel |
| 13 | Exact search | `build_native` | SQL | — |
| 14 | Hybrid fusion | `build_native` | — | WRRF owned |
| 15 | Reranking | `optional_external_adapter` | Cohere/Voyage-class | Optional |
| 16 | Context packing | `build_native` / `reject_external_ownership` | — | Stage 12 |
| 17 | Conversation summaries | `build_native` (derived) | — | Confirm-before-trust |
| 18 | Document ingestion | `build_native` (+ selective patterns) | LlamaIndex ideas only | Existing pipeline |
| 19 | Connectors | `defer` / `optional_external_adapter` | Supermemory watchlist | After core |
| 20 | Observability | `reuse_standard_library` | OTEL etc. | — |
| 21 | Influence and provenance | `build_native` | — | Stage 12 |
| 22 | Evaluation tooling | `build_native` | open benchmarks as datasets | Stage 15 |

---

## 11. Cost and scale scenarios

### 11.1 Shared assumptions (ranges)

| Assumption | S | M | L |
| --- | --- | --- | --- |
| MAU | 1,000 | 10,000 | 100,000 |
| Turns / user / month | 20–40 | 30–60 | 40–80 |
| Candidate memories considered / turn | 20–50 | 40–80 | 50–120 |
| Memory writes / turn (avg) | 0.2–0.6 | 0.3–0.8 | 0.4–1.0 |
| Embedding ops / turn | 1–3 | 2–5 | 3–8 |
| External memory API calls | 0 if native | optional | optional |
| Document volume | low | moderate | large |
| Retention | user-controlled; default long | same | same + stricter ops |

### 11.2 Cost separation (illustrative monthly ranges + engineering)

**Native-only core (Recommendation B without paid adapters):**

| Bucket | S | M | L |
| --- | --- | --- | --- |
| Vendor memory fees | $0 | $0 | $0 |
| Model/embedding | $0–$200 | $200–$3k | $3k–$40k |
| Database | $0–$200 | $200–$2k | $2k–$15k (unknown ceiling) |
| Infra/workers | $0–$100 | $100–$1k | $1k–$10k |
| Engineering (amortized monthly) | $5k–$15k | $8k–$25k | $12k–$40k |
| Migration/exit | low | low | low |

**If Mem0 managed used as optional index (not recommended default):** map add/retrieval to Mem0 plan limits (S5). At M/L, Pro $249 may be insufficient → usage-based/enterprise **unknown**. Treat as additive vendor fees + still pay native engineering.

**Zep credits / Supermemory SM tokens / Cognee token pricing:** map only after measured episode sizes; currently **unknown** at L without instrumentation.

**Do not invent enterprise pricing.**

---

## 12. Performance assessment

| Concern | Native PG/pgvector | Mem0 managed | Graphiti/Zep graph | Evidence type |
| --- | --- | --- | --- | --- |
| Write latency | Good for row insert; embed adds cost | Eventual/async add patterns exist | LLM extraction heavy | estimated / vendor |
| Retrieval latency | Stage 12 assumes low–medium for Option B | Vendor claims sub-50ms class for platform — **vendor-reported** | Sub-200ms claims — **vendor-reported** | vendor-reported |
| Background processing | Needs workers | Vendor-side | Required | estimated |
| Serverless suitability | Request path OK; workers needed | HTTP OK | Poor for Python+Neo4j in-request | estimated |
| Reindex cost | PG rebuild jobs | Re-push | Graph rebuild expensive | estimated |
| Stage 12 latency fit | Designed for it | OK as **optional channel** if timed out | Optional only | estimated |

Do **not** treat LongMemEval/DMR vendor numbers as comparable across products or as Cortaix packing quality.

---

## 13. Lock-in and exit analysis

| Candidate | Ext data | Raw retained? | Emb export | Graph export | Stable IDs | History/prov survive | Corrections survive | Delete verifiable | Rebuild | Migration difficulty | Max depth | Lock-in |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| Native | PG | yes | yes | n/a native | yes | yes | yes | yes | n/a | low | 0 | 0 |
| Mem0 OSS | vectors/history | configurable | depends | if enabled | mem0 ids | partial | via canonical | conditional | from PG | medium | 1 | 1–2 |
| Mem0 managed | vendor store | vendor | unknown | pro graph unknown | mem0 ids | unknown | via canonical | conditional | from PG | medium–high | 1 | 3 |
| Graphiti | graph DB | episodes | model-dep | yes in DB | graph uuids | strong in graph | must mirror decisions in PG | conditional | from assertions | high | 1 | 2–3 |
| Zep | managed graph | yes | unknown | unknown | zep ids | vendor | via canonical | unknown | from PG | high | 1 | 4 |
| Supermemory | managed | yes | unknown | unknown | sm ids | partial APIs | via canonical | soft-forget | from PG | high | 1 | 3–4 |
| Letta | agent state | yes | n/a | n/a | agent ids | agent-centric | poor fit | unknown | rewrite product | severe | 2 | 5 |

**Maximum acceptable dependency depth for Cortaix:** **1** optional derived system behind a port, always rebuildable from PostgreSQL.

---

## 14. Benchmark and evidence review

| Benchmark | Whose claim | Dataset/task | Relevant to Cortaix? | Label |
| --- | --- | --- | --- | --- |
| Mem0 evaluation framework (memory-benchmarks repo) | Mem0 | vendor OSS eval | Partial (retrieval quality ≠ trust/disclosure) | vendor-reported; reproducibility possible via their repo — **not reproduced here** |
| Zep DMR 94.8% vs MemGPT 93.4% | Zep paper | DMR | Low — agent memory QA ≠ Stage 12 packing | paper-reported / vendor-authored |
| Zep LongMemEval (+latency) | Zep paper | LongMemEval | Medium for temporal QA; not governance | paper-reported |
| Supermemory #1 LongMemEval/LoCoMo/ConvoMem | Supermemory README | those benches | Low until independent | vendor-reported |
| Cognee arXiv 2505.24478 | Cognee authors | KG↔LLM interface | Low–medium | paper-reported |
| HippoRAG NeurIPS’24 | Academic | RAG multi-hop | Medium for graph retrieval ideas | paper-reported |

**Rule used:** no framework selected primarily because of one vendor benchmark.

---

## 15. Security analysis (≥25 threats)

For each: threat → candidate types → architectural protection → operational protection → residual risk → Stage 14 question → Stage 15 test.

1. **Cross-user retrieval** — managed/OSS indexes — Gateway forces Cortaix `userId`; ignore vendor results lacking mapping — key rotation, scoped keys — residual confused deputy — Can vendor filters be bypassed? — Isolation suite.  
2. **Vendor tenant-filter failure** — managed — Never trust filter-only; map IDs then RLS reload — audit samples — residual vendor bug — Prove server-side isolation? — Cross-tenant probe.  
3. **Remote text becoming authoritative** — Mem0/Zep/Supermemory — Forbid remote-text fallback — lint/tests — residual code regression — Is reconcile always on? — No-text-authority test.  
4. **Stale external facts** — all derived — Eligibility from canonical timestamps/status — rebuild jobs — residual sync lag — How stale is acceptable? — Staleness SLA test.  
5. **Deleted canonical still retrievable externally** — all derived — Deletion coordinator; suppress by canonical miss — verify deletes — residual vendor soft-delete — Is purge confirmed? — Deleted-record suppression.  
6. **Incomplete purge** — managed — Track per-system deletion state — manual attest — residual unknown vendor retention — Contractual purge? — Purge evidence test.  
7. **Query secret leakage** — all external calls — QueryDisclosureService deny — redaction logs — residual side channels — Purpose matrix complete? — Disclosure deny test.  
8. **Provider-restricted evidence leakage** — external index/rerank/infer — evidence disclosure flags — policy monitors — residual mis-tagging — BYOK bypass attempts? — Evidence disclosure test.  
9. **Embedding-space drift** — managed embedders — Pin space_id; reject cross-space — version monitors — residual silent vendor change — Who controls model? — Drift detection.  
10. **Silent model changes** — managed — Contract pins; health checks — vendor notices — residual — Can we detect? — Canary embeddings.  
11. **Unversioned retrieval changes** — managed — `retrieval_policy_version` owned by Cortaix — changelogs — residual vendor rerank — Freeze fusion locally? — Version pin test.  
12. **Framework-owned trust decisions** — agent runtimes/memory platforms — Trust only via Gateway — reject agent self-write paths — residual — Hot-path tools? — Write-path conformance.  
13. **Agent-autonomous writes** — Letta/LangMem tools — proposals only — disable tools — residual — Can writes bypass validation? — Injection of tool writes.  
14. **Always-visible memory bypass** — profiles/framework injection — Stage 12 ranked channels + budget — — residual — Profile force-inject gone? — Packing budget test.  
15. **Prompt injection via framework context** — prompt-ready APIs — Untrusted rendering — — residual — Structured delimiters sufficient? — Injection corpus.  
16. **Graph edges as truth** — Graphiti/Zep/Cognee — Edges derived; assertions decide — — residual — Graph-only answers? — Conflict vs edge test.  
17. **Conflict collapse** — summarizers — ConflictContextService — — residual — Summaries merging opposites? — Conflict preservation.  
18. **Historical as current** — temporal graphs — Temporal axes in canonical eligibility — — residual — Invalidated edge leakage? — Temporal correctness.  
19. **Opaque reranker behaviour** — rerank APIs — Optional; log features; bound effect — — residual — Rerank promoting ineligible? — Eligibility-after-rerank.  
20. **Benchmark overfitting** — vendor marketing — Don’t select on benches alone — — residual — Eval harness bias? — Own golden set.  
21. **Vendor outage** — managed — Optional channel; native continue — status pages — residual — Timeouts correct? — Outage fallback.  
22. **Rate limiting** — managed — Backoff; degrade — budgets — residual — User-visible errors? — Rate-limit soak.  
23. **API-version retirement** — managed — Adapter version pins — — residual — — Contract watch.  
24. **Licensing changes** — OSS+managed — Pin versions; legal review — — residual — — License watch.  
25. **Pricing changes** — managed — Caps; native fallback — finance alerts — residual — — TCO revisit.  
26. **Service termination** — managed — Exit/rebuild plan — backups — residual — — Exit drill.  
27. **Export incompleteness** — managed — Canonical export from PG — — residual — — Export parity test.  
28. **Migration lock-in** — dual-write systems — Single canonical; derived disposable — — residual — — Rebuild test.  
29. **Supply-chain compromise** — OSS deps/Python services — Minimal deps; pin hashes — audits — residual — — SBOM review.  
30. **Self-host config exposure** — OSS servers — Private networks; secrets — — residual — — Hardening checklist.  
31. **Python service expansion** — Graphiti/Cognee/Mem0 OSS — Isolate workers; don’t embed in Next — — residual — — Boundary review.  
32. **Background-worker failure** — all async — Durable outbox; idempotency — — residual — — Retry/idempotency tests.  
33. **Duplicate canonical and external writes** — hybrid adapters — Idempotent mapping keys — — residual — — Dual-write divergence test.

---

## 16. Proof-of-concept recommendations (not implemented)

### 16.1 Unnecessary PoCs

- Letta as Cortaix memory core (hard incompatibility)  
- Zep/Supermemory/Mem0 as canonical truth store  
- Any PoC that requires remote text without IDs  
- Replacing WRRF with vendor fusion to “see if better”

### 16.2 Plausible smallest PoCs

#### PoC-A — Mem0 as ExternalMemoryIndexPort (optional)

| Field | Spec |
| --- | --- |
| Hypothesis | ID-only Mem0 channel improves recall without authority leaks |
| Port | ExternalMemoryIndexPort |
| Dataset | 200 seeded assertions + paraphrases |
| Golden queries | 30 Stage 12-like queries |
| Security cases | cross-user, disclosure deny, secret query |
| Deletion test | delete assertion → Mem0 miss + mapping gone |
| Outage test | Mem0 5xx → native-only success |
| Canonical reconcile | hits without `cv_memory_id` discarded |
| Latency | p50/p95 channel vs PG |
| Cost | add/search counts |
| Exit/rebuild | wipe Mem0; rebuild from PG |
| Success | zero remote-text authority; ≥parity on golden; outage OK |
| Failure | any unmapped text packed; isolation miss |
| Budget | small (days of eng, not a rewrite) |

#### PoC-B — Graphiti derived projection

| Field | Spec |
| --- | --- |
| Hypothesis | Temporal edges improve relationship channel without truth grant |
| Port | RelationshipProjectionPort |
| Dataset | assertion-backed relationship corpus |
| Success | rebuildable; edge≠truth; hop caps; purge works |
| Failure | graph-only facts influence trust/eligibility |
| Budget | bounded spike; includes Neo4j/Falkor ops cost realism |

#### PoC-C — Optional reranker

| Field | Spec |
| --- | --- |
| Hypothesis | Rerank improves nDCG without breaking eligibility/disclosure |
| Port | RetrievalReranker |
| Success | ineligible never promoted; disclosure denied never sent |
| Failure | rerank required for correctness |

---

## 17. Worked adoption scenarios (≥20)

1. **Native-only retrieval** — PG channels → WRRF×policy → pack; no external calls.  
2. **Mem0 returns remote text without canonical ID** — discard hit; log; do not pack.  
3. **External framework returns deleted memory** — canonical reload misses → suppress.  
4. **External framework unavailable** — skip channel; serve native.  
5. **External provider changes embedding model** — space_id mismatch → disable channel; reindex required.  
6. **Query disclosure denies external search** — no Mem0/Graphiti/rerank calls.  
7. **Evidence may not leave Cortaix** — withhold from external index & providers; maybe local-only pack.  
8. **Optional graph adapter stale** — low weight / drop; assertions still retrieve.  
9. **Graph framework creates false relationship** — no trust grant; user decision / supporting assertions required.  
10. **User corrects a memory** — Gateway revision; derived indexes update async; old remote suppressed.  
11. **User deletes account** — Deletion coordinator purges PG + all derived; Auth last.  
12. **User exports vault** — export canonical PG; external optional.  
13. **Python-only candidate** — run as isolated worker or reject for request path.  
14. **Long-running workers on Vercel product** — use durable jobs/workers off request thread.  
15. **Managed pricing triples** — disable adapter; native continues.  
16. **OSS project abandoned** — remove adapter; rebuild from PG.  
17. **License changes** — legal review; freeze version; prepare exit.  
18. **Strong benchmark, weak methodology** — ignore for selection; run own eval.  
19. **Excellent retrieval, weak deletion** — reject managed for sensitive data.  
20. **Prompt-ready context violates packing** — refuse interface; demand candidate IDs.  
21. **Optional reranker only** — plug RetrievalReranker; noop default remains.  
22. **Connectors otherwise costly** — consider Supermemory connector adapter later; intake via Gateway.  
23. **External graph rebuildable from PostgreSQL** — acceptable derived depth 1.  
24. **Exit from current Mem0** — stop dual-write; backfill embeddings; remove remote-text path; delete vendor data.  
25. **Native costs more eng time but preserves differentiation** — accept under Recommendation B.

---

## 18. Decision outcomes (per candidate)

| Candidate | Primary outcome |
| --- | --- |
| Native Cortaix | `adopt_as_core_dependency` |
| Mem0 OSS | `adopt_as_optional_adapter` (hardened ID-only) |
| Mem0 managed | `watchlist` (optional non-default) |
| Graphiti OSS | `proof_of_concept_before_decision` (derived relationships) |
| Zep managed | `reject_for_cortaix` as core; `watchlist` otherwise |
| Cognee OSS | `watchlist` |
| Cognee managed | `watchlist` |
| Letta OSS | `reject_for_cortaix` |
| Letta managed | `reject_for_cortaix` |
| LangGraph/LangMem | `reject_for_cortaix` as core; inspiration-only watchlist |
| Supermemory | `reject_for_cortaix` as core; connector `watchlist` |
| LlamaIndex | `reuse_selected_components` (docs/RAG patterns only) |
| Memobase | `watchlist` |
| HippoRAG | `watchlist` |
| Reranker APIs | `adopt_as_optional_adapter` (after cheap PoC) |

---

## 19. Required recommendation

### 19.1 Choice

**Recommendation B — Native canonical core plus optional framework adapters.**

Not A (too absolute on “small libraries only” — optional adapters remain valuable).  
Not C (no framework proven safe as primary derived extraction/retrieval engine yet).  
Not D (managed acceleration not justified as default given disclosure/deletion unknowns).  
Not E (enough evidence to choose B; PoCs are conditional for adapters, not for the core decision).

### 19.2 Exact components built natively

Canonical store; trust/lifecycle; disclosure; validation/dedupe/conflict; entity identity & user decisions; WRRF×policy fusion; eligibility; packing; influence; deletion coordinator; PG vector/FTS/exact channels; document pipeline core; query disclosure.

### 19.3 Exact components reused

HTTP embedding clients; PDF extraction; optional rerank HTTP; observability libraries; existing Supabase/Auth/RLS.

### 19.4 Exact candidates selected (now)

- Native core  
- Mem0 path retained only as **future/optional** hardened adapter (current behaviour must be corrected in implementation stages)  
- Optional reranker interface (noop default)

### 19.5 Exact candidates rejected (as core / as runtime)

Letta (OSS+managed), Zep as primary memory, Supermemory as canonical memory, LangGraph as product runtime, any graph DB as v1 required dependency, any vendor prompt-ready memory API as Stage 12 replacement.

### 19.6 Final vs conditional

| Final now | Conditional |
| --- | --- |
| PostgreSQL canonical | Mem0 adapter enablement after PoC-A |
| Stage 12 semantics immutable | Graphiti projection after PoC-B |
| No Letta/LangGraph runtime adoption | Connector vendor after core + Stage 15 |
| No remote-text authority | Reranker vendor choice |

### 19.7 Evidence that could reverse B → C/D

- Independently reproduced quality gains **and** hard-gate-safe ID-only APIs with verified purge/isolation  
- Demonstrated eng-cost impossibility of native Stage 12 within constraints **without** sacrificing gates (unlikely given designs exist)  
- Contractual purge/isolation attestations stronger than native ops for a narrow workload

### 19.8 Migration path from current Mem0 support

1. Treat Mem0 as derived index only.  
2. Remove remote-text fallback.  
3. Require `cv_memory_id` mapping.  
4. Dual-embed or backfill pgvector for fallback.  
5. Add timeouts + native degrade.  
6. Wire deletion coordinator.  
7. Gate all calls on query/evidence disclosure.  
8. Optionally disable by default until PoC-A passes.

### 19.9 Impact on Stages 14–17

- **14:** Red-team Recommendation B bias, dual-write, purge, adapter complexity.  
- **15:** Conformance tests listed below before any adapter ships.  
- **16:** Sequence native Stage 8–12 first; adapters after ports exist.  
- **17:** Preserve gates/invariants; no framework may reopen them.

---

## 20. Decision matrices

### 20.1 Candidate matrix

| Candidate | Hard gates | Weighted | Evidence % | Best permitted role | Lock-in | TCO | Verdict |
| --- | --- | ---: | ---: | --- | ---: | --- | --- |
| Native Cortaix | all pass | 88.4 | 90 | Core platform | 0 | Eng-heavy, vendor-light | **Adopt core** |
| Mem0 OSS | fail core; cond. adapter | 64.6 | 75 | ExternalMemoryIndexPort | 1–2 | Low–med | Optional adapter |
| Mem0 managed | fail core | 58.6 | 70 | Optional derived index | 3 | Med + unknown enterprise | Watchlist |
| Graphiti OSS | fail core | 63.0 | 75 | RelationshipProjectionPort | 2–3 | Ops-heavy | PoC |
| Zep managed | fail core | 52.4 | 65 | None required | 4 | Med–high unknown | Reject core |
| Cognee OSS | fail core | 60.2 | 70 | Future derived graph | 2 | Ops | Watchlist |
| Cognee managed | fail core | 50.4 | 55 | None now | 3 | Token billing | Watchlist |
| Letta OSS/managed | fail core | 31–36 | 50–60 | None | 5 | High product fork | Reject |
| LangMem/LangGraph | fail core | 44.0 | 70 | Inspiration only | 2 | Python tax | Reject core |
| Supermemory | fail core | 56.2 | 60 | Connector watchlist | 3–4 | Usage billing | Reject core |
| LlamaIndex | fail core | 59.4 | 75 | Doc/RAG patterns | 1 | Low | Reuse selectively |
| Memobase | fail core | 47.0 | 45 | Watchlist | 2 | Unknown | Watchlist |
| HippoRAG | fail core | 55.4 | 55 | Research ideas | 0–1 | Eng | Watchlist |
| Rerankers | n/a core | 64.2 | 60 | RetrievalReranker | 1 | Low | Optional |

### 20.2 Component matrix

| Cortaix component | Native | Reuse candidate | Decision | Reason |
| --- | --- | --- | --- | --- |
| Assertion store | Yes | — | build_native | Gate 1 |
| Trust/lifecycle | Yes | — | build_native | Stage 8 |
| Extraction assist | Yes | LLM HTTP | build_native + optional | Gateway |
| Dedupe/conflict | Yes | — | build_native | Coupled to trust |
| Entity/relationship | Yes | Graphiti PoC | build_native + PoC | Edges derived |
| Embeddings | Client | OpenAI-compatible | reuse clients | Pinned spaces |
| Vector index | pgvector | Mem0 optional | native primary | Fallback |
| FTS/exact/fusion/pack | Yes | — | build_native | Stage 12 |
| Rerank | Interface | Cohere/Voyage-class | optional_external_adapter | Non-correctness |
| Summaries | Yes | — | build_native | Derived |
| Documents | Yes | LlamaIndex patterns | build_native | Existing |
| Connectors | Later | Supermemory | defer/watchlist | After core |
| Observability | Yes | OTEL | reuse_standard_library | Commodity |
| Influence | Yes | — | build_native | Stage 12 |
| Eval tooling | Yes | public datasets | build_native | Stage 15 |

---

## 21. Invariants

1. Framework evaluation cannot redefine Stages 7–12.  
2. PostgreSQL remains canonical regardless of recommendation.  
3. A weighted score cannot override a failed hard gate.  
4. Vendor benchmark claims remain labelled.  
5. Unknown pricing remains unknown.  
6. A managed service is never assumed to provide enforceable tenant isolation without evidence.  
7. External text never bypasses canonical reconciliation.  
8. External memory IDs never replace canonical assertion IDs.  
9. Optional external outage does not prevent safe native retrieval.  
10. User deletion propagates to every derived system.  
11. Provider disclosure remains Cortaix-owned.  
12. Trust and conflict decisions remain Cortaix-owned.  
13. Final context packing remains Cortaix-owned.  
14. Agent-autonomous writes remain subject to validation.  
15. Framework adoption must have an exit strategy.  
16. Self-hosting does not automatically mean low operational risk.  
17. Open source does not automatically mean portable.  
18. Managed does not automatically mean production-safe.  
19. A framework may be accepted for one port and rejected for another.  
20. Stage 13 does not authorize implementation.

---

## 22. Acceptance questions (answered)

1. **Native baseline?** PostgreSQL/Supabase/pgvector/FTS + native Stage 8–12 services (§6).  
2. **Current Mem0?** Hybrid derived index with dangerous remote-text fallback (§4.2).  
3. **Strategic differentiation?** Trust/lifecycle/disclosure/conflict/WRRF packing/influence/provider independence.  
4. **Commodity?** Embed clients, PDF parse, optional rerank, OTEL, connector sync later.  
5. **Pass all hard gates?** Only Native as core.  
6. **Fail as canonical layers?** All external complete platforms/runtimes evaluated.  
7. **Valid narrow adapters?** Mem0 (hardened), optional rerankers; Graphiti after PoC.  
8. **Best temporal graphs?** Graphiti OSS (then Zep managed) — as **derived**, not authority.  
9. **Best retrieval-only reuse?** Rerankers + native PG channels; LlamaIndex patterns for docs.  
10. **Best connectors?** Supermemory (watchlist) among evaluated set.  
11. **Python services?** Mem0 OSS engine, Graphiti, Cognee, LangMem, HippoRAG, Memobase.  
12. **Fit Next/Vercel?** Native TS + HTTP adapters; avoid in-request Python/Neo4j.  
13. **Long-running workers?** Graphiti/Cognee/Mem0 extraction; Stage 9 outbox.  
14. **Self-hostable?** Mem0 OSS, Graphiti, Cognee OSS, Letta (rejected), Supermemory OSS claims, LlamaIndex.  
15. **Self-host ops cost?** Non-trivial (DB/graph/LLM keys/upgrades/on-call) — not free.  
16. **Managed-only?** Zep product path primarily managed; several “cloud” offerings.  
17. **Stable canonical IDs?** Only if Cortaix metadata mapping enforced; vendor IDs alone insufficient.  
18. **Opaque prompt-ready text?** Zep `memory.get`, LangMem/LlamaIndex memory merge, many managed defaults.  
19. **Permit Cortaix-owned ranking?** Only ID/score candidate APIs — not prompt blobs.  
20. **Permit Cortaix-owned packing?** Same — candidates in, packer out.  
21. **Deletion/purge?** Native yes; Mem0 APIs exist but attestation unknown; many managed soft-delete.  
22. **Export?** Native canonical export; vendor export often incomplete/unknown.  
23. **Acceptable licensing?** Apache-2.0/MIT candidates generally OK pending legal review; hosted ToS separate.  
24. **Unacceptable lock-in?** Letta runtime; Zep/Supermemory as primary memory.  
25. **Unverified claims?** Sub-50ms/sub-200ms; benchmark crowns; enterprise purge SLAs; some isolation guarantees.  
26. **Cost ranges?** §11.  
27. **Important unknowns?** Vendor purge attestation; managed embed pins; enterprise prices; Mem0 retention; dual-write divergence rates.  
28. **PoC necessary?** PoC-A Mem0 ID-only; PoC-B Graphiti optional; PoC-C rerank optional.  
29. **PoC unnecessary?** Letta/Zep/Mem0 as canonical; WRRF replacement.  
30. **Current Mem0?** Harden or disable; migrate to optional adapter (§19.8).  
31. **Build regardless?** §4.5 / §10 native rows.  
32. **Avoid building?** Competing agent runtime; mandatory Neo4j; vendor trust engines; prompt-ready memory platforms as core.  
33. **Recommendation?** **B**.  
34. **Reverse?** §19.7.  
35. **Stage 14 attack?** §23.  
36. **Stage 15 test?** §24.  
37. **Stage 16 needs?** Native ports first; adapters later; dedicated PRs for deps.  
38. **Stage 17 preserve?** All invariants §21 and hard gates.

---

## 23. Stage 14 handoff (red-team questions)

- Is Recommendation B biased toward Stages 7–12 because they exist, underestimating managed ops advantages?  
- Are native engineering/on-call costs understated in §6/§11?  
- Are privacy/isolation guarantees for adapters assumed rather than proven?  
- Is canonical reconciliation realistic under vendor API partial failures?  
- Can an optional adapter quietly become mandatory via product defaults?  
- Does dual-writing create unrecoverable divergence?  
- Can vendor scores/summaries leak into trust decisions through UI or heuristics?  
- Are deletion/purge guarantees strong enough for GDPR-class expectations?  
- Are benchmark comparisons invalid across methodologies?  
- Is the adapter boundary too complex vs “just native”?  
- Does Recommendation B create too much operational surface if Graphiti+Mem0+rerank all land?  
- Should Mem0 be removed entirely rather than hardened?

---

## 24. Stage 15 handoff (tests before adoption)

- Adapter conformance (ID-only, timeouts)  
- Canonical ID reconciliation  
- Deleted-record suppression  
- Cross-user isolation  
- Query-disclosure enforcement  
- Evidence-disclosure enforcement  
- Embedding-version drift  
- Outage fallback  
- Rebuild from PostgreSQL  
- Export parity  
- Purge verification  
- Latency budgets vs Stage 12  
- Cost metering  
- Retrieval quality on Cortaix golden set  
- Conflict preservation  
- Temporal correctness  
- Prompt-injection resistance  
- Framework version upgrade safety  
- Exit migration drill  

---

## 25. Stages 16–17 handoff

1. **Framework work in roadmap:** only after native ports exist; optional adapters phased.  
2. **First adapters:** harden/disable Mem0 path; noop rerank interface.  
3. **Wait:** Graphiti, connectors, managed Mem0 default, Cognee, Supermemory core.  
4. **Dedicated PRs for deps:** any `mem0ai`, graphiti, neo4j, cohere, etc.  
5. **PoC before production:** PoC-A required before Mem0 optional enablement; PoC-B before graph projection.  
6. **Remain reversible:** all external adapters; feature flags; rebuild scripts.  
7. **Not authorized yet:** schema migrations, provider code changes, dependency adds, prompt changes, turning off remote-text in code (implementation stages only).

---

## 26. Final report checklist (Stage 13)

1. **Candidates evaluated:** Native, Mem0 OSS, Mem0 managed, Graphiti, Zep, Cognee OSS, Cognee managed, Letta OSS, Letta managed, LangGraph/LangMem, Supermemory, LlamaIndex, Memobase, HippoRAG, reranker APIs.  
2. **Hard gates:** Only Native passes as core; others fail G1/G8 (and more) as canonical layers.  
3. **Weighted leaders:** Native 88.4; Mem0 OSS ~64.6; rerankers ~64.2; Graphiti ~63.0 (adapter lenses).  
4. **Evidence leaders:** Native, Mem0 docs/repo, Graphiti README, LlamaIndex docs.  
5. **Native build:** Feasible and required; non-trivial eng/ops cost acknowledged.  
6. **Best optional adapters:** Hardened Mem0 index; optional rerankers; Graphiti PoC for derived relationships.  
7. **Rejected:** Letta; Zep/Supermemory/Mem0/Cognee/Lang* as canonical or runtime cores.  
8. **Current Mem0:** Optional derived index only after harden; remove remote-text authority; ensure fallback.  
9. **TCO:** Native eng-dominant; managed fees additive and often unknown at L.  
10. **Lock-in:** Keep depth ≤1 derived; avoid runtime capture.  
11. **Recommended architecture:** **B**.  
12. **Required PoCs:** A (Mem0 ID-only); optional B/C.  
13. **Unknowns:** purge attestations, enterprise prices, embed pins on managed, retention after delete.  
14. **Stage 14:** red-team list §23.  
15. **Safe to merge Stage 13?** Yes as **draft docs-only** after review — evaluation complete.  
16. **May Stage 14 begin after review?** Yes — red-team only; still no implementation.

---

## 27. Document control

| Item | Value |
| --- | --- |
| Authoring mode | Planning / evaluation |
| Implementation authorized | **No** |
| Next stage | 14 — Security red-team of this recommendation |
| PR posture | Draft documentation PR only |
