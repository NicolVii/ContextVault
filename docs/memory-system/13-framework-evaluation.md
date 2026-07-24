# Stage 13 — Memory Framework Build-versus-Reuse Evaluation

| Field | Value |
| --- | --- |
| Stage | 13 — Framework evaluation |
| Status | Draft for architecture review (methodological revision) |
| Document date | 2026-07-24 |
| Research access date | 2026-07-24 |
| Binding predecessors | Stages 0, 5–12 (especially 7–12) |
| Output | Evaluation only — **no implementation authorized** |
| Repository context | Cortaix / Context Vault (`NicolVii/ContextVault`) |
| Revision note | Corrects weighted arithmetic, separates core vs adapter roles, expands auditable evidence, rebuilds TCO, aligns PoC-gated outcomes |

---

## 0. Executive summary

**Final architecture decision: Recommendation B — Native canonical core plus optional framework adapters.**

Corrected evidence still supports B. Corrected scoring does **not** select any external provider now.

| Decision class | Content |
| --- | --- |
| **Final** | PostgreSQL-backed native Cortaix owns canonical memory, trust, lifecycle, disclosure, WRRF×policy retrieval, packing, and deletion/export. |
| **Ports preserved (no provider selected)** | `ExternalMemoryIndexPort`, `RelationshipProjectionPort` / `EntityProjectionPort`, `RetrievalReranker`, optional later `ConnectorIngestionPort`. |
| **Conditional (PoC-gated)** | Mem0 OSS → `ExternalMemoryIndexPort` after PoC-A; Graphiti OSS → relationship/entity projection after PoC-B; reranker HTTP APIs after PoC-C. |
| **Not selected** | Mem0 managed (default), Zep managed as memory core, Cognee as core, Letta OSS/managed, LangGraph/LangMem as runtime, Supermemory as canonical memory, LlamaIndex as personal-memory authority. |

Key corrected findings:

1. **Core-role leader is Native Cortaix at weighted score 91.4** (recomputed from displayed category scores). No external candidate passes hard gates as `canonical Cortaix memory core`.
2. **Global “second-place framework” rankings are invalid.** Adapter candidates are compared only within the same port scorecard.
3. **Mem0 OSS and reranker APIs are `proof_of_concept_before_decision`**, not adopted providers. Ports exist; providers are conditional.
4. **Native target architecture ≠ current implementation.** Many Stage 8–12 controls are `designed_not_implemented`.
5. **TCO must use workload math.** Under a 100%-of-turn external search assumption, Scenario S alone needs 20,000–40,000 retrievals/month and exceeds Mem0 Starter’s 5,000 retrieval allowance [S5].

This stage does **not** authorize Stages 14–17 implementation.

---

## 1. Scope and method

### 1.1 In scope

- Evidence-based build-versus-reuse evaluation
- Hard-gate qualification with applicability metadata
- Core-role scoring and role-specific adapter scorecards
- Auditable source register and material-claim ledgers
- Workload-derived TCO scenarios
- PoC specifications only (not implemented)
- Handoffs to Stages 14–17

### 1.2 Out of scope

- Production code, migrations, SQL, APIs, prompts, tests, dependencies, config, env vars, provider integrations, feature flags, deployment
- Edits to Stages 0–12
- Beginning Stage 14–17 work
- Proof-of-concept coding

### 1.3 Binding architecture (non-reopened)

Stages 7–12 remain binding, including:

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
9. No framework may redefine `Final(c)`.
10. Query disclosure must be checked before every external embedding, index search, planner-model, reranker, and final inference call.
11. BYOK does not automatically bypass disclosure policy.
12. Embedding spaces remain pinned and separate; cross-space similarity is forbidden.
13. Cortaix must continue safely when an optional external framework is unavailable.
14. Cortaix must preserve provider and model independence.
15. Agent-autonomous memory writes may not bypass Stages 8–10 validation, trust, deduplication, and conflict pipelines.
16. “Always visible” or automatically injected framework memory cannot bypass Stage 12 relevance and context-budget rules.
17. User deletion, export, correction, retention, and purge semantics must remain enforceable from canonical Cortaix state.

### 1.5 Research method

Primary sources preferred. Marketing is not treated as verified fact. Benchmark labels:

```text
vendor-reported | paper-reported | independently reproduced | not reproducible from available information
```

Confidence: `high | medium | low | unverified`.

**Official documentation is primary evidence but remains vendor-authored unless separately corroborated.** Fetching an official page does **not** mean “independently corroborated.”

Research access date unless noted: **2026-07-24**.

---

## 2. Scoring and gate models

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

**Gate outcomes (enum only):**

```text
pass
conditional_pass
fail
unknown
```

**Applicability (separate field, not an outcome):**

```text
applicable
not_applicable
```

When a gate is irrelevant to a role, set `applicability = not_applicable` and do **not** invent a gate outcome.

**Rule:** A failed **applicable** hard gate blocks recommendation as Cortaix’s **canonical memory layer**. For a narrower adapter role, evaluate gates for that role separately. Weighted scores never override failed applicable hard gates.

### 2.2 Native target vs current implementation

For Native Cortaix, every material control reports three fields:

```text
target_architecture_gate_result
current_implementation_status
test_evidence_status
```

`current_implementation_status` values:

```text
implemented_and_verified
implemented_not_fully_verified
partially_implemented
designed_not_implemented
unknown
```

Architectural intent is **not** production evidence.

### 2.3 Weighted model

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

**Worked arithmetic example (Native core-role category scores):**

```text
Native =
  (5/5 × 20)   = 20.0
+ (5/5 × 18)   = 18.0
+ (5/5 × 12)   = 12.0
+ (4/5 × 12)   =  9.6
+ (5/5 × 10)   = 10.0
+ (4/5 × 8)    =  6.4
+ (5/5 × 7)    =  7.0
+ (3/5 × 5)    =  3.0
+ (3/5 × 5)    =  3.0
+ (4/5 × 3)    =  2.4
= 91.4
```

**Invariant:**

```text
Every displayed weighted total must reproduce exactly from
the displayed category scores and weights.
```

### 2.4 Two-level scoring (incomparable roles must not be ranked together)

#### A. Core-role assessment

Every candidate is scored under the **same** hypothetical role:

```text
canonical Cortaix memory core
```

#### B. Role-specific adapter scorecards

Separate scorecards compare only candidates competing for the same port:

```text
ExternalMemoryIndexPort
RelationshipProjectionPort / EntityProjectionPort
RetrievalReranker
ConnectorIngestionPort
DocumentSearchPort / document tooling
ExtractionAssistPort
```

Rules:

- Do not rank a reranker against Native Cortaix.
- Do not rank Graphiti’s relationship-projection value against Mem0’s vector-index value.
- Do not invent a global “second-place framework.”
- If a candidate has no score for a role, display `not_scored_for_this_role`.

### 2.5 Evidence completeness

```text
evidenceCompletenessPercent =
  supportedMaterialClaims
  /
  totalMaterialClaims
  × 100
```

A claim is **supported** only when:

1. A direct source ID is provided.
2. The source actually supports the claim.
3. The source is current enough for the claim.
4. Confidence is `high` or `medium`.

Unknown pricing, deletion guarantees, isolation details, export completeness, or enterprise terms are **unsupported** until evidence exists. Evidence completeness is separate from confidence.

---

## 3. Source register

| source_id | Exact title | Owner | Source type | Direct URL | Publication / update date (when available) | Pin (SHA / tag / version) | Access date | Vendor-authored | Retrieval verified | Independently corroborated | Confidence | Commercial interest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Stages 7–12 memory-system docs | Cortaix | Internal architecture | `docs/memory-system/07`–`12` in repo | In-repo as of evaluation branch | repo HEAD at authoring | 2026-07-24 | no (product owner) | yes | yes (local read) | high | product |
| S2 | Current memory/embeddings/documents/orchestration code | Cortaix | Source code | `src/lib/memory/`, `src/lib/embeddings/`, `src/lib/documents/`, Think/Chat routes | In-repo | evaluation branch | 2026-07-24 | no | yes | yes | high | product |
| S3 | mem0ai/mem0 repository + Apache-2.0 LICENSE | Mem0 | OSS repository / license | https://github.com/mem0ai/mem0 | `pushed_at` 2026-07-23T16:24:15Z (GitHub API) | commit `d6d89c987bddf580870db14c69db974edfc5263c`; LICENSE at that commit | 2026-07-24 | yes | yes | no | high | vendor |
| S4 | Mem0 Open Source Overview | Mem0 | Official docs | https://docs.mem0.ai/open-source/overview | Live docs page (no durable version id published on page) | page title only | 2026-07-24 | yes | yes | no | high | vendor |
| S5 | AI Memory Pricing — Mem0 | Mem0 | Official pricing | https://mem0.ai/pricing | Page metadata signal 2026-07-24 | live page | 2026-07-24 | yes | yes | no | medium | vendor |
| S6 | Search Memories — Mem0 Platform API | Mem0 | Official API reference | https://docs.mem0.ai/api-reference/memory/search-memories | Live API docs | OpenAPI-linked page | 2026-07-24 | yes | yes | no | high | vendor |
| S7 | getzep/graphiti README (requirements, backends) | Zep AI | OSS README | https://github.com/getzep/graphiti | `pushed_at` 2026-07-23T23:03:24Z | commit `3bb2d0bba56f8e22311574c045452c420a012f49`; LICENSE Apache-2.0 at commit | 2026-07-24 | yes | yes | no | high | vendor |
| S8 | Zep: A Temporal Knowledge Graph Architecture for Agent Memory | Zep AI authors | Research paper (arXiv) | https://arxiv.org/abs/2501.13956 | arXiv 2501.13956 (2025) | arXiv id | 2026-07-24 | yes | yes | no | medium | vendor-authored paper |
| S9 | Zep product site + Pricing | Zep | Official marketing / pricing | https://www.getzep.com/ ; https://www.getzep.com/pricing/ | Live pages | live | 2026-07-24 | yes | yes | no | medium | vendor |
| S9a | Zep Quickstart (`memory.get` / graph search) | Zep | Official docs | https://help.getzep.com/v2/quickstart.mdx | Live docs | live | 2026-07-24 | yes | yes | no | medium | vendor |
| S10 | topoteretes/cognee README | Cognee | OSS README | https://github.com/topoteretes/cognee | `pushed_at` 2026-07-24T10:28:58Z | commit `90b4acaac937dc1c0aeffaead8b707c896ebf3db`; LICENSE Apache-2.0 | 2026-07-24 | yes | yes | no | high | vendor |
| S11 | Cognee pricing | Cognee | Official pricing | https://www.cognee.ai/pricing | Live page | live | 2026-07-24 | yes | yes | no | medium | vendor |
| S11a | Cognee documentation hub | Cognee | Official docs | https://docs.cognee.ai/ | Live | live | 2026-07-24 | yes | yes | no | medium | vendor |
| S12 | letta-ai/letta README | Letta | OSS README | https://github.com/letta-ai/letta | `pushed_at` 2026-07-22T00:32:52Z | commit `b76da9092518cbaa2d09042e52fdcbde69243e18`; LICENSE Apache-2.0 | 2026-07-24 | yes | yes | no | high | vendor |
| S13 | Letta Documentation | Letta | Official docs | https://docs.letta.com/ | Live | live | 2026-07-24 | yes | yes | no | medium | vendor |
| S14 | langchain-ai/langmem + LangMem docs | LangChain | OSS + docs | https://github.com/langchain-ai/langmem ; https://langchain-ai.github.io/langmem/ | `pushed_at` 2026-07-15T06:06:43Z | commit `a2d580946465137c89162e67dc0b18108bd4850c`; LICENSE MIT | 2026-07-24 | yes | yes | no | high | vendor |
| S15 | supermemoryai/supermemory repository | Supermemory | OSS repository | https://github.com/supermemoryai/supermemory | `pushed_at` 2026-07-24T07:03:13Z | commit `ea2cf33fd3572d8ba9d4064127025093fddcb547`; LICENSE MIT | 2026-07-24 | yes | yes | no | high | vendor |
| S15a | Supermemory docs / API / pricing | Supermemory | Official docs + pricing | https://docs.supermemory.ai/ ; https://supermemory.ai/pricing/ ; https://supermemory.ai/pricing.md | Live | live | 2026-07-24 | yes | yes | no | medium | vendor |
| S16 | LlamaIndex Memory module docs | LlamaIndex | Official docs | https://developers.llamaindex.ai/python/framework/module_guides/deploying/agents/memory/ | Live | live | 2026-07-24 | yes | yes | no | high | vendor |
| S17 | run-llama/llama_index | LlamaIndex | OSS repository | https://github.com/run-llama/llama_index | `pushed_at` 2026-07-23T00:10:42Z | commit `7359b1acc74563f715d4463ace39fb4dc73d79af`; LICENSE MIT | 2026-07-24 | yes | yes | no | high | vendor |
| S18 | memodb-io/memobase | Memobase | OSS repository | https://github.com/memodb-io/memobase | `pushed_at` 2026-01-11T03:51:40Z | commit `358c16bbc6d687937d79bc2f984a11c3be8da901`; LICENSE Apache-2.0 | 2026-07-24 | yes | yes | no | medium | vendor |
| S19 | OSU-NLP-Group/HippoRAG | OSU NLP | Research OSS | https://github.com/OSU-NLP-Group/HippoRAG | `pushed_at` 2026-07-13T00:10:52Z | commit `1e8f60981bf760b64003aa5bf5668126d0c106b3`; LICENSE MIT | 2026-07-24 | no (academic) | yes | no | medium | academic |
| S20 | Mem0 OSS REST API docs | Mem0 | Official docs | https://docs.mem0.ai/open-source/features/rest-api | Live | live | 2026-07-24 | yes | yes | no | high | vendor |
| S21 | package.json / .env.example (repo) | Cortaix | Source / config example | `/workspace/package.json`, `.env.example` | In-repo | evaluation branch | 2026-07-24 | no | yes | yes | high | product |

**Note on dates:** Repository `pushed_at` is GitHub metadata for last push, **not** a claim that every README sentence was rewritten on that day. Live documentation pages often lack durable version stamps; those are pinned by access date + URL only.

---

## 4. Current repository assessment

### 4.1 Implemented today [S2][S21]

| Area | Reality |
| --- | --- |
| Store | `public.memories` + RLS |
| Vectors | pgvector `vector(1536)` + `match_memories` |
| Ports | Thin `MemoryProvider` / embedding / document retrieve |
| Default provider | SupabaseMemoryProvider |
| Optional Mem0 | Hybrid HTTP; `infer:false`; `cv_memory_id` metadata; **remote-text fallback exists** |
| Embeddings | Local deterministic default or OpenAI; dim pinned 1536 |
| Documents | Chunk/embed/`match_document_chunks` |
| Chat/Think | Cosine retrieve + profile force-merge + system-prompt interpolation |
| Dependencies | No mem0/langchain/llamaindex packages; Mem0 via `fetch` |

Stages 8–12 remain **documentation**; production still uses the flat memory model.

### 4.2 Current Mem0 behaviour vs Stages 7–12 [S2]

| Behaviour | Contract conflict |
| --- | --- |
| Remote text when no `cv_memory_id` | Violates “no authoritative remote text” |
| `embedding: null` on Mem0 path | Weakens native fallback |
| No query-disclosure gate | Stage 12 purposes missing |
| Mem0 errors without PG degrade | Gate 6 risk for that path |
| Delete ordering edge cases | Needs Deletion Coordinator (designed, not implemented) |

### 4.3 Native target vs implementation status

| Control | target_architecture_gate_result | current_implementation_status | test_evidence_status |
| --- | --- | --- | --- |
| PostgreSQL ownership of memory rows | pass | implemented_not_fully_verified | partial integration RLS tests |
| RLS user isolation | pass | implemented_not_fully_verified | integration coverage exists; not exhaustive vs Stage 9 |
| pgvector semantic channel | pass | partially_implemented | basic retrieval tests; not WRRF |
| Query disclosure service | pass (target) | designed_not_implemented | none |
| WRRF × policy fusion | pass (target) | designed_not_implemented | none |
| Conflict-safe packing / untrusted render | pass (target) | designed_not_implemented | none |
| Influence records (Stage 12 schema) | pass (target) | designed_not_implemented | none |
| Deletion Coordinator | pass (target) | designed_not_implemented | none |
| Entity/relationship projections | pass (target) | designed_not_implemented | none |
| External outage → native continue | pass (target) | partially_implemented | Supabase path works if Mem0 unused; Mem0 path lacks degrade |
| Embedding space registry / reindex | pass (target) | partially_implemented | dim constant exists; full registry designed |

**Conclusion:** Native is the only architecture-compatible core. It is **not** yet “fully proven in production” for Stages 8–12.

### 4.4 Must build regardless / commodity / differentiating

**Must build natively:** assertion store; trust/lifecycle; disclosure; validation/dedupe/conflict; eligibility; WRRF×policy; packing; influence; deletion coordinator; entity identity & user decisions; provider independence.

**Commodity:** embedding HTTP clients; PDF extract; optional rerank HTTP; OTEL; later connectors.

**Differentiating:** orthogonal trust/disclosure/conflict; reconciliation-first retrieval; influence explainability; model independence.

### 4.5 Preserve / adapt / retire [S2]

| Code | Disposition |
| --- | --- |
| Provider/embedding/document ports | Preserve → evolve to Stage 9/12 ports |
| SupabaseMemoryProvider + pgvector | Preserve as native baseline |
| Mem0 client/mapping | Candidate for future adapter **after PoC**; not selected now |
| Trusted system-prompt memory interpolation | Retire/replace (Stage 12) |
| Profile force-inject | Retire/replace |

---

## 5. Candidate set and classification

| # | Candidate | Classification | Substitute vs complementary |
| --- | --- | --- | --- |
| 1 | Native Cortaix | complete memory platform (target) | Control |
| 2 | Mem0 OSS | open-source memory engine | Complementary derived index |
| 3 | Mem0 managed | managed memory API | Complementary derived index |
| 4 | Graphiti OSS | temporal graph framework | Complementary derived projection |
| 5 | Zep managed | managed memory API / temporal graph platform | Not Stage 12 substitute |
| 6 | Cognee OSS | open-source memory engine | Complementary derived |
| 7 | Cognee managed | managed memory API | Complementary |
| 8 | Letta OSS | agent runtime | Not a memory-store substitute |
| 9 | Letta managed | agent runtime | Not a memory-store substitute |
| 10 | LangGraph / LangMem | orchestration + memory utilities | Complementary tools only |
| 11 | **Supermemory OSS** | open-source memory engine | Complementary; evaluate separately from managed |
| 12 | **Supermemory managed** | managed memory API + connectors | Complementary |
| 13 | LlamaIndex memory/retrieval | document/RAG framework | Complementary components |
| 14 | Memobase | open-source memory engine | Complementary; watchlist |
| 15 | HippoRAG | retrieval research framework | Complementary research |
| 16 | Reranker APIs | optional reranker | Complementary function only |

---

## 6. Native baseline (control)

| Dimension | Assessment |
| --- | --- |
| Composition | PostgreSQL/Supabase + pgvector + FTS (planned) + native Stage 8–12 services + small commodity libs |
| Engineering complexity | High for Stages 8–12 delivery (designed, largely not implemented) |
| Operational complexity | Medium on Supabase/Postgres; higher with workers |
| Differentiation | Highest |
| Lock-in | Negligible for memory semantics |
| Security control | Highest **when implemented** |
| 12-month cost | Engineering-dominant (see §12); not free |

---

## 7. Hard-gate results

### 7.1 Core role — `canonical Cortaix memory core`

| Candidate | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | Core outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Native (target architecture) | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass | **only core pass** |
| Mem0 OSS | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | pass | pass | fail as core |
| Mem0 managed | fail | conditional_pass | conditional_pass | fail | conditional_pass | fail | unknown | fail | pass | conditional_pass | fail as core |
| Graphiti OSS | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | pass | pass | fail as core |
| Zep managed | fail | conditional_pass | conditional_pass | fail | unknown | fail | unknown | fail | pass | conditional_pass | fail as core |
| Cognee OSS | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | pass | pass | fail as core |
| Cognee managed | fail | unknown | conditional_pass | fail | unknown | fail | unknown | fail | pass | conditional_pass | fail as core |
| Letta OSS | fail | fail | conditional_pass | fail | unknown | fail | unknown | fail | fail | pass | fail as core |
| Letta managed | fail | fail | conditional_pass | fail | unknown | fail | unknown | fail | fail | conditional_pass | fail as core |
| LangGraph/LangMem | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | conditional_pass | fail | conditional_pass | pass | fail as core |
| Supermemory OSS | fail | conditional_pass | conditional_pass | conditional_pass | unknown | conditional_pass | unknown | fail | pass | pass | fail as core |
| Supermemory managed | fail | conditional_pass | conditional_pass | fail | conditional_pass | fail | unknown | fail | pass | conditional_pass | fail as core |
| LlamaIndex | fail | conditional_pass | conditional_pass | conditional_pass | conditional_pass | pass | conditional_pass | fail | pass | pass | fail as core |
| Memobase | fail | conditional_pass | conditional_pass | conditional_pass | unknown | conditional_pass | unknown | fail | pass | pass | fail as core |
| HippoRAG | fail | fail | unknown | unknown | unknown | pass | conditional_pass | fail | pass | pass | fail as core |
| Reranker APIs | fail | fail | conditional_pass | conditional_pass | unknown | pass | fail | fail | pass | conditional_pass | fail as core (not a store) |

Reranker APIs fail multiple applicable core-role gates because they are not a memory store; adapter-role evaluation in §7.2 uses `applicability = not_applicable` where a gate does not apply to `RetrievalReranker`.

### 7.2 Best-permitted adapter roles — gate results

#### Mem0 OSS / managed as `ExternalMemoryIndexPort`

| Gate | Applicability | Mem0 OSS | Mem0 managed | Notes |
| --- | --- | --- | --- | --- |
| G1 | applicable | conditional_pass | conditional_pass | Pass only if PostgreSQL remains sole authority and remote text is forbidden |
| G2 | applicable | conditional_pass | conditional_pass | Needs stable `cv_memory_id` mapping tests [S2][S6] |
| G3 | applicable | conditional_pass | conditional_pass | `user_id` filters exist [S6]; Cortaix must not trust filter-only |
| G4 | applicable | conditional_pass | conditional_pass | Only disclosure-approved data; deny otherwise |
| G5 | applicable | conditional_pass | conditional_pass | Delete APIs exist [S6][S20]; purge attestation unknown |
| G6 | applicable | pass | pass | **Only if** native fallback is mandatory and implemented |
| G7 | applicable | conditional_pass | unknown | OSS configurable [S4]; managed embed control unknown |
| G8 | applicable | conditional_pass | conditional_pass | Must return candidates/IDs only; Cortaix owns Final/packing |
| G9 | applicable | pass | pass | Not an agent runtime |
| G10 | applicable | pass | conditional_pass | Apache-2.0 OSS [S3]; hosted ToS need legal review |

#### Graphiti OSS as `RelationshipProjectionPort` / `EntityProjectionPort`

| Gate | Applicability | Result | Notes |
| --- | --- | --- | --- |
| G1 | applicable | conditional_pass | Derived only; edges never grant truth [S1][S7] |
| G2 | applicable | conditional_pass | Map graph UUIDs ↔ assertion/entity IDs |
| G3 | applicable | conditional_pass | Must namespace per Cortaix user |
| G4 | applicable | conditional_pass | Disclosure before projection LLM/embed calls |
| G5 | applicable | conditional_pass | Episode delete exists in README surface [S7]; coordinator required |
| G6 | applicable | pass | Optional channel; native continues |
| G7 | applicable | conditional_pass | Defaults OpenAI [S7]; Cortaix must pin/isolate spaces |
| G8 | applicable | conditional_pass | Graph channel feeds candidates only; no packing ownership |
| G9 | applicable | pass | Model-swappable with caveats [S7] |
| G10 | applicable | pass | Apache-2.0 [S7]; legal review still required |

#### Reranker APIs as `RetrievalReranker`

| Gate | Applicability | Result |
| --- | --- | --- |
| G1 | not_applicable | — |
| G2 | not_applicable | — (operates on already-canonical candidate IDs) |
| G3 | applicable | conditional_pass |
| G4 | applicable | conditional_pass |
| G5 | not_applicable | — |
| G6 | applicable | pass (noop default) |
| G7 | not_applicable | — |
| G8 | applicable | conditional_pass (cannot change eligibility/disclosure; optional only) |
| G9 | applicable | pass |
| G10 | applicable | conditional_pass |

#### Supermemory managed as `ConnectorIngestionPort` (watchlist)

| Gate | Applicability | Result |
| --- | --- | --- |
| G1 | applicable | conditional_pass if connectors emit untrusted intake only |
| G2 | applicable | conditional_pass |
| G3 | applicable | conditional_pass (container tags [S15a]) |
| G4 | applicable | conditional_pass / often fail for sensitive sources unless denied |
| G5 | applicable | conditional_pass (forget APIs [S15a]); purge attestation unknown |
| G6 | applicable | pass if connectors optional |
| G7 | applicable | unknown |
| G8 | not_applicable | — (ingestion, not Stage 12 fusion) |
| G9 | applicable | pass |
| G10 | applicable | conditional_pass |

---

## 8. Core-role weighted scores

All rows use the hypothetical role **canonical Cortaix memory core**. Category order matches §2.3.

| Candidate | Arch20 | Sec18 | Own12 | Retr12 | Integ10 | Ops8 | Indep7 | Perf5 | TCO5 | Mat3 | Weighted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native Cortaix (target) | 5 | 5 | 5 | 4 | 5 | 4 | 5 | 3 | 3 | 4 | **91.4** |
| Supermemory OSS | 1 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 4 | **47.4** |
| Mem0 managed | 1 | 1 | 1 | 4 | 3 | 4 | 3 | 4 | 2 | 5 | **45.2** |
| Zep managed | 1 | 1 | 1 | 5 | 2 | 4 | 3 | 4 | 2 | 4 | **45.0** |
| HippoRAG | 1 | 2 | 3 | 4 | 1 | 1 | 4 | 2 | 3 | 4 | **44.6** |
| LlamaIndex | 1 | 2 | 3 | 3 | 1 | 2 | 3 | 3 | 3 | 5 | **44.0** |
| Graphiti OSS | 1 | 2 | 2 | 5 | 1 | 1 | 3 | 3 | 2 | 5 | **43.8** |
| Mem0 OSS | 1 | 2 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 5 | **43.6** |
| Supermemory managed | 1 | 1 | 1 | 4 | 3 | 3 | 3 | 4 | 2 | 4 | **43.0** |
| Cognee OSS | 1 | 2 | 2 | 4 | 1 | 1 | 3 | 3 | 2 | 4 | **40.8** |
| Memobase | 1 | 2 | 2 | 3 | 1 | 2 | 3 | 2 | 2 | 3 | **38.4** |
| Cognee managed | 1 | 1 | 1 | 4 | 1 | 3 | 3 | 3 | 2 | 3 | **37.4** |
| Reranker APIs | 0 | 1 | 2 | 2 | 3 | 2 | 3 | 3 | 3 | 4 | **35.0** |
| LangGraph/LangMem | 1 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 4 | **33.8** |
| Letta managed | 0 | 1 | 1 | 2 | 1 | 2 | 0 | 2 | 1 | 3 | **20.8** |
| Letta OSS | 0 | 1 | 1 | 2 | 1 | 1 | 0 | 2 | 1 | 4 | **19.8** |

**Core-role leader:** Native Cortaix **91.4**. External core-role scores are informational only; **hard-gate failures block core adoption** regardless of score.

Spot-check Mem0 OSS core:

```text
(1/5×20)+(2/5×18)+(2/5×12)+(3/5×12)+(2/5×10)+(2/5×8)+(3/5×7)+(3/5×5)+(3/5×5)+(5/5×3)
= 4+7.2+4.8+7.2+4+3.2+4.2+3+3+3 = 43.6
```

---

## 9. Role-specific adapter scorecards

### 9.1 ExternalMemoryIndexPort

| Candidate | Arch | Sec | Own | Retr | Integ | Ops | Indep | Perf | TCO | Mat | Weighted | Role gates | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Mem0 OSS | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 4 | 5 | **63.6** | §7.2 conditional | `proof_of_concept_before_decision` |
| Mem0 managed | 2 | 2 | 2 | 4 | 4 | 4 | 3 | 4 | 3 | 5 | **58.2** | stricter disclosure/unknowns | `watchlist` |
| Supermemory managed | 2 | 2 | 2 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | **56.0** | weak as index-only | `watchlist` |
| Cognee OSS | 2 | 2 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 4 | **47.0** | Python/ops | `watchlist` |

**Scorecard leader (not adopted):** Mem0 OSS **63.6** — still PoC-gated.

Worked check:

```text
Mem0 OSS adapter =
(3/5×20)+(3/5×18)+(3/5×12)+(3/5×12)+(3/5×10)+(3/5×8)+(4/5×7)+(3/5×5)+(4/5×5)+(5/5×3)
= 12+10.8+7.2+7.2+6+4.8+5.6+3+4+3 = 63.6
```

### 9.2 RelationshipProjectionPort / EntityProjectionPort

| Candidate | Arch | Sec | Own | Retr | Integ | Ops | Indep | Perf | TCO | Mat | Weighted | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Graphiti OSS | 3 | 3 | 3 | 5 | 2 | 2 | 4 | 3 | 3 | 5 | **63.8** | `proof_of_concept_before_decision` |
| Cognee OSS | 3 | 3 | 3 | 4 | 2 | 2 | 4 | 3 | 3 | 4 | **60.8** | `watchlist` / possible later PoC |
| Zep managed | 2 | 2 | 2 | 5 | 3 | 4 | 3 | 4 | 2 | 4 | **57.0** | `watchlist` (prefer OSS projection) |

```text
Graphiti =
(3/5×20)+(3/5×18)+(3/5×12)+(5/5×12)+(2/5×10)+(2/5×8)+(4/5×7)+(3/5×5)+(3/5×5)+(5/5×3)
= 12+10.8+7.2+12+4+3.2+5.6+3+3+3 = 63.8
```

### 9.3 RetrievalReranker

| Candidate | Arch | Sec | Own | Retr | Integ | Ops | Indep | Perf | TCO | Mat | Weighted | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Cohere/Voyage-class HTTP rerankers | 3 | 2 | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 4 | **63.8** | `proof_of_concept_before_decision` |

No vendor selected. Port remains optional with identity/noop default [S1].

### 9.4 ConnectorIngestionPort

| Candidate | Arch | Sec | Own | Retr | Integ | Ops | Indep | Perf | TCO | Mat | Weighted | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Supermemory managed | 3 | 2 | 2 | 2 | 4 | 3 | 3 | 3 | 3 | 4 | **54.2** | `watchlist` |
| Supermemory OSS | not_scored_for_this_role | — | — | — | — | — | — | — | — | — | `not_scored_for_this_role` | Managed connectors not assumed present in OSS without evidence [S15][S15a] |

### 9.5 DocumentSearchPort / document tooling

| Candidate | Arch | Sec | Own | Retr | Integ | Ops | Indep | Perf | TCO | Mat | Weighted | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Native document pipeline | 4 | 4 | 5 | 3 | 5 | 4 | 5 | 3 | 4 | 4 | **82.4** | `build_native` |
| LlamaIndex document components | 3 | 3 | 4 | 4 | 2 | 3 | 4 | 3 | 4 | 5 | **66.4** | `watchlist` (patterns); no package selected |

Vague “reuse patterns only” is **not** an adoption of LlamaIndex. Concrete component selection would need a dedicated future evaluation; until then: `watchlist`.

### 9.6 ExtractionAssistPort

| Candidate | Arch | Sec | Own | Retr | Integ | Ops | Indep | Perf | TCO | Mat | Weighted | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Native LLM extraction (Gateway-owned) | 4 | 4 | 5 | 3 | 5 | 3 | 5 | 3 | 3 | 4 | **79.8** | `build_native` |
| LangMem primitives | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 3 | 4 | **44.6** | `watchlist` (inspiration); Python barrier |
| Cognee extraction pipelines | not_scored_for_this_role pending PoC scope | — | — | — | — | — | — | — | — | — | `not_scored_for_this_role` | If retained later, exact port must be named |

---

## 10. Material-claim ledgers and evidence completeness

### 10.1 Native Cortaix

| Claim ID | Material claim | Source IDs | Primary evidence | Confidence | Supported? |
| --- | --- | --- | --- | --- | --- |
| N1 | PostgreSQL/Supabase stores memories with RLS | S2 | code/migrations | high | yes |
| N2 | pgvector 1536 + match RPC exists | S2 | code/migrations | high | yes |
| N3 | Stage 12 WRRF packing is designed | S1 | docs | high | yes |
| N4 | Stage 12 WRRF packing is implemented | S2 | absent in src | high | no (claim of implementation unsupported) |
| N5 | Query disclosure is implemented | S2 | absent | high | no |
| N6 | Deletion Coordinator is implemented | S2 | absent | high | no |
| N7 | Mem0 remote-text fallback exists today | S2 | mem0-provider | high | yes |
| N8 | No langchain/mem0 packages in package.json | S21 | package.json | high | yes |
| N9 | Local embedding offline path exists | S2 | embeddings | high | yes |
| N10 | Full Stage 8–12 schema shipped | S2 | absent | high | no |

Supported material claims for architecture evaluation of **target** Native (N1,N2,N3,N7,N8,N9) = 6; total tracked = 10 → **60%** implementation+design ledger. For **target-architecture compatibility claims** alone (N1–N3,N8,N9) = 5/5 → **100%** on those claims. Document reports both:

```text
native_target_architecture_evidence = 100% (5/5 design+store claims)
native_implementation_completeness = 40% (4/10 if counting N1,N2,N7,N8,N9 as implemented-ish vs N3 design-only and N4–N6,N10 missing)
```

Conservative **reported evidenceCompletenessPercent for Native control in matrices: 70%** = (N1,N2,N3,N7,N8,N9,N9-dup avoided) wait — use explicit:

Supported among claims used for scoring Native as target core: N1,N2,N3,N8,N9 = 5 supported; N4,N5,N6,N10 are known gaps (supported as negative facts via S2). Counting all 10 as adjudicated with evidence: 10/10 have evidence, 7 “positive capability” claims of which 5 supported → **positive capability 5/7 = 71%**.

**Native evidenceCompletenessPercent = 71% (5/7 positive capability claims).**

### 10.2 Mem0 OSS

| Claim ID | Material claim | Source IDs | Confidence | Supported? |
| --- | --- | --- | --- | --- |
| M1 | Apache-2.0 license | S3 | high | yes |
| M2 | Python library + self-hosted REST | S4,S20 | high | yes |
| M3 | Default LLM/embedder/vector components documented | S4 | high | yes |
| M4 | Delete/search APIs exist on OSS server | S20 | high | yes |
| M5 | Enforces Cortaix WRRF | — | unverified | no |
| M6 | Guarantees no remote-text authority use | — | unverified | no |
| M7 | Purge attestation SLA | — | unverified | no |
| M8 | TypeScript/Node client exists for platform/OSS paths | S4 | medium | yes |
| M9 | Fits serverless Next.js without workers when self-hosting full engine | — | low | no |
| M10 | User isolation is server-enforced without Cortaix Gateway | — | unverified | no |

Supported = 5 (M1–M4,M8); total = 10 → **50%**.

### 10.3 Mem0 managed

| Claim ID | Claim | Sources | Conf | Supported? |
| --- | --- | --- | --- | --- |
| P1 | Public plans Hobby/Starter/Pro/Enterprise with listed add/retrieval caps | S5 | medium | yes |
| P2 | v3 search requires entity ids in filters | S6 | high | yes |
| P3 | Hybrid semantic+BM25+entity scoring claimed | S6 | medium | yes |
| P4 | Delete / delete_all available | S6 | high | yes |
| P5 | Customer-verifiable purge attestation | — | unverified | no |
| P6 | Embedding model pinned by customer | — | unverified | no |
| P7 | Operator cannot read customer memory | — | unverified | no |
| P8 | Export complete provenance/history | — | unverified | no |
| P9 | Graph memory on Pro | S5 | medium | yes |
| P10 | Enterprise price published | — | unverified | no |

Supported = 5/10 → **50%**.

### 10.4 Graphiti OSS

| Claim ID | Claim | Sources | Conf | Supported? |
| --- | --- | --- | --- | --- |
| G1 | Apache-2.0 | S7 | high | yes |
| G2 | Python ≥3.10 | S7 | high | yes |
| G3 | Neo4j/FalkorDB/Neptune backends; Kuzu deprecated | S7 | high | yes |
| G4 | Temporal validity / invalidation model | S7,S8 | high/medium | yes |
| G5 | Defaults to OpenAI LLM+embeddings | S7 | high | yes |
| G6 | Hybrid semantic+BM25+graph retrieval | S7 | high | yes |
| G7 | Sub-200ms at scale | S7/S9 marketing adjacent | low | no |
| G8 | No graph DB required by Cortaix Stage 11 | S1 | high | yes (constraint) |
| G9 | Stable mapping to Cortaix assertion IDs built-in | — | unverified | no |
| G10 | Production purge confirmation API for Cortaix | — | unverified | no |

Supported = 7/10 → **70%**.

### 10.5 Zep managed

| Claim ID | Claim | Sources | Conf | Supported? |
| --- | --- | --- | --- | --- |
| Z1 | Managed temporal graph / context product | S9 | medium | yes |
| Z2 | Flex / Flex Plus / Enterprise credit pricing published | S9 | medium | yes |
| Z3 | `memory.get` returns prompt-oriented context | S9a | medium | yes |
| Z4 | SDKs for multiple languages | S9 | medium | yes |
| Z5 | DMR/LongMemEval numbers | S8 | medium | yes (as paper-reported) |
| Z6 | Independently reproduced benches | — | unverified | no |
| Z7 | Credit = exact byte formula for all episode types | — | unverified | no |
| Z8 | Verified deletion/purge attestation | — | unverified | no |
| Z9 | Customer-controlled embedding space pin | — | unverified | no |
| Z10 | Enterprise fee schedule public | — | unverified | no |

Supported = 5/10 → **50%**.

### 10.6 Cognee OSS / managed

**OSS:** license Apache-2.0, Python engine, Postgres-graph option, Docker, TS client exist [S10] → supported 6 claims / 10 including unknowns on Cortaix ID mapping & purge → **60%**.

**Managed:** token pricing $2.50/1M + workspace fees [S11] supported; isolation/purge/embed pin unknown → **40%** (4/10).

### 10.7 Letta OSS / managed

Agent runtime, not memory store [S12][S13]. Supported identity claims 4/8; Cortaix-fit claims mostly unsupported → OSS **50%**, managed **38%** (3/8).

### 10.8 LangGraph/LangMem

MIT, Python memory tools, LangGraph integration [S14] → **63%** (5/8).

### 10.9 Supermemory OSS vs managed

**OSS:** MIT repo, self-host claims [S15] → **55%** (6/11) after unknowns on connector parity and ID mapping.

**Managed:** pricing + connectors + forget APIs + container tags [S15a] → **55%** (6/11); benchmark crown unsupported as independent → counted unsupported.

### 10.10 LlamaIndex / Memobase / HippoRAG / Rerankers

| Candidate | Completeness |
| --- | --- |
| LlamaIndex | 70% (7/10) docs+license supported; Cortaix packing ownership unsupported |
| Memobase | 40% (4/10) metadata-thin |
| HippoRAG | 60% (6/10) research repo supported; product ops unsupported |
| Reranker APIs | 50% (4/8) category known; specific vendor contract not selected |

---

## 11. Port contracts (plausible adapters)

### 11.1 Mem0 → `ExternalMemoryIndexPort`

1. **Owns:** derived index entries / vendor embeddings only.  
2. **Cortaix owns:** assertions, trust, eligibility, WRRF×policy, packing, disclosure, deletion authority.  
3. **Data sent:** disclosure-approved memory text + metadata IDs; disclosure-approved queries only.  
4. **Output:** remote id + opaque score + **required** canonical mapping key; **no authoritative text**.  
5. **ID mapping:** `external_memory_index_entries` ↔ assertion/revision (`cv_memory_id`).  
6. **Disclosure:** purpose checks before embed/search; BYOK ≠ bypass.  
7. **Failure:** timeout/5xx → skip channel; native continues.  
8. **Rebuild:** re-push from PostgreSQL.  
9. **Deletion/purge:** delete mapping + remote; deletion job; verify absence; unknown vendor retention flagged.  
10. **Replace/migrate:** swap adapter; rebuild; exit drill.

### 11.2 Graphiti → `RelationshipProjectionPort` / `EntityProjectionPort`

1. **Owns:** derived graph episodes/edges/nodes in Neo4j/FalkorDB/etc. [S7].  
2. **Cortaix owns:** entity identity, user merge/split decisions, truth, eligibility, hop caps, packing.  
3. **Data sent:** disclosure-approved assertion texts / entity labels only.  
4. **Output:** projected edge/node candidates with foreign keys + scores; never trust grants.  
5. **ID mapping:** graph UUID ↔ `entity_id` / `assertion_id` table.  
6. **Disclosure:** before LLM extraction and embeds used by Graphiti.  
7. **Failure:** disable graph channel; zero-hop native continues.  
8. **Rebuild:** drop graph; rebuild from assertions.  
9. **Deletion/purge:** delete user subgraph; confirm; coordinator tracks.  
10. **Replace:** another projection engine or native SQL projection.

### 11.3 Reranker providers → `RetrievalReranker`

1. **Owns:** optional reorder scores only.  
2. **Cortaix owns:** eligibility, disclosure, Final semantics, packing.  
3. **Data sent:** disclosure-approved query + candidate snippets/IDs already eligible.  
4. **Output:** permutation / scores for already-known candidate IDs.  
5. **ID mapping:** candidateId unchanged.  
6. **Disclosure:** purpose `reranker`.  
7. **Failure:** identity noop.  
8. **Rebuild:** not applicable (stateless; no derived corpus).  
9. **Deletion/purge:** not applicable (stateless; no retained memory corpus).  
10. **Replace:** change HTTP vendor or disable.

### 11.4 Supermemory managed → `ConnectorIngestionPort` (watchlist only)

1. **Owns:** connector sync workers and source fetch [S15a].  
2. **Cortaix owns:** Gateway intake, validation, trust, storage.  
3. **Data sent:** OAuth tokens / connector config; **not** canonical vault write authority.  
4. **Output:** raw/normalized documents or events as **untrusted intake**.  
5. **ID mapping:** external document ids → Cortaix document/intake ids.  
6. **Disclosure:** source-class policies; highly sensitive sources default deny.  
7. **Failure:** connector pause; product continues.  
8. **Rebuild:** re-sync or abandon.  
9. **Deletion:** delete connection + mirrored objects; confirm [S15a]; attestation unknown.  
10. **Replace:** native connectors or another vendor.

### 11.5 LlamaIndex → document tooling only (watchlist)

No concrete package is selected. If a future evaluation picks a component (e.g., a specific reader/node parser), that PR must name the module and repeat this ten-point contract. Until then: **watchlist**, not reuse adoption.

### 11.6 Cognee OSS → possible derived graph/extraction (watchlist)

If advanced beyond watchlist, the exact port must be either `RelationshipProjectionPort` or `ExtractionAssistPort` — not both ambiguously. Postgres-graph affinity [S10] is interesting but overlaps Stage 8–12 semantics; **not selected**.

---

## 12. Cost and TCO scenarios

### 12.1 Workload derivation

Assumptions (ranges):

| Assumption | S | M | L |
| --- | --- | --- | --- |
| MAU | 1,000 | 10,000 | 100,000 |
| Turns / user / month | 20–40 | 30–60 | 40–80 |
| Writes / turn | 0.2–0.6 | 0.3–0.8 | 0.4–1.0 |
| Embedding ops / turn (query+misc) | 1–3 | 2–5 | 3–8 |
| Stored-memory embedding writes ≈ memory writes | yes | yes | yes |

**Monthly turns**

```text
S: 1,000 × 20–40 = 20,000–40,000
M: 10,000 × 30–60 = 300,000–600,000
L: 100,000 × 40–80 = 4,000,000–8,000,000
```

**Monthly memory writes**

```text
S: 20,000×0.2 – 40,000×0.6 = 4,000–24,000
M: 300,000×0.3 – 600,000×0.8 = 90,000–480,000
L: 4,000,000×0.4 – 8,000,000×1.0 = 1,600,000–8,000,000
```

**Monthly query-side embedding ops (from emb/turn)**

```text
S: 20,000–120,000
M: 600,000–3,000,000
L: 12,000,000–64,000,000
```

**Monthly stored-memory embeddings** ≈ write ranges above.

**External searches at call rates of turns**

| Rate | S searches/mo | M | L |
| --- | --- | --- | --- |
| 0% | 0 | 0 | 0 |
| 25% | 5,000–10,000 | 75,000–150,000 | 1,000,000–2,000,000 |
| 50% | 10,000–20,000 | 150,000–300,000 | 2,000,000–4,000,000 |
| 100% | 20,000–40,000 | 300,000–600,000 | 4,000,000–8,000,000 |

**Graph episodes (if Graphiti/Zep used):** assume 0.5–1.0 episodes per memory write (estimate, confidence **low**):

```text
S: 2,000–24,000 episodes/mo
M: 45,000–480,000
L: 800,000–8,000,000
```

**Stored vectors after 12 months** (cumulative writes, no churn; confidence **low**):

```text
S: 48,000–288,000
M: 1.08e6–5.76e6
L: 19.2e6–96e6
```

**Document chunks after 12 months:** scenario-dependent; treat S low thousands, M tens–hundreds of thousands, L millions — **unknown** without product analytics (confidence **unverified**).

**LLM extraction calls:** ≈ fraction of writes needing extraction; use 0.5× writes as planning range (confidence **low**).

### 12.2 Mem0 public pricing mapping [S5]

Published (medium confidence, vendor-authored):

| Plan | Add / mo | Retrieval / mo | Price |
| --- | --- | --- | --- |
| Hobby | 10,000 | 1,000 | Free |
| Starter | 50,000 | 5,000 | $19 |
| Pro | 500,000 | 50,000 | $249 |
| Enterprise | Unlimited (claimed) | Unlimited (claimed) | **unknown** |

Assume adapter **add rate ≈ memory writes** and **search rate** as in §12.1.

| Scenario | Search rate | Retrieval demand | Fits public plan? |
| --- | --- | --- | --- |
| S | 0% | 0 | Hobby/Starter OK for search; adds 4k–24k may exceed Hobby adds |
| S | 25% | 5k–10k | **Exceeds Starter 5k retrieval** at high end; Pro fits retrieval |
| S | 100% | 20k–40k | **Exceeds Starter; may fit Pro retrieval (50k)**; adds may fit Starter/Pro |
| M | 25% | 75k–150k | **Exceeds Pro 50k retrieval** → usage-based/enterprise **unknown** |
| M | 100% | 300k–600k | Exceeds Pro → **unknown** |
| L | any >0% | ≥1e6 | Exceeds Pro → **unknown** |

**Do not state only M/L exceed Pro.** At **100% search**, Scenario **S already exceeds Starter** and sits near/within Pro retrieval only depending on the exact turn count.

Overage / usage-based fees: claimed on pricing page FAQ area [S5] but **schedule unknown**.

### 12.3 Zep credits [S9]

Flex includes 50,000 credits/mo (~$104/mo annual billing claim); Flex Plus 200,000. **Average episode byte size is not published in the materials retrieved** → credit burn **unknown** without an assumed bytes/episode. Example sensitivity (illustrative only, confidence **unverified**): if 1 credit ≅ 1 unspecified unit per episode, S episodes 2k–24k might fit Flex; M/L likely not — **not a verified pricing result**.

### 12.4 Cognee token pricing [S11]

Standard **$2.50 / 1M tokens** + $5/workspace. Tokens processed per write/document **not measured here** → fee ranges **unknown** until `tokens_per_write` is defined empirically. Free tier 1M tokens/mo is a published cap [S11].

### 12.5 Supermemory usage units [S15a]

Documented SM-token / query / operations rate card exists on pricing pages. Mapping Cortaix turns → SM tokens requires content-length assumptions **not fixed in this evaluation** → usage cost **unknown** beyond plan included balances ($0/$19/$100/$399 list prices).

### 12.6 Separated monthly cost buckets (confidence labels)

**Native-only (0% external memory calls)**

| Bucket | S | M | L | Confidence |
| --- | --- | --- | --- | --- |
| Vendor memory fees | $0 | $0 | $0 | high |
| Model/embedding fees | $0–$200 | $200–$3,000 | $3,000–$40,000 | low |
| Database fees | $0–$200 | $200–$2,000 | $2,000–$15,000 | low |
| Worker/infra | $0–$100 | $100–$1,000 | $1,000–$10,000 | low |
| Eng build (amortized) | $5k–$15k | $8k–$25k | $12k–$40k | low |
| Eng maintenance | $1k–$5k | $3k–$10k | $6k–$20k | low |
| Migration/exit | negligible | low | low | medium |

**If Mem0 managed enabled**, add vendor fees from §12.2; at M/L with nontrivial search rates, public Pro is insufficient → **enterprise/usage unknown** (do not invent).

---

## 13. Benchmark evidence review

| Field | Mem0 eval framework | Zep DMR | Zep LongMemEval | Supermemory LongMemEval/LoCoMo/ConvoMem | Cognee arXiv 2505.24478 | HippoRAG |
| --- | --- | --- | --- | --- | --- | --- |
| Benchmark name | Mem0 memory-benchmarks (claimed) | DMR | LongMemEval | those three | KG↔LLM interface paper | HippoRAG |
| Source ID | S3/S4 (claims) | S8 | S8 | S15 | S10 | S19 |
| Dataset | unknown (not audited here) | DMR (MemGPT-associated) | LongMemEval | unknown details here | paper-specific | paper/repo |
| Task | memory retrieval QA (claimed) | deep memory retrieval | temporal long-mem QA | memory benches (claimed) | reasoning interface | multi-hop RAG |
| Memory input size | unknown | unknown | unknown | unknown | unknown | unknown |
| Retrieval method | unknown here | Zep/Graphiti pipeline | Zep pipeline | unknown | cognee pipeline | PPR over KG |
| Answer model | unknown | unknown | unknown | unknown | unknown | unknown |
| Metric | unknown here | accuracy % | accuracy / latency claims | leaderboard claim | paper metrics | paper metrics |
| Reported result | vendor site claims | 94.8% vs 93.4% | up to +18.5% acc; −90% latency claim | “#1” claim | paper results | paper results |
| Baselines | claimed open | MemGPT | baselines in paper | unknown | paper | paper |
| Code availability | claimed repo exists | paper; product closed | paper | unknown | paper/repo | yes (S19) |
| Data availability | unknown | unknown | public LongMemEval exists upstream | unknown | unknown | unknown |
| Vendor-authored | yes | yes | yes | yes | yes | no (academic) |
| Independently reproduced | **no** | **no** | **no** | **no** | **no** | **no** |
| Preprocessing latency included | unknown | unknown | unknown | unknown | unknown | unknown |
| Extraction/indexing token cost included | unknown | unknown | unknown | unknown | unknown | unknown |
| Relevance to Cortaix | low–medium (ignores trust/disclosure/packing) | low | medium temporal QA only | low until independent | low–medium | medium retrieval ideas |
| Limitations | not audited; not selected on | vendor paper; not packing eval | same | marketing crown | different problem | not a product memory layer |

Label for all above results used in this Stage 13:

```text
code available (where noted)
not reproduced in this evaluation
```

Do **not** merge these into one leaderboard.

---

## 14. Supermemory OSS vs managed (separated)

| Dimension | Supermemory OSS [S15] | Supermemory managed [S15a] |
| --- | --- | --- |
| License / terms | MIT at commit `ea2cf33…` | Hosted ToS + pricing; legal review required |
| Deployment | Self-host claims (“one binary” marketing in README) | SaaS API |
| Data location | Operator-controlled if truly self-hosted | Vendor cloud |
| Runtime | TS-oriented monorepo; ops burden on Cortaix | HTTP API |
| Connectors | **Do not assume** full managed connector set without evidence | Drive/Notion/Gmail/GitHub etc. documented |
| Stable IDs | unknown mapping to Cortaix | customId/document ids documented; mapping still Cortaix-owned |
| Search output | unknown without deeper API audit of OSS binary | Search/profile APIs; risk of prompt-ready profiles |
| Deletion/export | unknown parity | Forget APIs + resets documented; attestation unknown |
| Best permitted role | watchlist local engine | `ConnectorIngestionPort` watchlist; reject as canonical memory |
| Core hard gates | fail G1/G8 | fail G1/G8; G4 fail for sensitive unconditional sync |
| Evidence completeness | 55% | 55% |

---

## 15. Build-versus-reuse decomposition

| Component | Decision | Notes |
| --- | --- | --- |
| Canonical assertion store | `build_native` / `reject_external_ownership` | Gate 1 |
| Trust/lifecycle | `build_native` | Stage 8 |
| Extraction assistance | `build_native` | optional LLM HTTP; not Mem0-as-authority |
| Dedupe/conflict | `build_native` | |
| Entity extraction/resolution | `build_native` | |
| Relationship projection | `build_native` + `proof_of_concept_required` | Graphiti conditional |
| Temporal graph DB | `defer` | not v1 required [S1] |
| Embedding generation | `reuse_standard_library` | HTTP clients |
| Vector index | `build_native` (pgvector) + optional adapter PoC | Mem0 |
| FTS/exact/fusion/pack/influence | `build_native` | Stage 12 |
| Reranking | `proof_of_concept_required` | port preserved |
| Summaries | `build_native` | derived |
| Documents | `build_native` | LlamaIndex watchlist only |
| Connectors | `defer` / watchlist | Supermemory managed |
| Observability | `reuse_standard_library` | |
| Eval tooling | `build_native` | Stage 15 |

---

## 16. Proof-of-concept specifications

PoCs are **not implemented** in this PR. Candidates already incompatible for the intended role get **no** PoC.

### 16.1 PoC-A — Mem0 OSS or Platform as ExternalMemoryIndexPort

| Field | Spec |
| --- | --- |
| Hypothesis | ID-only Mem0 channel can add recall without becoming text authority |
| Exact port | `ExternalMemoryIndexPort` |
| Candidate/version | Mem0 Platform API v3 and/or OSS server pinned to commit `d6d89c98…` [S3][S6] |
| Dataset | ≥200 seeded assertions + paraphrases + expirations + deletes |
| Golden queries | ≥30 Stage-12-like queries |
| Security cases | secret-bearing queries; highly_sensitive evidence |
| Cross-user test | user A query must not retrieve user B mapped hits |
| Query-disclosure test | denied purpose → zero external calls |
| Evidence-disclosure test | `allow_external_index_disclosure=false` never sent |
| Deletion test | delete assertion → mapping gone + remote miss |
| Purge test | user delete → vendor delete_all + verify search empty |
| Outage test | 5xx/timeout → native-only success |
| Canonical-reconciliation test | hits without canonical mapping discarded; **zero** remote-text packs |
| Latency | p50/p95 external channel vs PG |
| Quality metric | recall@k / nDCG on golden set vs native-only |
| Cost measure | add + search counts vs [S5] plan units |
| Exit/rebuild | wipe vendor; rebuild from PG; quality within tolerance |
| Success criteria | all security/disclosure/reconcile/outage pass; no authority leak |
| Failure criteria | any unmapped text packed; isolation miss; mandatory dependency emerges |
| Max eng time budget | ≤5 engineer-days spike |
| Decision produced | pass → may become `adopt_as_optional_adapter`; fail → disable/remove path |

### 16.2 PoC-B — Graphiti derived projection

| Field | Spec |
| --- | --- |
| Hypothesis | Temporal edges improve relationship channel without granting truth |
| Exact port | `RelationshipProjectionPort` (+ entity projection if in scope) |
| Candidate/version | `graphiti-core` at commit `3bb2d0bb…` [S7] |
| Dataset | assertion-backed entities/relationships with corrections & invalidations |
| Golden queries | relationship/entity focused queries; hop-cap cases |
| Security / disclosure / cross-user | same class as PoC-A |
| Deletion/purge | user subgraph removed; searches empty |
| Outage | graph down → native continues |
| Canonical reconciliation | graph-only facts never eligible without supporting assertions |
| Latency / quality / cost | graph channel cost; Neo4j/Falkor ops included |
| Exit/rebuild | drop DB; rebuild from PG |
| Success | rebuildable; edge≠truth; hop caps; purge works |
| Failure | graph influences trust/eligibility; required dependency |
| Budget | ≤8 engineer-days including ops standup |
| Decision | pass → optional adapter candidate; fail → native SQL projection only |

### 16.3 PoC-C — RetrievalReranker

| Field | Spec |
| --- | --- |
| Hypothesis | HTTP rerank improves ranking without breaking eligibility/disclosure |
| Port | `RetrievalReranker` |
| Candidate/version | one Cohere- or Voyage-class API **to be named in Stage 15**; none selected now |
| Dataset / golden | same retrieval golden set |
| Security / disclosure | rerank purpose deny; no ineligible promotion |
| Deletion/purge | not applicable (stateless); mark gate applicability accordingly |
| Outage | noop fallback |
| Canonical reconciliation | IDs unchanged |
| Latency / quality / cost | delta nDCG; $/1k reranks |
| Success | no eligibility/disclosure regression; optional only |
| Failure | correctness requires rerank; leaks text against policy |
| Budget | ≤3 engineer-days |
| Decision | pass → optional vendor enable; fail → keep noop |

### 16.4 PoC-D — Supermemory connectors (optional, later)

Only after core Stage 8–12 ports exist. Hypothesis: connectors reduce build cost without write authority. Budget ≤5 days. Until scheduled: **watchlist**, not required for Recommendation B.

### 16.5 Unnecessary PoCs

Letta as memory core; Zep/Supermemory/Mem0 as canonical truth; replacing WRRF with vendor fusion; any remote-text-authority design.

---

## 17. Security analysis (≥25 threats)

Threat format: threat → types → architectural protection → operational protection → residual → Stage 14 question → Stage 15 test.

1. Cross-user retrieval — indexes — Gateway user scope + mapping — audits — residual vendor bugs — filter bypass? — isolation suite.  
2. Vendor tenant-filter failure — managed — never trust filter-only — sampling — residual — server-side proof? — cross-tenant probe.  
3. Remote text authority — Mem0/Zep/SM — forbid fallback — lint — residual regression — always reconcile? — no-text-authority.  
4. Stale external facts — derived — canonical eligibility — rebuild — lag — SLA? — staleness.  
5. Deleted still remote — derived — coordinator — verify — soft-delete — purge confirm? — suppression.  
6. Incomplete purge — managed — tracked jobs — attest — unknown retention — contractual? — purge evidence.  
7. Query secret leakage — all external — QueryDisclosure — redaction — side channels — matrix complete? — deny test.  
8. Restricted evidence leakage — external — evidence flags — monitors — mistag — BYOK bypass? — evidence test.  
9. Embedding-space drift — managed embeds — pin space_id — canaries — silent change — detect? — drift test.  
10. Silent model changes — managed — contracts — notices — residual — — canary.  
11. Unversioned retrieval changes — managed — Cortaix policy version — changelogs — — pin test.  
12. Framework trust decisions — platforms/runtimes — Gateway only — reject — — write conformance.  
13. Agent-autonomous writes — Letta/LangMem — proposals only — disable — — tool-write test.  
14. Always-visible bypass — profiles/frameworks — Stage 12 budget — — — packing test.  
15. Prompt injection via framework context — prompt APIs — untrusted render — — — injection corpus.  
16. Graph edges as truth — Graphiti/Zep/Cognee — derived only — — — edge vs assertion.  
17. Conflict collapse — summarizers — ConflictContext — — — conflict preserve.  
18. Historical as current — temporal graphs — temporal eligibility — — — temporal test.  
19. Opaque reranker — rerank APIs — optional bound — logs — — eligibility-after-rerank.  
20. Benchmark overfitting — vendors — own golden set — — — Cortaix eval.  
21. Vendor outage — managed — optional channel — status — — outage fallback.  
22. Rate limiting — managed — backoff — budgets — — soak.  
23. API retirement — managed — pin adapters — — — contract watch.  
24. Licensing changes — OSS/hosted — pin versions — legal — — watch.  
25. Pricing changes — managed — caps + native — finance — — TCO revisit.  
26. Service termination — managed — exit plan — backups — — exit drill.  
27. Export incompleteness — managed — PG export — — — export parity.  
28. Migration lock-in — dual-write — disposable derived — — — rebuild.  
29. Supply-chain compromise — OSS/Python — minimal deps — SBOM — — review.  
30. Self-host exposure — OSS servers — private net — hardening — — checklist.  
31. Python expansion — Graphiti/Cognee/Mem0 OSS — isolated workers — — — boundary review.  
32. Worker failure — async — outbox/idempotency — — — retry tests.  
33. Duplicate canonical/external writes — hybrid — idempotent keys — — — divergence test.

---

## 18. Worked adoption scenarios (≥20)

1. Native-only WRRF path.  
2. Mem0 hit without canonical ID → discard.  
3. External returns deleted id → suppress.  
4. External unavailable → native continues.  
5. Embedding model changes → disable space; reindex.  
6. Query disclosure denies external search.  
7. Evidence must not leave Cortaix.  
8. Stale graph adapter → drop channel.  
9. False graph relationship → no trust.  
10. User correction → Gateway revision; derived async.  
11. Account delete → coordinator purges all derived.  
12. Export from PostgreSQL.  
13. Python-only engine → worker isolation or reject in-request.  
14. Long-running work → durable jobs, not Vercel request thread.  
15. Managed price triples → disable adapter.  
16. OSS abandoned → remove adapter; rebuild.  
17. License change → legal + exit.  
18. Strong bench, weak methodology → ignore for selection.  
19. Strong retrieval, weak deletion → reject for sensitive data.  
20. Prompt-ready context → refuse; demand IDs.  
21. Reranker-only use → PoC-C.  
22. Connectors via Supermemory → untrusted intake only.  
23. Graph rebuildable from PG → acceptable depth 1.  
24. Exit current Mem0 hybrid → backfill embeddings; remove remote-text; optional later PoC.  
25. Native costs more eng time; preserves differentiation → accept under B.

---

## 19. Decision outcomes

| Candidate | Core-role outcome | Best permitted port | Role-specific score | Role hard-gate posture | Primary outcome |
| --- | --- | --- | --- | --- | --- |
| Native Cortaix | pass | core platform | 91.4 (core) | target pass; impl partial | `adopt_as_core_dependency` |
| Mem0 OSS | fail | ExternalMemoryIndexPort | 63.6 | conditional | `proof_of_concept_before_decision` |
| Mem0 managed | fail | ExternalMemoryIndexPort | 58.2 | conditional / watch | `watchlist` |
| Graphiti OSS | fail | Relationship/EntityProjection | 63.8 | conditional | `proof_of_concept_before_decision` |
| Zep managed | fail | none required | 57.0 (proj scorecard) | fail as prompt-context core | `reject_for_cortaix` as core; else watchlist |
| Cognee OSS | fail | possible derived graph | 60.8 (proj) / 47.0 (index) | conditional | `watchlist` |
| Cognee managed | fail | none now | not_scored_for_index_leader | fail core | `watchlist` |
| Letta OSS/managed | fail | none | not_scored_for_memory_ports | fail | `reject_for_cortaix` |
| LangGraph/LangMem | fail | ExtractionAssist inspiration | 44.6 | fail core | `reject_for_cortaix` as core; watchlist inspiration |
| Supermemory OSS | fail | local engine watchlist | not_scored_for_connectors | fail core | `watchlist` |
| Supermemory managed | fail | ConnectorIngestionPort | 54.2 | conditional | `watchlist` |
| LlamaIndex | fail | document tooling watchlist | 66.4 (doc scorecard) | fail as memory core | `watchlist` (no package selected) |
| Memobase | fail | none | not_scored_for_this_role | fail core | `watchlist` |
| HippoRAG | fail | research ideas | not_scored_for_product_port | fail core | `watchlist` |
| Reranker APIs | fail as core | RetrievalReranker | 63.8 | conditional | `proof_of_concept_before_decision` |

---

## 20. Final recommendation

### 20.1 Choice

**Recommendation B remains supported** after corrections: native canonical core + optional adapter **ports**, with **no external provider selected now**.

### 20.2 Decision language

```text
Final:
  Native canonical core.
  ExternalMemoryIndexPort remains optional (port preserved).
  RelationshipProjectionPort / EntityProjectionPort remain optional.
  RetrievalReranker remains optional (noop default).

Conditional:
  Mem0 OSS may fill ExternalMemoryIndexPort after PoC-A.
  Graphiti may fill RelationshipProjectionPort after PoC-B.
  No reranker vendor selected until PoC-C / Stage 15.
  Supermemory managed connectors remain watchlist only.

Not selected:
  Mem0 managed as default.
  Zep / Cognee / Supermemory / LlamaIndex / Letta / Lang* as canonical memory or runtime.
```

### 20.3 What could reverse B

Independent evidence of a hard-gate-safe primary derived engine with verified purge/isolation **and** inability of native Stage 12 delivery — not demonstrated. Corrected scores alone cannot reverse hard-gate failures.

### 20.4 Mem0 migration path (implementation stages later; not this PR)

1. Treat as derived only.  
2. Remove remote-text fallback.  
3. Require canonical mapping.  
4. Backfill/keep pgvector.  
5. Timeouts + native degrade.  
6. Disclosure gates.  
7. Deletion coordinator.  
8. Default off until PoC-A passes.

### 20.5 Impact on 14–17

Unchanged in spirit: 14 red-teams B; 15 tests before any adapter; 16 sequences native first; 17 preserves invariants. No implementation authorized.

---

## 21. Final matrices

### 21.1 Candidate matrix

| Candidate | Core hard gates | Core weighted | Best permitted port | Role score | Role gates | Evidence completeness % | Lock-in | TCO note | Verdict |
| --- | --- | ---: | --- | --- | --- | ---: | ---: | --- | --- |
| Native | pass (target) | 91.4 | core | 91.4 | target pass | 71 | 0 | eng-heavy | adopt core |
| Mem0 OSS | fail | 43.6 | ExternalMemoryIndexPort | 63.6 | conditional | 50 | 1–2 | see §12.2 | PoC before decision |
| Mem0 managed | fail | 45.2 | ExternalMemoryIndexPort | 58.2 | conditional | 50 | 3 | S@100% search exceeds Starter | watchlist |
| Graphiti OSS | fail | 43.8 | Relationship/EntityProjection | 63.8 | conditional | 70 | 2–3 | Neo4j/Falkor ops | PoC before decision |
| Zep managed | fail | 45.0 | none required | not_scored as core-substitute | fail prompt-context core | 50 | 4 | credits unknown burn | reject core |
| Cognee OSS | fail | 40.8 | derived graph watchlist | 60.8 proj | conditional | 60 | 2 | tokens unknown | watchlist |
| Cognee managed | fail | 37.4 | none now | not_scored_for_this_role | fail core | 40 | 3 | $2.50/1M unknown map | watchlist |
| Letta OSS | fail | 19.8 | none | not_scored_for_this_role | fail | 50 | 5 | fork | reject |
| Letta managed | fail | 20.8 | none | not_scored_for_this_role | fail | 38 | 5 | fork | reject |
| LangGraph/LangMem | fail | 33.8 | inspiration only | 44.6 extract card | fail core | 63 | 2 | Python tax | reject core |
| Supermemory OSS | fail | 47.4 | watchlist engine | not_scored_for_connectors | fail core | 55 | 2 | self-host ops | watchlist |
| Supermemory managed | fail | 43.0 | ConnectorIngestionPort | 54.2 | conditional | 55 | 3–4 | SM tokens unknown map | watchlist |
| LlamaIndex | fail | 44.0 | doc tooling watchlist | 66.4 | fail memory core | 70 | 1 | — | watchlist |
| Memobase | fail | 38.4 | none | not_scored_for_this_role | fail | 40 | 2 | unknown | watchlist |
| HippoRAG | fail | 44.6 | research | not_scored_for_this_role | fail | 60 | 0–1 | eng | watchlist |
| Reranker APIs | fail as store | 35.0 | RetrievalReranker | 63.8 | conditional | 50 | 1 | low | PoC before decision |

### 21.2 Component matrix

| Cortaix component | Native | Reuse candidate | Decision | Reason |
| --- | --- | --- | --- | --- |
| Assertion store | Yes | — | build_native | G1 |
| Trust/lifecycle/disclosure | Yes | — | build_native | Stages 8–12 |
| Extraction | Yes | LLM HTTP | build_native | Gateway |
| Relationship projection | Yes | Graphiti after PoC-B | build_native + PoC | edges derived |
| Vector index | pgvector | Mem0 after PoC-A | native primary | fallback |
| Fusion/packing/influence | Yes | — | build_native | Stage 12 |
| Rerank | Interface | unnamed HTTP after PoC-C | PoC-gated | optional |
| Documents | Yes | LlamaIndex watchlist | build_native | no package selected |
| Connectors | Later | Supermemory managed | defer/watchlist | after core |

---

## 22. Invariants

1. Framework evaluation cannot redefine Stages 7–12.  
2. PostgreSQL remains canonical regardless of recommendation.  
3. A weighted score cannot override a failed hard gate.  
4. Vendor benchmark claims remain labelled.  
5. Unknown pricing remains unknown.  
6. Managed isolation is not assumed without evidence.  
7. External text never bypasses canonical reconciliation.  
8. External IDs never replace canonical assertion IDs.  
9. Optional external outage does not prevent native retrieval.  
10. User deletion propagates to every derived system.  
11. Provider disclosure remains Cortaix-owned.  
12. Trust and conflict remain Cortaix-owned.  
13. Final packing remains Cortaix-owned.  
14. Agent-autonomous writes remain validated.  
15. Framework adoption needs an exit strategy.  
16. Self-hosting ≠ low ops risk.  
17. Open source ≠ portable.  
18. Managed ≠ production-safe.  
19. A framework may pass one port and fail another.  
20. Stage 13 does not authorize implementation.  
21. **Every displayed weighted total must reproduce exactly from the displayed category scores and weights.**  
22. Core-role and adapter-role scores are not interchangeable.  
23. Gate outcomes use only `pass|conditional_pass|fail|unknown`; applicability is separate.  
24. Native target gates ≠ implementation verification.  
25. `adopt_as_optional_adapter` requires a successful PoC when a PoC is required.

---

## 23. Acceptance questions (delta answers)

Weighted totals corrected (§8–9). Roles separated (§2.4, §9). Gates enum-clean (§7). Native target vs impl (§4.3). Sources auditable (§3). Evidence completeness % from ledgers (§10). TCO workload math (§12). Benchmarks field-complete or `unknown` (§13). Supermemory OSS/managed split (§14). Port contracts complete for plausible adapters (§11). PoC-gated outcomes for Mem0 OSS, Graphiti, rerankers (§16, §19). Recommendation B retained with **no provider selected now** (§20).

---

## 24. Stage 14 / 15 / 16–17 handoffs

**Stage 14:** Bias toward designed architecture? Native cost understated? Managed ops understated? Privacy assumed? Reconcile realistic? Optional→mandatory creep? Dual-write divergence? Vendor scores leaking into trust? Purge strong enough? Benches invalid? Adapter surface too large? Remove Mem0 entirely vs harden?

**Stage 15:** Adapter conformance; ID reconcile; deleted suppression; isolation; query/evidence disclosure; embed drift; outage; rebuild; export; purge; latency; cost; quality; conflict; temporal; injection; upgrade; exit.

**Stage 16–17:** Native ports first; PoC-A/B/C before provider enablement; dedicated PRs for any dependency; all adapters reversible; **no implementation authorized by Stage 13**.

---

## 25. Final report checklist

1. Corrected weighted totals: Native core **91.4**; adapter scorecard examples Mem0 OSS **63.6**, Graphiti **63.8**, rerankers **63.8** (role-specific only).  
2. Core-role leader: Native 91.4.  
3. Adapter leaders: ExternalIndex Mem0 OSS 63.6 (PoC); Projection Graphiti 63.8 (PoC); Reranker 63.8 (PoC); Connectors Supermemory managed 54.2 (watchlist); Documents native 82.4; Extraction native 79.8.  
4. Hard-gate methodology: enum + applicability; core vs adapter tables.  
5. Native target vs implementation distinguished.  
6. Source register expanded with URLs/SHAs/vendor flags.  
7. Evidence completeness = supported/total from ledgers.  
8. Scenario workloads calculated (§12.1).  
9. Public pricing mapped; enterprise/overage/token-burn often **unknown**.  
10. Benchmarks tabulated with unknowns; not reproduced here.  
11. Supermemory OSS ≠ managed.  
12. Port contracts for Mem0, Graphiti, rerankers, Supermemory connectors; LlamaIndex/Cognee watchlist-qualified.  
13. PoC-gated: Mem0 OSS, Graphiti, rerankers.  
14. **Recommendation B remains supported.**  
15. Remaining concerns: implementation gap vs target; dual-write; purge attestation; adapter complexity.  
16. Stage 13 safe to merge as **draft docs** after review.  
17. Stage 14 may begin after review (red-team only).

---

## 26. Document control

| Item | Value |
| --- | --- |
| Implementation authorized | **No** |
| Providers selected now | **None** (ports only) |
| Next stage | 14 — red-team |
| PR posture | Draft documentation only |
