# Stage 13 — Memory Framework Build-versus-Reuse Evaluation

| Field | Value |
| --- | --- |
| Stage | 13 — Framework evaluation |
| Status | Draft for architecture review (final evidence-auditability revision) |
| Document date | 2026-07-24 |
| Research access date | 2026-07-24 |
| Binding predecessors | Stages 0, 5–12 (especially 7–12) |
| Output | Evaluation only — **no implementation authorized** |
| Repository context | Cortaix / Context Vault (`NicolVii/ContextVault`) |
| Revision note | Adds category score evidence; separates evidence completeness from implementation readiness; full claim ledgers; benchmark source pins; completes PoC-B/C and PoC-D; corrects cost sensitivity models |

---

## 0. Executive summary

**Final architecture decision: Recommendation B — Native canonical core plus optional framework adapters.**

Corrected evidence still supports B. **No external provider is selected now.**

| Decision class | Content |
| --- | --- |
| **Final** | PostgreSQL-backed native Cortaix owns canonical memory, trust, lifecycle, disclosure, WRRF×policy retrieval, packing, and deletion/export. |
| **Ports preserved** | `ExternalMemoryIndexPort`, `RelationshipProjectionPort` / `EntityProjectionPort`, `RetrievalReranker` (noop default). |
| **Conditional (PoC-gated)** | Mem0 OSS → index port after PoC-A; Graphiti → projection after PoC-B; unnamed reranker after PoC-C; Supermemory connectors after PoC-D. |
| **Not selected** | Mem0 managed default; Zep/Cognee/Supermemory/LlamaIndex/Letta/Lang* as canonical memory or runtime. |

Invariant retained:

```text
No weighted score is decision-grade unless every raw category
score has a documented rationale, source IDs, confidence, and unknowns.
```

Every displayed weighted total still recomputes from category scores. Core-role and adapter-role scores remain non-interchangeable. Hard gates still block all external **core** adoption.

---

## 1. Scope and method

### 1.1 In scope

Evidence-based build-versus-reuse evaluation; hard gates; core vs adapter scoring with score rationales; auditable sources; full material-claim ledgers; workload TCO; PoC specifications only; handoffs.

### 1.2 Out of scope

Production code, migrations, SQL, APIs, prompts, tests, dependencies, config, env vars, provider integrations, feature flags, deployment; edits to Stages 0–12; beginning Stages 14–17; PoC coding.

### 1.3 Binding architecture

Stages 7–12 remain binding, including `Final(c) = WRRF(c) × (1 + λ_policy × Policy(c))` with `λ_policy = 0.15`, `k = 60`.

### 1.4 Non-negotiable Cortaix contracts

Unchanged from prior revision: PostgreSQL canonical; external systems derived; no remote-text authority; Cortaix owns trust/eligibility/disclosure/conflict/packing; graph edges ≠ truth; disclosure before external calls; BYOK ≠ bypass; pinned embedding spaces; native fallback; provider independence; agent writes validated; no always-visible bypass; deletion/export from canonical state.

### 1.5 Research method

Primary sources preferred. Official docs verify **retrieval of vendor claims**, not independent corroboration. Benchmark labels: `vendor-reported | paper-reported | independently reproduced | not reproducible from available information`. Confidence: `high | medium | low | unverified`. Access date unless noted: **2026-07-24**.

---

## 2. Scoring and gate models

### 2.1 Hard gates

Gates G1–G10 unchanged. Outcomes enum only: `pass | conditional_pass | fail | unknown`. Applicability separate: `applicable | not_applicable`. Failed applicable gate blocks canonical-core adoption. Scores never override failed gates.

### 2.2 Native target vs current implementation

```text
target_architecture_gate_result
current_implementation_status
test_evidence_status
```

Statuses: `implemented_and_verified | implemented_not_fully_verified | partially_implemented | designed_not_implemented | unknown`.

Architectural intent ≠ production evidence. Prefer the per-control status matrix (§4.3) over a single implementation percentage.

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

Worked Native example:

```text
Native =
  (5/5 × 20) + (5/5 × 18) + (5/5 × 12) + (4/5 × 12) + (5/5 × 10)
+ (4/5 × 8) + (5/5 × 7) + (3/5 × 5) + (3/5 × 5) + (4/5 × 3)
= 20+18+12+9.6+10+6.4+7+3+3+2.4
= 91.4
```

Invariants:

```text
Every displayed weighted total must reproduce exactly from
the displayed category scores and weights.

No weighted score is decision-grade unless every raw category
score has a documented rationale, source IDs, confidence, and unknowns.
```

### 2.4 Two-level scoring

**A. Core-role:** every candidate under `canonical Cortaix memory core`.  
**B. Adapter scorecards:** only same-port competitors. No global second-place framework. Missing role → `not_scored_for_this_role`.

### 2.5 Evidence completeness vs implementation readiness

**Evidence completeness** (same meaning for every candidate):

```text
evidenceCompletenessPercent =
  materially_adjudicated_claims_with_valid_current_sources
  /
  total_material_claims
  × 100
```

A claim is **adjudicated** when its truth value—positive or negative—is supported by cited sources. Supported negatives (e.g. “WRRF is not implemented”) count toward evidence completeness. They do **not** count as implemented capabilities.

**Implementation readiness** remains the separate per-control status matrix (§4.3). Do not conflate evidence completeness with implementation completeness, positive-capability completeness, or architecture compatibility.

---

## 3. Source register

| source_id | Exact title | Owner | Source type | Direct URL | Publication/update (when available) | Pin | Access date | Vendor-authored | Retrieval verified | Independently corroborated | Confidence | Commercial interest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Stages 7–12 memory-system docs | Cortaix | Internal architecture | `docs/memory-system/07`–`12` | In-repo | evaluation branch | 2026-07-24 | no (product owner) | yes | **no** (own docs) | high | product |
| S2 | Current memory/embeddings/documents/orchestration code | Cortaix | Source code | `src/lib/memory/` etc. | In-repo | evaluation branch | 2026-07-24 | no | yes | **no** (own code) | high | product |
| S3 | mem0ai/mem0 + Apache-2.0 LICENSE | Mem0 | OSS repo/license | https://github.com/mem0ai/mem0 | pushed_at 2026-07-23T16:24:15Z | commit `d6d89c987bddf580870db14c69db974edfc5263c` | 2026-07-24 | yes | yes | no | high | vendor |
| S4 | Mem0 Open Source Overview | Mem0 | Official docs | https://docs.mem0.ai/open-source/overview | Live page | page+access date | 2026-07-24 | yes | yes | no | high | vendor |
| S5 | Mem0 Pricing | Mem0 | Official pricing | https://mem0.ai/pricing | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S6 | Mem0 Search Memories API | Mem0 | Official API ref | https://docs.mem0.ai/api-reference/memory/search-memories | Live | page+access date | 2026-07-24 | yes | yes | no | high | vendor |
| S7 | getzep/graphiti README | Zep AI | OSS README | https://github.com/getzep/graphiti | pushed_at 2026-07-23T23:03:24Z | commit `3bb2d0bba56f8e22311574c045452c420a012f49` | 2026-07-24 | yes | yes | no | high | vendor |
| S8 | Zep: A Temporal Knowledge Graph Architecture for Agent Memory | Rasmussen et al. (Zep AI) | Research paper | https://arxiv.org/abs/2501.13956 | arXiv 2501.13956 (2025) | arXiv id | 2026-07-24 | yes | yes | no | medium | vendor-authored paper |
| S9 | Zep product + Pricing | Zep | Official marketing/pricing | https://www.getzep.com/ ; https://www.getzep.com/pricing/ | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S9a | Zep Quickstart | Zep | Official docs | https://help.getzep.com/v2/quickstart.mdx | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S10 | topoteretes/cognee README | Cognee | OSS README | https://github.com/topoteretes/cognee | pushed_at 2026-07-24T10:28:58Z | commit `90b4acaac937dc1c0aeffaead8b707c896ebf3db` | 2026-07-24 | yes | yes | no | high | vendor |
| S11 | Cognee pricing | Cognee | Official pricing | https://www.cognee.ai/pricing | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S11a | Cognee docs hub | Cognee | Official docs | https://docs.cognee.ai/ | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S12 | letta-ai/letta README | Letta | OSS README | https://github.com/letta-ai/letta | pushed_at 2026-07-22T00:32:52Z | commit `b76da9092518cbaa2d09042e52fdcbde69243e18` | 2026-07-24 | yes | yes | no | high | vendor |
| S13 | Letta Documentation | Letta | Official docs | https://docs.letta.com/ | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S14 | langchain-ai/langmem + docs | LangChain | OSS + docs | https://github.com/langchain-ai/langmem ; https://langchain-ai.github.io/langmem/ | pushed_at 2026-07-15T06:06:43Z | commit `a2d580946465137c89162e67dc0b18108bd4850c` | 2026-07-24 | yes | yes | no | high | vendor |
| S15 | supermemoryai/supermemory | Supermemory | OSS repo | https://github.com/supermemoryai/supermemory | pushed_at 2026-07-24T07:03:13Z | commit `ea2cf33fd3572d8ba9d4064127025093fddcb547` | 2026-07-24 | yes | yes | no | high | vendor |
| S15a | Supermemory docs / API / pricing | Supermemory | Official docs+pricing | https://docs.supermemory.ai/ ; https://supermemory.ai/pricing/ ; https://supermemory.ai/pricing.md | Live | page+access date | 2026-07-24 | yes | yes | no | medium | vendor |
| S16 | LlamaIndex Memory module docs | LlamaIndex | Official docs | https://developers.llamaindex.ai/python/framework/module_guides/deploying/agents/memory/ | Live | page+access date | 2026-07-24 | yes | yes | no | high | vendor |
| S17 | run-llama/llama_index | LlamaIndex | OSS repo | https://github.com/run-llama/llama_index | pushed_at 2026-07-23T00:10:42Z | commit `7359b1acc74563f715d4463ace39fb4dc73d79af` | 2026-07-24 | yes | yes | no | high | vendor |
| S18 | memodb-io/memobase | Memobase | OSS repo | https://github.com/memodb-io/memobase | pushed_at 2026-01-11T03:51:40Z | commit `358c16bbc6d687937d79bc2f984a11c3be8da901` | 2026-07-24 | yes | yes | no | medium | vendor |
| S19 | OSU-NLP-Group/HippoRAG | OSU NLP | Research OSS | https://github.com/OSU-NLP-Group/HippoRAG | pushed_at 2026-07-13T00:10:52Z | commit `1e8f60981bf760b64003aa5bf5668126d0c106b3` | 2026-07-24 | no (academic) | yes | no | medium | academic |
| S20 | Mem0 OSS REST API docs | Mem0 | Official docs | https://docs.mem0.ai/open-source/features/rest-api | Live | page+access date | 2026-07-24 | yes | yes | no | high | vendor |
| S21 | package.json / .env.example | Cortaix | Source/config example | `/package.json`, `.env.example` | In-repo | evaluation branch | 2026-07-24 | no | yes | **no** (own repo) | high | product |
| S22 | mem0ai/memory-benchmarks | Mem0 | Benchmark OSS repo | https://github.com/mem0ai/memory-benchmarks | GitHub API at access | commit `4b61c5d31b9c668a12b4f5e78064248a02c82d2b` | 2026-07-24 | yes | yes | no | medium | vendor |
| S23 | Optimizing the Interface Between Knowledge Graphs and LLMs for Complex Reasoning | Markovic et al. | Research paper | https://arxiv.org/abs/2505.24478 | arXiv 2505.24478 (2025) | arXiv id | 2026-07-24 | yes (Cognee-affiliated authors per README citation) | yes | no | medium | vendor-affiliated paper |
| S24 | Supermemory README benchmark crown section | Supermemory | OSS README claim locus | https://github.com/supermemoryai/supermemory/blob/ea2cf33fd3572d8ba9d4064127025093fddcb547/README.md | commit date via pin | commit `ea2cf33…`; claim lines ~32–39 and ~375–379 | 2026-07-24 | yes | yes | no | medium | vendor |
| S25 | HippoRAG paper (NeurIPS’24 lineage) + repo | OSU NLP | Paper + code | Paper via repo citations; code S19 | Paper year 2024 lineage | repo commit in S19; paper DOI/arXiv not re-fetched in full prose here | 2026-07-24 | no | partial (repo yes; full paper methodology **not fully read** in Stage 13) | no | medium | academic |
| S26 | LongMemEval upstream | Xiaowu et al. | Benchmark dataset/repo | https://github.com/xiaowu0162/LongMemEval | GitHub API at access | commit `9e0b455f4ef0e2ab8f2e582289761153549043fc` | 2026-07-24 | no | yes | no | medium | academic |
| S27 | DMR benchmark as cited via Zep paper / MemGPT lineage | Zep paper cites MemGPT DMR | Paper citation | Via S8 | 2025 paper | not separately reproduced | 2026-07-24 | mixed | yes (citation retrieval) | no | low | mixed |
| S28 | LoCoMo benchmark repo (as linked by Supermemory README) | Snap Research | Benchmark repo | https://github.com/snap-research/locomo | Linked from S24 | link verified via README fetch; commit not pinned in this audit | 2026-07-24 | no | partial | no | low | academic/industry |
| S29 | ConvoMem benchmark repo (as linked by Supermemory README) | Salesforce | Benchmark repo | https://github.com/Salesforce/ConvoMem | Linked from S24 | link verified via README fetch; commit not pinned | 2026-07-24 | no | partial | no | low | industry |

**Independence rule:** Fetching Cortaix’s own repository (`S1`,`S2`,`S21`) verifies retrieval of Cortaix artifacts; it does **not** independently corroborate them. Fetching vendor docs verifies the vendor’s claim text; it does **not** independently corroborate correctness.

---

## 4. Current repository assessment

### 4.1 Implemented today [S2][S21]

`public.memories` + RLS; pgvector 1536 + `match_memories`; thin provider ports; optional Mem0 hybrid with remote-text fallback; local/OpenAI embeddings; document chunk retrieve; Chat/Think cosine+profile force-merge; no mem0/langchain/llamaindex packages.

### 4.2 Current Mem0 vs Stages 7–12 [S2]

Remote-text fallback; null embeddings on Mem0 path; no query-disclosure gate; no PG degrade on Mem0 errors; delete ordering risks.

### 4.3 Native target vs implementation status

| Control | target_architecture_gate_result | current_implementation_status | test_evidence_status |
| --- | --- | --- | --- |
| PostgreSQL ownership of memory rows | pass | implemented_not_fully_verified | partial RLS integration tests |
| RLS user isolation | pass | implemented_not_fully_verified | partial |
| pgvector semantic channel | pass | partially_implemented | basic tests; not WRRF |
| Query disclosure service | pass (target) | designed_not_implemented | none |
| WRRF × policy fusion | pass (target) | designed_not_implemented | none |
| Conflict-safe packing / untrusted render | pass (target) | designed_not_implemented | none |
| Influence records | pass (target) | designed_not_implemented | none |
| Deletion Coordinator | pass (target) | designed_not_implemented | none |
| Entity/relationship projections | pass (target) | designed_not_implemented | none |
| External outage → native continue | pass (target) | partially_implemented | OK if Mem0 unused; Mem0 path lacks degrade |
| Embedding space registry / reindex | pass (target) | partially_implemented | dim constant; full registry designed |

### 4.4 Must build / commodity / differentiating

Unchanged: build trust/lifecycle/disclosure/WRRF/packing/deletion/entities natively; commodity embed/PDF/rerank/OTEL; differentiate on governance and provider independence.

### 4.5 Preserve / adapt / retire [S2]

Preserve ports + Supabase provider; Mem0 path candidate only after PoC; retire trusted system-prompt interpolation and profile force-inject.

---

## 5. Candidate set

Native; Mem0 OSS; Mem0 managed; Graphiti OSS; Zep managed; Cognee OSS; Cognee managed; Letta OSS; Letta managed; LangGraph/LangMem; Supermemory OSS; Supermemory managed; LlamaIndex; Memobase; HippoRAG; Reranker APIs. Classifications unchanged from prior revision (complete platforms vs complementary components).

---

## 6. Native baseline

PostgreSQL/Supabase/pgvector/FTS(planned)+Stage 8–12 services. High eng complexity; medium ops on Supabase; highest differentiation; lock-in negligible; security highest **when implemented**; 12-month cost engineering-dominant (§12).

---

## 7. Hard-gate results

### 7.1 Core role

| Candidate | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | Core outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Native (target) | pass | pass | pass | pass | pass | pass | pass | pass | pass | pass | only core pass |
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
| Reranker APIs | fail | fail | conditional_pass | conditional_pass | unknown | pass | fail | fail | pass | conditional_pass | fail as core |

### 7.2 Adapter-role gates

#### Mem0 OSS / managed as `ExternalMemoryIndexPort`

| Gate | Applicability | Mem0 OSS | Mem0 managed | Notes |
| --- | --- | --- | --- | --- |
| G1 | applicable | conditional_pass | conditional_pass | Only if PostgreSQL remains sole authority and remote text is forbidden |
| G2 | applicable | conditional_pass | conditional_pass | Needs stable `cv_memory_id` mapping tests [S2][S6] |
| G3 | applicable | conditional_pass | conditional_pass | `user_id` filters exist [S6]; Cortaix must not trust filter-only |
| G4 | applicable | conditional_pass | conditional_pass | Only disclosure-approved data |
| G5 | applicable | conditional_pass | conditional_pass | Delete APIs exist [S6][S20]; purge attestation unknown |
| G6 | applicable | pass | pass | Only if native fallback is mandatory and implemented |
| G7 | applicable | conditional_pass | unknown | OSS configurable [S4]; managed embed control unknown |
| G8 | applicable | conditional_pass | conditional_pass | Candidates/IDs only; Cortaix owns Final/packing |
| G9 | applicable | pass | pass | Not an agent runtime |
| G10 | applicable | pass | conditional_pass | Apache-2.0 OSS [S3]; hosted ToS need legal review |

#### Graphiti OSS as `RelationshipProjectionPort` / `EntityProjectionPort`

| Gate | Applicability | Result | Notes |
| --- | --- | --- | --- |
| G1 | applicable | conditional_pass | Derived only; edges never grant truth [S1][S7] |
| G2 | applicable | conditional_pass | Map graph UUIDs ↔ assertion/entity IDs |
| G3 | applicable | conditional_pass | Must namespace per Cortaix user |
| G4 | applicable | conditional_pass | Disclosure before projection LLM/embed calls |
| G5 | applicable | conditional_pass | Coordinator required; attestation unknown |
| G6 | applicable | pass | Optional channel; native continues |
| G7 | applicable | conditional_pass | Defaults OpenAI [S7]; pin/isolate spaces |
| G8 | applicable | conditional_pass | Graph feeds candidates only |
| G9 | applicable | pass | Model-swappable with caveats [S7] |
| G10 | applicable | pass | Apache-2.0 [S7]; legal review still required |

#### Reranker APIs as `RetrievalReranker`

| Gate | Applicability | Result |
| --- | --- | --- |
| G1 | not_applicable | — |
| G2 | not_applicable | Operates on already-canonical candidate IDs |
| G3 | applicable | conditional_pass |
| G4 | applicable | conditional_pass |
| G5 | not_applicable | Stateless; no corpus |
| G6 | applicable | pass (noop default) |
| G7 | not_applicable | — |
| G8 | applicable | conditional_pass (cannot change eligibility/disclosure) |
| G9 | applicable | pass |
| G10 | applicable | conditional_pass |

#### Supermemory managed as `ConnectorIngestionPort`

| Gate | Applicability | Result |
| --- | --- | --- |
| G1 | applicable | conditional_pass if connectors emit untrusted intake only |
| G2 | applicable | conditional_pass |
| G3 | applicable | conditional_pass (container tags [S15a]) |
| G4 | applicable | conditional_pass; often fail for sensitive sources unless denied |
| G5 | applicable | conditional_pass (forget APIs [S15a]); purge attestation unknown |
| G6 | applicable | pass if connectors optional |
| G7 | applicable | unknown |
| G8 | not_applicable | Ingestion, not Stage 12 fusion |
| G9 | applicable | pass |
| G10 | applicable | conditional_pass |

---

## 8. Core-role weighted scores (summary)

| Candidate | Weighted |
| --- | ---: |
| Native Cortaix | **91.4** |
| Supermemory OSS | 47.4 |
| Mem0 managed | 45.2 |
| Zep managed | 45.0 |
| HippoRAG | 44.6 |
| LlamaIndex | 44.0 |
| Graphiti OSS | 43.8 |
| Mem0 OSS | 43.6 |
| Supermemory managed | 43.0 |
| Cognee OSS | 40.8 |
| Memobase | 38.4 |
| Cognee managed | 37.4 |
| Reranker APIs | 35.0 |
| LangGraph/LangMem | 33.8 |
| Letta managed | 20.8 |
| Letta OSS | 19.8 |

Hard-gate failures still block all non-Native core adoption. Category-level evidence follows.

## 8A. Core-role category score evidence

#### Score evidence — `Native Cortaix` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Native Cortaix | canonical Cortaix memory core | Architecture compatibility | 5 | 20 | 20.0 | S1 | Stages 7–12 assign PostgreSQL sole semantic authority; Native is the designed core. | high | Implementation of Stage 9 schema pending |
| Native Cortaix | canonical Cortaix memory core | Security, privacy, and governance | 5 | 18 | 18.0 | S1,S2 | RLS and Gateway/disclosure design keep trust/eligibility Cortaix-owned; disclosure service not yet shipped but architecture places it natively. | high | Query disclosure not implemented |
| Native Cortaix | canonical Cortaix memory core | Data ownership and portability | 5 | 12 | 12.0 | S1,S2 | Canonical rows, export path, and rebuildable derived indexes are native by design; export of embeddings exists today. | high | Deletion coordinator not implemented |
| Native Cortaix | canonical Cortaix memory core | Retrieval and temporal capability | 4 | 12 | 9.6 | S1,S2 | Multi-channel WRRF×policy designed; only cosine channel implemented today — score 4 reflects design strength minus missing channels. | high | FTS/WRRF not implemented |
| Native Cortaix | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 5 | 10 | 10.0 | S2,S21 | Already TypeScript/Next.js/Supabase/pgvector without Python memory runtime. | high | None material for stack fit |
| Native Cortaix | canonical Cortaix memory core | Operational reliability and observability | 4 | 8 | 6.4 | S2 | Local Supabase ops are understood; durable workers/outbox still designed-not-implemented — score 4 not 5. | high | Worker on-call burden unmeasured |
| Native Cortaix | canonical Cortaix memory core | Vendor and model independence | 5 | 7 | 7.0 | S1,S2 | No vendor memory authority; provider independence is a product invariant. | high | None material |
| Native Cortaix | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S1 | Stage 12 targets low–medium latency; live vault-scale soak not measured — conservative 3. | medium | p95 at scale unknown |
| Native Cortaix | canonical Cortaix memory core | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S1 | Engineering-dominant cost acknowledged; no vendor memory fees — mid score because eng is non-trivial. | medium | Exact eng-months unknown |
| Native Cortaix | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S1,S2 | In-repo design track mature; production Stage 8–12 incomplete — maturity of *architecture* is high, delivery mid-high → 4. | high | Delivery schedule unknown |
| **Weighted total** | | | | **100** | **91.4** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Mem0 OSS` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Mem0 OSS | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S3,S4 | OSS memory engine owns its own records/summaries/API; cannot be Cortaix canonical truth without violating G1. | high | How teams misuse as authority |
| Mem0 OSS | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S4,S20 | Self-host improves control vs managed, but engine still processes raw memory text and lacks Cortaix disclosure axes. | medium | Isolation without Gateway |
| Mem0 OSS | canonical Cortaix memory core | Data ownership and portability | 2 | 12 | 4.8 | S3,S4 | Data can stay on operator infra; schema is Mem0’s, not Cortaix assertions — portability of *Cortaix semantics* is weak. | medium | Export of full provenance |
| Mem0 OSS | canonical Cortaix memory core | Retrieval and temporal capability | 3 | 12 | 7.2 | S4,S20 | Documented search/add/delete; not WRRF×policy or conflict-safe packing. | medium | Score transparency |
| Mem0 OSS | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S4,S21 | Python-first engine + optional REST; not native to current Next.js dependency tree [S21]. | high | Worker topology |
| Mem0 OSS | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S4 | Self-host implies vector/LLM/history components to operate [S4]. | medium | On-call cost |
| Mem0 OSS | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S3,S4 | Apache-2.0 and swappable components documented [S4]; still a memory product abstraction. | high | — |
| Mem0 OSS | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S4 | No Cortaix-measured latency; defaults depend on chosen embed/LLM — estimate mid. | low | p95 |
| Mem0 OSS | canonical Cortaix memory core | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S3 | No SaaS fee; ops+model costs remain — mid. | medium | Eng hours |
| Mem0 OSS | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S3 | Large community/repo Apache-2.0 [S3]. | high | — |
| **Weighted total** | | | | **100** | **43.6** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Mem0 managed` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Mem0 managed | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S5,S6 | Managed platform is a complete memory API; fails as canonical core (G1/G8). | high | Co-authority misuse |
| Mem0 managed | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S5,S6 | Vendor processes memory/query text; operator access inherent; disclosure cannot be assumed. | medium | Tenant isolation proof |
| Mem0 managed | canonical Cortaix memory core | Data ownership and portability | 1 | 12 | 2.4 | S5,S6 | Customer data in vendor store; export/purge attestation unknown. | medium | Purge attestation |
| Mem0 managed | canonical Cortaix memory core | Retrieval and temporal capability | 4 | 12 | 9.6 | S6 | v3 hybrid search documented with scores/filters [S6] — strong retrieval *product*, wrong ownership for core. | high | Rerank internals |
| Mem0 managed | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 3 | 10 | 6.0 | S6,S21 | HTTP API usable from TS [S6]; still external critical path. | high | — |
| Mem0 managed | canonical Cortaix memory core | Operational reliability and observability | 4 | 8 | 6.4 | S5 | Managed ops shift burden to vendor — higher ops score as *service*, not as Cortaix control. | medium | SLA details |
| Mem0 managed | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S6 | Not an agent runtime; embed model pin unknown. | medium | Embed pin |
| Mem0 managed | canonical Cortaix memory core | Performance and latency potential | 4 | 5 | 4.0 | S5,S6 | Vendor claims low latency — not independently measured here → conservative 4 from API maturity not proof. | low | True p95 |
| Mem0 managed | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S5 | Public plans exist but M/L search rates exceed Pro → TCO poor/unknown as core. | medium | Enterprise price |
| Mem0 managed | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S3,S5 | Widely used commercial product + OSS sibling [S3][S5]. | high | — |
| **Weighted total** | | | | **100** | **45.2** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Graphiti OSS` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Graphiti OSS | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S7,S1 | Temporal graph engine requires external graph DB; Stage 11 rejects required graph DB for v1; cannot be canonical assertion store. | high | — |
| Graphiti OSS | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S7 | Self-host possible; LLM extraction of facts from text creates disclosure exposure. | medium | Namespace enforcement |
| Graphiti OSS | canonical Cortaix memory core | Data ownership and portability | 2 | 12 | 4.8 | S7 | Graph lives in Neo4j/FalkorDB/etc.; not Cortaix assertion schema. | high | Export tooling |
| Graphiti OSS | canonical Cortaix memory core | Retrieval and temporal capability | 5 | 12 | 12.0 | S7,S8 | Temporal validity, hybrid retrieval, episodes — strongest temporal/graph retrieval among OSS candidates [S7][S8]. | high | Cortaix ID mapping |
| Graphiti OSS | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S7,S21 | Python + graph DB — poor fit for in-process Next.js [S7][S21]. | high | — |
| Graphiti OSS | canonical Cortaix memory core | Operational reliability and observability | 1 | 8 | 1.6 | S7 | Requires graph DB + LLM workers — high ops. | high | On-call |
| Graphiti OSS | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S7 | Multiple LLM providers supported as extras [S7]; defaults OpenAI. | high | — |
| Graphiti OSS | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S7 | Vendor/README performance claims not measured here → 3. | low | Latency soak |
| Graphiti OSS | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S7 | Infra+LLM cost non-trivial; no SaaS fee. | medium | Exact infra $ |
| Graphiti OSS | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S7 | Active Apache-2.0 project [S7]. | high | — |
| **Weighted total** | | | | **100** | **43.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Zep managed` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Zep managed | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S9,S9a | Managed context/memory platform; prompt-oriented `memory.get` conflicts with Stage 12 packing ownership [S9a]. | high | — |
| Zep managed | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S9 | Vendor-hosted personal context; isolation/purge not independently evidenced. | medium | Isolation proof |
| Zep managed | canonical Cortaix memory core | Data ownership and portability | 1 | 12 | 2.4 | S9 | Data in vendor Context Lake; exit completeness unknown. | medium | Export/purge |
| Zep managed | canonical Cortaix memory core | Retrieval and temporal capability | 5 | 12 | 12.0 | S8,S9 | Temporal graph retrieval is product center [S8][S9] — high retrieval score, wrong authority. | medium | Credit↔byte formula |
| Zep managed | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S9 | SDKs exist; not native PG-canonical design. | medium | — |
| Zep managed | canonical Cortaix memory core | Operational reliability and observability | 4 | 8 | 6.4 | S9 | Managed service reduces self-host ops. | medium | SLA |
| Zep managed | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S9 | Framework-agnostic claims; still vendor platform. | medium | Embed pin |
| Zep managed | canonical Cortaix memory core | Performance and latency potential | 4 | 5 | 4.0 | S8,S9 | Paper/vendor latency claims not reproduced → 4 conservative from product focus not measurement. | low | p95 |
| Zep managed | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S9 | Credit pricing public but burn formula unresolved → weak TCO as core. | low | credits_per_episode |
| Zep managed | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S8,S9 | Commercial maturity medium-high. | medium | — |
| **Weighted total** | | | | **100** | **45.0** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Cognee OSS` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Cognee OSS | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S10 | Positions as AI memory platform with graph/vector — competing authority model, not Cortaix core. | high | — |
| Cognee OSS | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S10 | Self-host improves residency; still ingests raw content into its memory layer. | medium | Tenant model |
| Cognee OSS | canonical Cortaix memory core | Data ownership and portability | 2 | 12 | 4.8 | S10 | Can run on Postgres [S10] but owns memory semantics/pipelines. | medium | Cortaix mapping |
| Cognee OSS | canonical Cortaix memory core | Retrieval and temporal capability | 4 | 12 | 9.6 | S10 | Graph+vector search documented; not Stage 12 WRRF/conflict packing. | medium | Score semantics |
| Cognee OSS | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S10,S21 | Python engine; TS client only [S10][S21]. | high | — |
| Cognee OSS | canonical Cortaix memory core | Operational reliability and observability | 1 | 8 | 1.6 | S10 | Docker/graph/vector components to operate. | medium | Ops hours |
| Cognee OSS | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S10 | Multiple backends documented. | medium | — |
| Cognee OSS | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S10 | CI Postgres search claim in README — not independently measured → 3. | low | Latency |
| Cognee OSS | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S10 | Self-host cost non-zero. | medium | — |
| Cognee OSS | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S10 | Active Apache-2.0 [S10]. | high | — |
| **Weighted total** | | | | **100** | **40.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Cognee managed` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Cognee managed | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S11 | Cloud memory service — fails G1 as core. | medium | SLA |
| Cognee managed | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S11 | Vendor processes tokens/content; isolation details thin in public pricing page. | low | Isolation |
| Cognee managed | canonical Cortaix memory core | Data ownership and portability | 1 | 12 | 2.4 | S11 | Hosted data; purge/export attestation unknown. | low | Export |
| Cognee managed | canonical Cortaix memory core | Retrieval and temporal capability | 4 | 12 | 9.6 | S11,S11a | Product is retrieval/memory oriented; details thinner than Graphiti paper trail → 4 not 5. | medium | API ID stability |
| Cognee managed | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S11 | Python/cloud oriented; weak Next native fit. | medium | — |
| Cognee managed | canonical Cortaix memory core | Operational reliability and observability | 3 | 8 | 4.8 | S11 | Managed reduces self-host burden. | medium | — |
| Cognee managed | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S11 | Claims BYO cloud on enterprise — not verified here. | low | Embed pin |
| Cognee managed | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S11 | No independent latency evidence → 3. | unverified | p95 |
| Cognee managed | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S11 | Token price known; tokens/write unknown → weak TCO. | low | tokens_per_write |
| Cognee managed | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 3 | 3 | 1.8 | S11 | Younger commercial motion than Mem0/Zep — 3. | medium | — |
| **Weighted total** | | | | **100** | **37.4** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Letta OSS` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Letta OSS | canonical Cortaix memory core | Architecture compatibility | 0 | 20 | 0.0 | S12,S13 | Agent runtime/harness — not a pluggable canonical store for Cortaix Next app; architecture mismatch extreme → 0. | high | — |
| Letta OSS | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S12 | Agent self-edits memory tiers conflict with Stages 8–10 unless fully subordinated — poor governance fit. | high | — |
| Letta OSS | canonical Cortaix memory core | Data ownership and portability | 1 | 12 | 2.4 | S12 | Agent state model ≠ Cortaix assertions. | high | Export of tiers |
| Letta OSS | canonical Cortaix memory core | Retrieval and temporal capability | 2 | 12 | 4.8 | S12 | Memory tiers exist but retrieval is agent-tool oriented, not WRRF packing. | medium | — |
| Letta OSS | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S12,S21 | Separate runtime; TS Agent SDK exists but product is still Letta agents [S12]. | high | — |
| Letta OSS | canonical Cortaix memory core | Operational reliability and observability | 1 | 8 | 1.6 | S12 | Running agents/servers adds ops. | medium | — |
| Letta OSS | canonical Cortaix memory core | Vendor and model independence | 0 | 7 | 0.0 | S12 | Locks product to Letta agent loop — G9 fail → 0 independence. | high | — |
| Letta OSS | canonical Cortaix memory core | Performance and latency potential | 2 | 5 | 2.0 | S12 | Unknown for Cortaix workload → 2. | low | — |
| Letta OSS | canonical Cortaix memory core | Twelve-month total cost of ownership | 1 | 5 | 1.0 | S12 | Would fork product direction — poor TCO. | medium | — |
| Letta OSS | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S12 | Apache-2.0, known project [S12]. | high | — |
| **Weighted total** | | | | **100** | **19.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Letta managed` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Letta managed | canonical Cortaix memory core | Architecture compatibility | 0 | 20 | 0.0 | S12,S13 | Same runtime capture as OSS, hosted. | high | — |
| Letta managed | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S13 | Vendor-hosted agent state. | medium | Isolation |
| Letta managed | canonical Cortaix memory core | Data ownership and portability | 1 | 12 | 2.4 | S13 | Exit from agent platform unclear. | low | Export |
| Letta managed | canonical Cortaix memory core | Retrieval and temporal capability | 2 | 12 | 4.8 | S13 | Same agent-memory model. | medium | — |
| Letta managed | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S13 | Cloud SDK path still Letta-centric. | medium | — |
| Letta managed | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S13 | Managed slightly better than self-host ops. | medium | — |
| Letta managed | canonical Cortaix memory core | Vendor and model independence | 0 | 7 | 0.0 | S13 | Runtime lock remains. | high | — |
| Letta managed | canonical Cortaix memory core | Performance and latency potential | 2 | 5 | 2.0 | S13 | Unmeasured → 2. | low | — |
| Letta managed | canonical Cortaix memory core | Twelve-month total cost of ownership | 1 | 5 | 1.0 | S13 | Hosted agent fees unknown + rewrite cost. | low | Pricing |
| Letta managed | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 3 | 3 | 1.8 | S13 | Commercial docs exist; less relevant. | medium | — |
| **Weighted total** | | | | **100** | **20.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `LangGraph/LangMem` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| LangGraph/LangMem | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S14 | Memory SDK/tools for LangGraph — not Cortaix canonical store. | high | — |
| LangGraph/LangMem | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S14 | Hot-path agent memory tools can bypass Gateway if misused. | medium | Tool write paths |
| LangGraph/LangMem | canonical Cortaix memory core | Data ownership and portability | 2 | 12 | 4.8 | S14 | BYO store possible [S14] but semantics are LangMem’s items. | medium | — |
| LangGraph/LangMem | canonical Cortaix memory core | Retrieval and temporal capability | 2 | 12 | 4.8 | S14 | Search/manage tools; no Stage 12 fusion. | medium | — |
| LangGraph/LangMem | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S14,S21 | Python; not in current stack [S21]. | high | — |
| LangGraph/LangMem | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S14 | Needs LangGraph deployment assumptions. | medium | — |
| LangGraph/LangMem | canonical Cortaix memory core | Vendor and model independence | 1 | 7 | 1.4 | S14 | Tied to LangChain/LangGraph ecosystem → low independence as core. | high | — |
| LangGraph/LangMem | canonical Cortaix memory core | Performance and latency potential | 2 | 5 | 2.0 | S14 | Unmeasured → 2. | low | — |
| LangGraph/LangMem | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S14 | OSS MIT reduces license fee; eng integration cost remains. | medium | — |
| LangGraph/LangMem | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S14 | MIT, maintained [S14]. | high | — |
| **Weighted total** | | | | **100** | **33.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Supermemory OSS` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Supermemory OSS | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S15 | OSS memory/context engine — competing core, fails G1/G8 as authority. | high | Feature parity vs managed |
| Supermemory OSS | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S15 | Self-host improves residency; still a memory engine over content. | medium | Isolation model |
| Supermemory OSS | canonical Cortaix memory core | Data ownership and portability | 3 | 12 | 7.2 | S15 | MIT self-host can keep bytes local — better ownership than managed, still not Cortaix schema. | medium | Export |
| Supermemory OSS | canonical Cortaix memory core | Retrieval and temporal capability | 3 | 12 | 7.2 | S15 | Hybrid search claimed in README; methodology not audited here → 3. | low | Benchmark validity |
| Supermemory OSS | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 3 | 10 | 6.0 | S15,S21 | TypeScript-oriented monorepo — better stack affinity than Python engines [S15]. | high | — |
| Supermemory OSS | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S15 | Self-host ops non-trivial despite ‘one binary’ marketing. | medium | Ops |
| Supermemory OSS | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S15 | MIT; model choice claimed — not fully verified. | medium | Embed pin |
| Supermemory OSS | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S15 | Vendor latency marketing not measured → 3. | low | p95 |
| Supermemory OSS | canonical Cortaix memory core | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S15 | No SaaS fee if truly self-hosted. | medium | — |
| Supermemory OSS | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S15 | Active MIT repo [S15]. | high | — |
| **Weighted total** | | | | **100** | **47.4** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Supermemory managed` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Supermemory managed | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S15a | Managed memory API — fails as canonical core. | high | — |
| Supermemory managed | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S15a | Vendor processes memories/documents; soft-forget semantics [S15a]. | medium | Isolation |
| Supermemory managed | canonical Cortaix memory core | Data ownership and portability | 1 | 12 | 2.4 | S15a | Hosted; reset/forget APIs exist; attestation unknown. | medium | Purge proof |
| Supermemory managed | canonical Cortaix memory core | Retrieval and temporal capability | 4 | 12 | 9.6 | S15a | Search/profile/hybrid APIs documented — strong product retrieval, wrong authority. | medium | Profile injection risk |
| Supermemory managed | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 3 | 10 | 6.0 | S15a | TS/Python SDKs; HTTP fits Next but externalizes memory. | high | — |
| Supermemory managed | canonical Cortaix memory core | Operational reliability and observability | 3 | 8 | 4.8 | S15a | Managed ops mid. | medium | — |
| Supermemory managed | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S15a | Not an agent runtime lock. | medium | Embed pin |
| Supermemory managed | canonical Cortaix memory core | Performance and latency potential | 4 | 5 | 4.0 | S15,S15a | Sub-300ms marketing — not reproduced → 4 from API design not proof. | low | p95 |
| Supermemory managed | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S15a | Fixed plan prices known; SM-token map to Cortaix turns unresolved → weak. | low | SM tokens/turn |
| Supermemory managed | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S15 | Active commercial+OSS [S15]. | high | — |
| **Weighted total** | | | | **100** | **43.0** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `LlamaIndex` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| LlamaIndex | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S16,S17 | Agent Memory blocks merge into prompt context — not Cortaix canonical core [S16]. | high | — |
| LlamaIndex | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S16 | Framework may insert memory into system/user messages — conflicts with untrusted rendering if used as core. | medium | Default insert_method risk |
| LlamaIndex | canonical Cortaix memory core | Data ownership and portability | 3 | 12 | 7.2 | S16 | BYO vector stores possible — better than closed SaaS, still framework-owned memory object. | medium | — |
| LlamaIndex | canonical Cortaix memory core | Retrieval and temporal capability | 3 | 12 | 7.2 | S16 | Vector/fact blocks are retrieval utilities, not WRRF packing. | medium | — |
| LlamaIndex | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S16,S21 | Python-first; TS memory module exists but stack still framework-centric [S16][S21]. | high | — |
| LlamaIndex | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S16 | Depends on chosen stores/LLMs. | medium | — |
| LlamaIndex | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S17 | MIT; multiple stores/models — decent independence for a framework. | high | — |
| LlamaIndex | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S16 | Unmeasured in Cortaix → 3. | low | — |
| LlamaIndex | canonical Cortaix memory core | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S17 | OSS; eng cost to absorb framework as core is high conceptually — mid. | medium | — |
| LlamaIndex | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S17 | Large MIT project [S17]. | high | — |
| **Weighted total** | | | | **100** | **44.0** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Memobase` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Memobase | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S18 | User-profile long-term memory engine — alternative core, fails G1. | medium | Product boundaries |
| Memobase | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S18 | Limited public evidence on disclosure controls in this audit. | low | Isolation |
| Memobase | canonical Cortaix memory core | Data ownership and portability | 2 | 12 | 4.8 | S18 | Apache-2.0 self-host possible; Cortaix mapping unknown. | low | Export |
| Memobase | canonical Cortaix memory core | Retrieval and temporal capability | 3 | 12 | 7.2 | S18 | Profile memory retrieval — not Stage 12. | low | API |
| Memobase | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S18,S21 | Python [S18]. | high | — |
| Memobase | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S18 | Self-host ops. | low | — |
| Memobase | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S18 | OSS license helps independence. | medium | — |
| Memobase | canonical Cortaix memory core | Performance and latency potential | 2 | 5 | 2.0 | S18 | No measurements → 2. | unverified | Latency |
| Memobase | canonical Cortaix memory core | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S18 | Unknown pricing if managed sibling used; OSS ops cost. | low | — |
| Memobase | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 3 | 3 | 1.8 | S18 | Smaller community than Mem0/Graphiti — 3. | medium | Roadmap |
| **Weighted total** | | | | **100** | **38.4** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `HippoRAG` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| HippoRAG | canonical Cortaix memory core | Architecture compatibility | 1 | 20 | 4.0 | S19,S25 | Research RAG framework — not a personal memory core product. | high | — |
| HippoRAG | canonical Cortaix memory core | Security, privacy, and governance | 2 | 18 | 7.2 | S19 | Offline research code; no Cortaix governance model. | medium | — |
| HippoRAG | canonical Cortaix memory core | Data ownership and portability | 3 | 12 | 7.2 | S19 | MIT code can be studied; not a vault store. | high | — |
| HippoRAG | canonical Cortaix memory core | Retrieval and temporal capability | 4 | 12 | 9.6 | S19,S25 | PPR-over-KG retrieval is relevant research signal → 4 for retrieval *ideas*, still not Stage 12. | medium | Transfer to Stage 12 |
| HippoRAG | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 1 | 10 | 2.0 | S19,S21 | Python research stack. | high | — |
| HippoRAG | canonical Cortaix memory core | Operational reliability and observability | 1 | 8 | 1.6 | S19 | Not a managed ops product — low production ops score. | medium | — |
| HippoRAG | canonical Cortaix memory core | Vendor and model independence | 4 | 7 | 5.6 | S19 | Academic MIT — high independence as research. | high | — |
| HippoRAG | canonical Cortaix memory core | Performance and latency potential | 2 | 5 | 2.0 | S19 | Paper benches not Cortaix workloads → 2. | low | — |
| HippoRAG | canonical Cortaix memory core | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S19 | No SaaS; research eng only. | medium | — |
| HippoRAG | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S19,S25 | NeurIPS-lineage research [S25]. | high | — |
| **Weighted total** | | | | **100** | **44.6** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Reranker APIs` / `canonical Cortaix memory core`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Reranker APIs | canonical Cortaix memory core | Architecture compatibility | 0 | 20 | 0.0 | S1 | Not a memory store — cannot be canonical core → architecture 0. | high | — |
| Reranker APIs | canonical Cortaix memory core | Security, privacy, and governance | 1 | 18 | 3.6 | S1 | Would only see query+snippets; as *core* it provides no governance plane → 1. | medium | Retention of snippets |
| Reranker APIs | canonical Cortaix memory core | Data ownership and portability | 2 | 12 | 4.8 | S1 | Stateless; no ownership of vault — 2 as core (irrelevant). | medium | — |
| Reranker APIs | canonical Cortaix memory core | Retrieval and temporal capability | 2 | 12 | 4.8 | S1 | Rerank ≠ memory retrieval system → 2. | high | — |
| Reranker APIs | canonical Cortaix memory core | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 3 | 10 | 6.0 | S21 | HTTP fits Next → 3 even in wrong role. | high | — |
| Reranker APIs | canonical Cortaix memory core | Operational reliability and observability | 2 | 8 | 3.2 | S1 | Stateless dependency → 2 as core. | medium | — |
| Reranker APIs | canonical Cortaix memory core | Vendor and model independence | 3 | 7 | 4.2 | S1 | Vendor-swappable function → 3. | high | — |
| Reranker APIs | canonical Cortaix memory core | Performance and latency potential | 3 | 5 | 3.0 | S1 | Typically low latency add-on → 3 estimate. | low | p95 |
| Reranker APIs | canonical Cortaix memory core | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S1 | Usage fees usually bounded → 3 estimate. | low | $/1k |
| Reranker APIs | canonical Cortaix memory core | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S1 | Mature API category → 4. | medium | Which vendor |
| **Weighted total** | | | | **100** | **35.0** | | Recomputes as Σ((score/5)×weight) | | |

---

## 9. Role-specific adapter scorecards (with score evidence)

Adapter summary leaders (PoC-gated where noted): ExternalIndex Mem0 OSS **63.6**; Projection Graphiti **63.8**; Reranker **63.8**; Connector Supermemory managed **54.2**; Documents native **82.4**; Extraction native **79.8**.

#### Score evidence — `Mem0 OSS` / `ExternalMemoryIndexPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Mem0 OSS | ExternalMemoryIndexPort | Architecture compatibility | 3 | 20 | 12.0 | S2,S3,S6 | Can sit behind ExternalMemoryIndexPort if ID-only+reconcile; still a full memory engine so not 5. | medium | Remote-text regressions |
| Mem0 OSS | ExternalMemoryIndexPort | Security, privacy, and governance | 3 | 18 | 10.8 | S2,S6 | Disclosure can deny calls; current code lacks gates — score assumes future adapter discipline [S2]. | medium | Purpose matrix gaps |
| Mem0 OSS | ExternalMemoryIndexPort | Data ownership and portability | 3 | 12 | 7.2 | S2,S3 | Derived index rebuildable from PG if mapping maintained. | medium | Mapping completeness |
| Mem0 OSS | ExternalMemoryIndexPort | Retrieval and temporal capability | 3 | 12 | 7.2 | S6 | Search returns scored memories; usable as channel ranks if text ignored [S6]. | medium | Score calibration |
| Mem0 OSS | ExternalMemoryIndexPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 3 | 10 | 6.0 | S6,S21 | HTTP from TS works; OSS engine Python if self-hosting full stack. | medium | Which deploy mode |
| Mem0 OSS | ExternalMemoryIndexPort | Operational reliability and observability | 3 | 8 | 4.8 | S2,S6 | Optional channel with timeouts feasible; self-host adds ops. | medium | — |
| Mem0 OSS | ExternalMemoryIndexPort | Vendor and model independence | 4 | 7 | 5.6 | S3 | Apache-2.0; replaceable behind port. | medium | — |
| Mem0 OSS | ExternalMemoryIndexPort | Performance and latency potential | 3 | 5 | 3.0 | S6 | Unknown vs PG channel — mid. | medium | p95 |
| Mem0 OSS | ExternalMemoryIndexPort | Twelve-month total cost of ownership | 4 | 5 | 4.0 | S5 | OSS avoids SaaS; model costs remain — relatively good if optional. | medium | Call rate vs plans |
| Mem0 OSS | ExternalMemoryIndexPort | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S3 | Strong ecosystem [S3]. | high | — |
| **Weighted total** | | | | **100** | **63.6** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Mem0 managed` / `ExternalMemoryIndexPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Mem0 managed | ExternalMemoryIndexPort | Architecture compatibility | 2 | 20 | 8.0 | S5,S6 | Same port possible; managed data boundary weaker than OSS → arch 2. | medium | Authority creep |
| Mem0 managed | ExternalMemoryIndexPort | Security, privacy, and governance | 2 | 18 | 7.2 | S5,S6 | Vendor sees approved text; sensitive workloads often deny → sec 2. | medium | Isolation proof |
| Mem0 managed | ExternalMemoryIndexPort | Data ownership and portability | 2 | 12 | 4.8 | S5,S6 | Vendor retention/export unknowns lower ownership. | medium | Purge |
| Mem0 managed | ExternalMemoryIndexPort | Retrieval and temporal capability | 4 | 12 | 9.6 | S6 | Strong managed retrieval API [S6]. | medium | — |
| Mem0 managed | ExternalMemoryIndexPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 4 | 10 | 8.0 | S6 | Simple HTTP from Next [S6]. | medium | — |
| Mem0 managed | ExternalMemoryIndexPort | Operational reliability and observability | 4 | 8 | 6.4 | S5 | Vendor operates index. | medium | SLA |
| Mem0 managed | ExternalMemoryIndexPort | Vendor and model independence | 3 | 7 | 4.2 | S6 | Replaceable but exit friction. | medium | Embed pin |
| Mem0 managed | ExternalMemoryIndexPort | Performance and latency potential | 4 | 5 | 4.0 | S5 | Vendor latency claims — not measured → 4 cautious. | medium | p95 |
| Mem0 managed | ExternalMemoryIndexPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S5 | S@100% search exceeds Starter; M/L exceed Pro — mid TCO. | medium | Overage $ |
| Mem0 managed | ExternalMemoryIndexPort | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S3,S5 | Mature commercial offering. | medium | — |
| **Weighted total** | | | | **100** | **58.2** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Supermemory managed` / `ExternalMemoryIndexPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Supermemory managed | ExternalMemoryIndexPort | Architecture compatibility | 2 | 20 | 8.0 | S15a | Could mirror index role but product pushes profiles/prompt context — weaker port fit than Mem0 ID discipline. | medium | Profile always-on risk |
| Supermemory managed | ExternalMemoryIndexPort | Security, privacy, and governance | 2 | 18 | 7.2 | S15a | Hosted processing; soft-forget. | medium | Isolation |
| Supermemory managed | ExternalMemoryIndexPort | Data ownership and portability | 2 | 12 | 4.8 | S15a | Hosted ownership weaker. | medium | Purge |
| Supermemory managed | ExternalMemoryIndexPort | Retrieval and temporal capability | 4 | 12 | 9.6 | S15a | Documented hybrid search. | medium | — |
| Supermemory managed | ExternalMemoryIndexPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 4 | 10 | 8.0 | S15a | TS SDK fit. | medium | — |
| Supermemory managed | ExternalMemoryIndexPort | Operational reliability and observability | 3 | 8 | 4.8 | S15a | Managed mid. | medium | — |
| Supermemory managed | ExternalMemoryIndexPort | Vendor and model independence | 3 | 7 | 4.2 | S15a | Swappable in theory. | medium | — |
| Supermemory managed | ExternalMemoryIndexPort | Performance and latency potential | 4 | 5 | 4.0 | S15a | Marketing latency — unmeasured. | medium | p95 |
| Supermemory managed | ExternalMemoryIndexPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S15a | SM-token map unknown — mid. | low | SM tokens |
| Supermemory managed | ExternalMemoryIndexPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S15 | Active vendor. | high | — |
| **Weighted total** | | | | **100** | **56.0** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Cognee OSS` / `ExternalMemoryIndexPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Cognee OSS | ExternalMemoryIndexPort | Architecture compatibility | 2 | 20 | 8.0 | S10 | Possible derived index but engine wants broader memory ownership. | medium | Port narrowness |
| Cognee OSS | ExternalMemoryIndexPort | Security, privacy, and governance | 2 | 18 | 7.2 | S10 | Self-host; disclosure still required. | medium | — |
| Cognee OSS | ExternalMemoryIndexPort | Data ownership and portability | 2 | 12 | 4.8 | S10 | Rebuildable if treated derived. | medium | Mapping |
| Cognee OSS | ExternalMemoryIndexPort | Retrieval and temporal capability | 3 | 12 | 7.2 | S10 | Search exists; less evidence for ID-only mode. | medium | ID-only API |
| Cognee OSS | ExternalMemoryIndexPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S10,S21 | Python barrier. | medium | — |
| Cognee OSS | ExternalMemoryIndexPort | Operational reliability and observability | 2 | 8 | 3.2 | S10 | Self-host ops. | medium | — |
| Cognee OSS | ExternalMemoryIndexPort | Vendor and model independence | 3 | 7 | 4.2 | S10 | Apache-2.0. | medium | — |
| Cognee OSS | ExternalMemoryIndexPort | Performance and latency potential | 3 | 5 | 3.0 | S10 | Unmeasured. | medium | — |
| Cognee OSS | ExternalMemoryIndexPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S10 | No SaaS fee. | medium | — |
| Cognee OSS | ExternalMemoryIndexPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S10 | Active OSS. | medium | — |
| **Weighted total** | | | | **100** | **47.0** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Graphiti OSS` / `RelationshipProjectionPort/EntityProjectionPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Architecture compatibility | 3 | 20 | 12.0 | S1,S7 | Fits derived projection if edges never grant truth and rebuild from assertions [S1][S7]. | high | Truth leakage |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Security, privacy, and governance | 3 | 18 | 10.8 | S7 | Disclosure before LLM/embed; user namespacing required. | medium | Namespace bugs |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Data ownership and portability | 3 | 12 | 7.2 | S7 | Graph disposable if mapped. | medium | Export |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Retrieval and temporal capability | 5 | 12 | 12.0 | S7,S8 | Best temporal graph capability in set [S7][S8]. | high | Hop-cap enforcement |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S7,S21 | Python+Neo4j/Falkor — weak serverless fit. | high | — |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Operational reliability and observability | 2 | 8 | 3.2 | S7 | Graph DB ops required. | high | On-call |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Vendor and model independence | 4 | 7 | 5.6 | S7 | Multi-provider extras [S7]. | high | — |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Performance and latency potential | 3 | 5 | 3.0 | S7 | Unmeasured in Cortaix → 3. | low | Latency |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S7 | Infra+LLM cost; optional only. | medium | $ |
| Graphiti OSS | RelationshipProjectionPort/EntityProjectionPort | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S7 | Strong OSS [S7]. | high | — |
| **Weighted total** | | | | **100** | **63.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Cognee OSS` / `RelationshipProjectionPort/EntityProjectionPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Architecture compatibility | 3 | 20 | 12.0 | S10 | Postgres-graph option interesting for derived projection [S10]; still broad memory product. | medium | Overlap with Stage 11 native |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Security, privacy, and governance | 3 | 18 | 10.8 | S10 | Self-host disclosure needed. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Data ownership and portability | 3 | 12 | 7.2 | S10 | Rebuildable if derived. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Retrieval and temporal capability | 4 | 12 | 9.6 | S10 | Graph+vector strong but less temporal-paper evidence than Graphiti. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S10 | Python. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Operational reliability and observability | 2 | 8 | 3.2 | S10 | Ops. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Vendor and model independence | 4 | 7 | 5.6 | S10 | Backends swappable. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Performance and latency potential | 3 | 5 | 3.0 | S10 | Unmeasured. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S10 | Self-host. | medium | — |
| Cognee OSS | RelationshipProjectionPort/EntityProjectionPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S10 | Active. | medium | — |
| **Weighted total** | | | | **100** | **60.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Zep managed` / `RelationshipProjectionPort/EntityProjectionPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Architecture compatibility | 2 | 20 | 8.0 | S9,S9a | Managed graph could be derived projection but prompt-context APIs encourage wrong integration [S9a]. | medium | Prompt-context misuse |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Security, privacy, and governance | 2 | 18 | 7.2 | S9 | Vendor-hosted graph. | medium | Isolation |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Data ownership and portability | 2 | 12 | 4.8 | S9 | Exit unknown. | medium | Export |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Retrieval and temporal capability | 5 | 12 | 12.0 | S8,S9 | Strong temporal retrieval claims [S8]. | medium | credits_per_episode |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 3 | 10 | 6.0 | S9 | SDK fit mid. | medium | — |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Operational reliability and observability | 4 | 8 | 6.4 | S9 | Managed ops high. | medium | — |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Vendor and model independence | 3 | 7 | 4.2 | S9 | Vendor platform. | medium | — |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Performance and latency potential | 4 | 5 | 4.0 | S8 | Unreproduced claims → 4. | medium | — |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Twelve-month total cost of ownership | 2 | 5 | 2.0 | S9 | Credits unresolved → weak. | low | Burn rate |
| Zep managed | RelationshipProjectionPort/EntityProjectionPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S9 | Commercial. | medium | — |
| **Weighted total** | | | | **100** | **57.0** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Reranker APIs (unnamed)` / `RetrievalReranker`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Reranker APIs (unnamed) | RetrievalReranker | Architecture compatibility | 3 | 20 | 12.0 | S1 | Optional post-fusion reorder matches Stage 12 RetrievalReranker port; cannot own eligibility. | high | Provider not selected |
| Reranker APIs (unnamed) | RetrievalReranker | Security, privacy, and governance | 2 | 18 | 7.2 | S1 | Query+candidate text may leave Cortaix — disclosure required; retention unknown until vendor pinned. | low | Snippet retention |
| Reranker APIs (unnamed) | RetrievalReranker | Data ownership and portability | 4 | 12 | 9.6 | S1 | Stateless; no vault ownership — good portability. | high | — |
| Reranker APIs (unnamed) | RetrievalReranker | Retrieval and temporal capability | 3 | 12 | 7.2 | S1 | Improves ranking potentially; not a retrieval system itself → 3. | medium | Quality delta |
| Reranker APIs (unnamed) | RetrievalReranker | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 4 | 10 | 8.0 | S21 | HTTP from Next is natural [S21]. | high | — |
| Reranker APIs (unnamed) | RetrievalReranker | Operational reliability and observability | 3 | 8 | 4.8 | S1 | Must noop on failure. | medium | — |
| Reranker APIs (unnamed) | RetrievalReranker | Vendor and model independence | 4 | 7 | 5.6 | S1 | Vendor-swappable. | high | — |
| Reranker APIs (unnamed) | RetrievalReranker | Performance and latency potential | 4 | 5 | 4.0 | S1 | Usually low added latency — estimate 4 pre-measurement. | low | p95 budget |
| Reranker APIs (unnamed) | RetrievalReranker | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S1 | Usage fees typically bounded — estimate 3 until vendor pinned. | low | $/turn |
| Reranker APIs (unnamed) | RetrievalReranker | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S1 | Mature API category. | medium | Which vendor |
| **Weighted total** | | | | **100** | **63.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Supermemory managed` / `ConnectorIngestionPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Supermemory managed | ConnectorIngestionPort | Architecture compatibility | 3 | 20 | 12.0 | S15a | Connectors documented as sync into Supermemory — acceptable only if outputs become untrusted Gateway intake [S15a]. | medium | Write-authority creep |
| Supermemory managed | ConnectorIngestionPort | Security, privacy, and governance | 2 | 18 | 7.2 | S15a | OAuth to Gmail/Drive/etc. expands blast radius. | medium | OAuth scope |
| Supermemory managed | ConnectorIngestionPort | Data ownership and portability | 2 | 12 | 4.8 | S15a | Mirrored objects vendor-side. | medium | Purge mirrored docs |
| Supermemory managed | ConnectorIngestionPort | Retrieval and temporal capability | 2 | 12 | 4.8 | S15a | Connector value is ingestion not retrieval → retr 2. | medium | — |
| Supermemory managed | ConnectorIngestionPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 4 | 10 | 8.0 | S15a | HTTP/API fit good. | high | — |
| Supermemory managed | ConnectorIngestionPort | Operational reliability and observability | 3 | 8 | 4.8 | S15a | Vendor runs sync. | medium | — |
| Supermemory managed | ConnectorIngestionPort | Vendor and model independence | 3 | 7 | 4.2 | S15a | Replaceable later. | medium | — |
| Supermemory managed | ConnectorIngestionPort | Performance and latency potential | 3 | 5 | 3.0 | S15a | Freshness unmeasured → 3. | low | Sync lag |
| Supermemory managed | ConnectorIngestionPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S15a | Plan fees known; usage map unknown → 3. | low | SM tokens |
| Supermemory managed | ConnectorIngestionPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S15 | Documented connector surface [S15a]. | high | — |
| **Weighted total** | | | | **100** | **54.2** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Native document pipeline` / `DocumentSearchPort/document tooling`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Native document pipeline | DocumentSearchPort/document tooling | Architecture compatibility | 4 | 20 | 16.0 | S2 | Existing upload/chunk/embed/match_document_chunks under Cortaix control [S2]. | high | ready-status filter gaps |
| Native document pipeline | DocumentSearchPort/document tooling | Security, privacy, and governance | 4 | 18 | 14.4 | S2 | RLS-backed documents/chunks; disclosure still incomplete vs Stage 12. | high | Doc disclosure flags |
| Native document pipeline | DocumentSearchPort/document tooling | Data ownership and portability | 5 | 12 | 12.0 | S2 | Canonical in PG/Storage refs. | high | — |
| Native document pipeline | DocumentSearchPort/document tooling | Retrieval and temporal capability | 3 | 12 | 7.2 | S2 | Basic vector chunk retrieval — not full Stage 12 doc channel yet → 3. | high | Hybrid doc channel |
| Native document pipeline | DocumentSearchPort/document tooling | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 5 | 10 | 10.0 | S2,S21 | Already in stack. | high | — |
| Native document pipeline | DocumentSearchPort/document tooling | Operational reliability and observability | 4 | 8 | 6.4 | S2 | Understood local ops. | high | — |
| Native document pipeline | DocumentSearchPort/document tooling | Vendor and model independence | 5 | 7 | 7.0 | S2 | No doc-framework lock. | high | — |
| Native document pipeline | DocumentSearchPort/document tooling | Performance and latency potential | 3 | 5 | 3.0 | S2 | Unmeasured at scale → 3. | medium | Throughput |
| Native document pipeline | DocumentSearchPort/document tooling | Twelve-month total cost of ownership | 4 | 5 | 4.0 | S2 | No extra vendor doc platform fee. | high | — |
| Native document pipeline | DocumentSearchPort/document tooling | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S2 | Adequate for current product stage. | medium | — |
| **Weighted total** | | | | **100** | **82.4** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `LlamaIndex document components` / `DocumentSearchPort/document tooling`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| LlamaIndex document components | DocumentSearchPort/document tooling | Architecture compatibility | 3 | 20 | 12.0 | S16,S17 | Rich readers/parsers could assist document tooling; not selected as package yet — score if narrowly reused. | medium | Which module |
| LlamaIndex document components | DocumentSearchPort/document tooling | Security, privacy, and governance | 3 | 18 | 10.8 | S16 | Must not auto-inject as trusted system text. | medium | Injection defaults |
| LlamaIndex document components | DocumentSearchPort/document tooling | Data ownership and portability | 4 | 12 | 9.6 | S16 | BYO stores help ownership. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Retrieval and temporal capability | 4 | 12 | 9.6 | S16 | Strong RAG retrieval utilities [S16]. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S16,S21 | Python-heavy for current app. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Operational reliability and observability | 3 | 8 | 4.8 | S16 | Adds framework ops. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Vendor and model independence | 4 | 7 | 5.6 | S17 | MIT components swappable. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Performance and latency potential | 3 | 5 | 3.0 | S16 | Unmeasured. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Twelve-month total cost of ownership | 4 | 5 | 4.0 | S17 | OSS. | medium | — |
| LlamaIndex document components | DocumentSearchPort/document tooling | Maturity, maintenance, community, licensing | 5 | 3 | 3.0 | S17 | Very mature [S17]. | medium | — |
| **Weighted total** | | | | **100** | **66.4** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `Native LLM extraction assist` / `ExtractionAssistPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Native LLM extraction assist | ExtractionAssistPort | Architecture compatibility | 4 | 20 | 16.0 | S1,S2 | Stage 10 extraction assist via Gateway/LLM already aligns; heuristic/LLM paths exist [S2]. | high | Uniform secret gate |
| Native LLM extraction assist | ExtractionAssistPort | Security, privacy, and governance | 4 | 18 | 14.4 | S1,S2 | Secret gates designed; not uniformly applied on all paths today. | medium | — |
| Native LLM extraction assist | ExtractionAssistPort | Data ownership and portability | 5 | 12 | 12.0 | S1 | Proposals land in Cortaix store. | high | — |
| Native LLM extraction assist | ExtractionAssistPort | Retrieval and temporal capability | 3 | 12 | 7.2 | S1 | Extraction ≠ retrieval quality — mid. | medium | — |
| Native LLM extraction assist | ExtractionAssistPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 5 | 10 | 10.0 | S2,S21 | Fits TS routes. | high | — |
| Native LLM extraction assist | ExtractionAssistPort | Operational reliability and observability | 3 | 8 | 4.8 | S1 | Currently often request-path; workers designed. | medium | Outbox |
| Native LLM extraction assist | ExtractionAssistPort | Vendor and model independence | 5 | 7 | 7.0 | S1 | Model-agnostic via inference layer. | high | — |
| Native LLM extraction assist | ExtractionAssistPort | Performance and latency potential | 3 | 5 | 3.0 | S2 | Timeout paths exist — mid. | medium | — |
| Native LLM extraction assist | ExtractionAssistPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S2 | Model tokens dominate — mid. | medium | Token $ |
| Native LLM extraction assist | ExtractionAssistPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S2 | Adequate. | medium | — |
| **Weighted total** | | | | **100** | **79.8** | | Recomputes as Σ((score/5)×weight) | | |

#### Score evidence — `LangMem primitives` / `ExtractionAssistPort`

| Candidate | Role | Category | Score | Weight | Contribution | Sources | Reason | Confidence | Unknowns |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| LangMem primitives | ExtractionAssistPort | Architecture compatibility | 2 | 20 | 8.0 | S14 | Background memory manager ideas only; hot-path tools risky for Gateway. | medium | Misuse as writer |
| LangMem primitives | ExtractionAssistPort | Security, privacy, and governance | 2 | 18 | 7.2 | S14 | Agent-managed memory conflicts with Stage 10 if used directly. | medium | — |
| LangMem primitives | ExtractionAssistPort | Data ownership and portability | 3 | 12 | 7.2 | S14 | BYO store helps. | medium | — |
| LangMem primitives | ExtractionAssistPort | Retrieval and temporal capability | 2 | 12 | 4.8 | S14 | Not a retrieval port. | medium | — |
| LangMem primitives | ExtractionAssistPort | Integration fit (Next.js/TS/Supabase/PG/Vercel) | 2 | 10 | 4.0 | S14,S21 | Python. | medium | — |
| LangMem primitives | ExtractionAssistPort | Operational reliability and observability | 2 | 8 | 3.2 | S14 | LangGraph assumptions. | medium | — |
| LangMem primitives | ExtractionAssistPort | Vendor and model independence | 2 | 7 | 2.8 | S14 | Ecosystem tie. | medium | — |
| LangMem primitives | ExtractionAssistPort | Performance and latency potential | 2 | 5 | 2.0 | S14 | Unmeasured. | medium | — |
| LangMem primitives | ExtractionAssistPort | Twelve-month total cost of ownership | 3 | 5 | 3.0 | S14 | OSS. | medium | — |
| LangMem primitives | ExtractionAssistPort | Maturity, maintenance, community, licensing | 4 | 3 | 2.4 | S14 | MIT maintained. | medium | — |
| **Weighted total** | | | | **100** | **44.6** | | Recomputes as Σ((score/5)×weight) | | |

---

## 10. Material-claim ledgers and evidence completeness

Definition reminder: adjudicated positive **and** negative facts count. Implementation readiness is §4.3, not this percentage.

### 10.1 Native Cortaix — material-claim ledger

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | PostgreSQL/Supabase stores `memories` with RLS own-row policies | true | S2 | yes | high | yes |
| N2 | pgvector `vector(1536)` and `match_memories` RPC exist | true | S2 | yes | high | yes |
| N3 | Stage 12 WRRF×policy packing is specified in docs | true | S1 | yes | high | yes |
| N4 | Stage 12 WRRF×policy packing is implemented in production TypeScript | false | S2 | yes | high | yes |
| N5 | Query disclosure service is implemented | false | S2 | yes | high | yes |
| N6 | Deletion Coordinator is implemented | false | S2 | yes | high | yes |
| N7 | Current Mem0 provider can return remote text without `cv_memory_id` | true | S2 | yes | high | yes |
| N8 | package.json has no mem0/langchain/llamaindex dependencies | true | S21 | yes | high | yes |
| N9 | Local deterministic embedding provider exists | true | S2 | yes | high | yes |
| N10 | Full Stage 8–12 assertion/entity schema is shipped in migrations | false | S2 | yes | high | yes |

**evidenceCompletenessPercent = 10/10 × 100 = 100%**

### 10.2 Mem0 OSS

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| MO1 | Repository license is Apache-2.0 at pinned commit | true | S3 | yes | high | yes |
| MO2 | OSS provides Python library and/or self-hosted REST server | true | S4,S20 | yes | high | yes |
| MO3 | Default components include LLM, embedder, vector store, history store | true | S4 | yes | high | yes |
| MO4 | OSS REST exposes create/search/update/delete memory endpoints | true | S20 | yes | high | yes |
| MO5 | Mem0 OSS implements Cortaix WRRF×policy fusion | false | S1,S4 | yes | high | yes |
| MO6 | Mem0 OSS guarantees remote text cannot become Cortaix authority without adapter bugs | false | S2,S4 | yes | medium | yes |
| MO7 | Customer-verifiable purge attestation SLA is published for OSS self-host | unknown | — | no | unverified | no |
| MO8 | Node/TypeScript client paths are documented for Mem0 | true | S4 | yes | medium | yes |
| MO9 | Full OSS engine runs inside Vercel serverless request handlers without workers | false | S4,S21 | yes | medium | yes |
| MO10 | Server-side user isolation is sufficient without Cortaix Gateway enforcement | unknown | S20 | no | unverified | no |

**evidenceCompletenessPercent = 8/10 × 100 = 80%**

### 10.3 Mem0 managed

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| MM1 | Public Hobby/Starter/Pro/Enterprise plans list add and retrieval monthly caps | true | S5 | yes | medium | yes |
| MM2 | v3 search requires entity ids inside `filters` | true | S6 | yes | high | yes |
| MM3 | v3 search describes hybrid semantic+BM25+entity fusion | true | S6 | yes | medium | yes |
| MM4 | Platform delete and delete_all APIs are documented | true | S6 | yes | high | yes |
| MM5 | Customer-verifiable purge attestation SLA is published | unknown | — | no | unverified | no |
| MM6 | Customer can pin embedding provider/model/dimensions on Platform | unknown | — | no | unverified | no |
| MM7 | Managed operator access to customer memory is contractually impossible | unknown | — | no | unverified | no |
| MM8 | Export returns complete Cortaix-equivalent provenance/history | unknown | — | no | unverified | no |
| MM9 | Graph memory is included on Pro plan per pricing page | true | S5 | yes | medium | yes |
| MM10 | Enterprise price schedule is publicly listed | false | S5 | yes | high | yes |

**evidenceCompletenessPercent = 6/10 × 100 = 60%**

### 10.4 Graphiti OSS

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | License Apache-2.0 at pinned commit | true | S7 | yes | high | yes |
| G2 | Requires Python ≥3.10 | true | S7 | yes | high | yes |
| G3 | Supports Neo4j/FalkorDB/Neptune; Kuzu deprecated | true | S7 | yes | high | yes |
| G4 | Models temporal validity and edge invalidation | true | S7,S8 | yes | high | yes |
| G5 | Defaults to OpenAI for LLM and embeddings | true | S7 | yes | high | yes |
| G6 | Hybrid semantic+BM25+graph retrieval documented | true | S7 | yes | high | yes |
| G7 | Sub-200ms retrieval at scale is independently measured for Cortaix | false | S7 | yes | medium | yes |
| G8 | Cortaix Stage 11 requires a dedicated graph DB for v1 | false | S1 | yes | high | yes |
| G9 | Built-in stable mapping to Cortaix assertion IDs exists | false | S7 | yes | medium | yes |
| G10 | Production purge confirmation API for Cortaix deletion coordinator is documented | unknown | S7 | no | unverified | no |

**evidenceCompletenessPercent = 9/10 × 100 = 90%**

### 10.5 Zep managed

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| Z1 | Zep offers managed temporal/context graph memory product | true | S9 | yes | medium | yes |
| Z2 | Flex/Flex Plus/Enterprise credit pricing is published | true | S9 | yes | medium | yes |
| Z3 | Quickstart `memory.get` returns prompt-oriented context string | true | S9a | yes | medium | yes |
| Z4 | Multi-language SDKs are marketed | true | S9 | yes | medium | yes |
| Z5 | arXiv paper reports DMR and LongMemEval results | true | S8 | yes | medium | yes |
| Z6 | Those benchmark results were independently reproduced in Stage 13 | false | S8 | yes | high | yes |
| Z7 | Official docs define credits_per_episode as a public closed-form for all episode types | unknown | S9 | no | unverified | no |
| Z8 | Verified deletion/purge attestation for customers is published | unknown | — | no | unverified | no |
| Z9 | Customer-controlled embedding space pin is documented | unknown | — | no | unverified | no |
| Z10 | Enterprise fee schedule is public | false | S9 | yes | high | yes |

**evidenceCompletenessPercent = 7/10 × 100 = 70%**

### 10.6 Cognee OSS

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| CO1 | License Apache-2.0 at pinned commit | true | S10 | yes | high | yes |
| CO2 | Primary engine is Python | true | S10 | yes | high | yes |
| CO3 | README documents Postgres-backed graph+vector mode | true | S10 | yes | high | yes |
| CO4 | Docker images/compose are documented | true | S10 | yes | high | yes |
| CO5 | Official TypeScript client package is referenced | true | S10 | yes | medium | yes |
| CO6 | Cognee OSS implements Stage 12 WRRF packing | false | S1,S10 | yes | high | yes |
| CO7 | Stable Cortaix assertion ID mapping is built-in | unknown | — | no | unverified | no |
| CO8 | Purge attestation compatible with Cortaix deletion coordinator is documented | unknown | — | no | unverified | no |
| CO9 | README cites arXiv:2505.24478 | true | S10 | yes | high | yes |
| CO10 | arXiv:2505.24478 methodology was fully read and reproduced here | false | S23 | yes | high | yes |

**evidenceCompletenessPercent = 8/10 × 100 = 80%**

### 10.7 Cognee managed

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| CM1 | Pricing page lists Free and Standard $2.50/1M tokens + workspace fees | true | S11 | yes | medium | yes |
| CM2 | Enterprise/BYO cloud is offered via contact | true | S11 | yes | medium | yes |
| CM3 | Public docs prove enforceable tenant isolation equivalent to Cortaix RLS | unknown | S11,S11a | no | unverified | no |
| CM4 | Purge attestation SLA is published | unknown | — | no | unverified | no |
| CM5 | Customer pin of embedding space is documented | unknown | — | no | unverified | no |
| CM6 | tokens_per_memory_write is published | false | S11 | yes | high | yes |
| CM7 | Can be used without becoming canonical authority if strictly adapted | conditional | S1,S11 | yes | medium | yes |
| CM8 | TypeScript-only production path without Python is documented for Cloud | unknown | S11 | no | unverified | no |
| CM9 | Export completeness for Cortaix rebuild is documented | unknown | — | no | unverified | no |
| CM10 | Cloud model identity on pricing page is a marketing claim not independently verified here | true | S11 | yes | medium | yes |

**evidenceCompletenessPercent = 5/10 × 100 = 50%**

### 10.8 Letta OSS

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| LO1 | License Apache-2.0 at pinned commit | true | S12 | yes | high | yes |
| LO2 | Product is a stateful agent runtime/harness | true | S12,S13 | yes | high | yes |
| LO3 | Agents can hold and self-edit memory tiers inside the runtime | true | S12,S13 | yes | medium | yes |
| LO4 | Letta is a drop-in ExternalMemoryIndexPort without agent runtime adoption | false | S12,S1 | yes | high | yes |
| LO5 | Preserves Cortaix provider independence if adopted as core runtime | false | S12 | yes | high | yes |
| LO6 | TS Agent SDK exists | true | S12 | yes | high | yes |
| LO7 | Export of Letta agent memory equals Cortaix assertion export | unknown | — | no | unverified | no |
| LO8 | Purge semantics for Cortaix deletion coordinator are documented | unknown | — | no | unverified | no |

**evidenceCompletenessPercent = 6/8 × 100 = 75%**

### 10.9 Letta managed

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| LM1 | Managed/cloud hosting path is documented | true | S13 | yes | medium | yes |
| LM2 | Still centers stateful agents rather than PG-canonical personal vaults | true | S13 | yes | high | yes |
| LM3 | Public enterprise purge attestation for Cortaix-class deletion | unknown | — | no | unverified | no |
| LM4 | Public price schedule fully enumerated for all tiers | unknown | S13 | no | unverified | no |
| LM5 | Can satisfy G9 while locking to Letta runtime | false | S12,S13 | yes | high | yes |
| LM6 | Independent reproduction of Letta memory quality on Cortaix golden set | false | — | no | unverified | no |
| LM7 | TS SDK can talk to cloud backend | true | S12 | yes | high | yes |
| LM8 | Hosted operator access posture is fully evidenced in this audit | unknown | — | no | unverified | no |

**evidenceCompletenessPercent = 4/8 × 100 = 50%**

### 10.10 LangGraph / LangMem

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| LL1 | LangMem license MIT at pinned commit | true | S14 | yes | high | yes |
| LL2 | Provides memory tools and background memory manager | true | S14 | yes | high | yes |
| LL3 | Integrates with LangGraph store | true | S14 | yes | high | yes |
| LL4 | Hot-path tools can let agents write memory during conversation | true | S14 | yes | medium | yes |
| LL5 | Implements Cortaix WRRF packing | false | S1,S14 | yes | high | yes |
| LL6 | Primary implementation language is Python | true | S14 | yes | high | yes |
| LL7 | Can be used without LangGraph at all with zero integration cost in Cortaix | false | S14 | yes | medium | yes |
| LL8 | Production purge/export story for Cortaix is documented | unknown | — | no | unverified | no |

**evidenceCompletenessPercent = 7/8 × 100 = 88%**

### 10.11 Supermemory OSS

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| SO1 | License MIT at pinned commit | true | S15 | yes | high | yes |
| SO2 | README claims self-host / local binary options | true | S15 | yes | medium | yes |
| SO3 | TypeScript-oriented repository | true | S15 | yes | high | yes |
| SO4 | OSS automatically includes all managed connectors | unknown | S15,S15a | no | unverified | no |
| SO5 | OSS search returns only canonical Cortaix IDs by default | unknown | S15 | no | unverified | no |
| SO6 | Implements Stage 12 conflict-safe packing | false | S1,S15 | yes | high | yes |
| SO7 | Deletion/export parity with managed is documented | unknown | S15 | no | unverified | no |
| SO8 | Benchmark #1 claims appear in README at pinned commit | true | S15,S24 | yes | high | yes |
| SO9 | Those benchmarks were reproduced in Stage 13 | false | S24 | yes | high | yes |
| SO10 | Can serve as canonical Cortaix core without G1 failure | false | S1,S15 | yes | high | yes |
| SO11 | Embed model pin controls for OSS are fully documented in this audit | unknown | S15 | no | unverified | no |

**evidenceCompletenessPercent = 7/11 × 100 = 64%**

### 10.12 Supermemory managed

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| SM1 | Pricing page lists Free/Pro/Max/Scale plan prices and SM-token rate card | true | S15a | yes | medium | yes |
| SM2 | Connectors for Drive/Notion/Gmail/GitHub-class sources are documented | true | S15a | yes | medium | yes |
| SM3 | Forget/soft-delete APIs are documented | true | S15a | yes | medium | yes |
| SM4 | Container tags support multi-tenant partitioning | true | S15a | yes | medium | yes |
| SM5 | Purge attestation SLA is published | unknown | — | no | unverified | no |
| SM6 | Mapping from Cortaix turn to SM tokens is published | false | S15a | yes | high | yes |
| SM7 | Profile APIs may return prompt-ready user context | true | S15a | yes | medium | yes |
| SM8 | Safe as canonical Cortaix core | false | S1,S15a | yes | high | yes |
| SM9 | Operator access impossible | unknown | — | no | unverified | no |
| SM10 | Benchmark crowns independently reproduced here | false | S24 | yes | high | yes |
| SM11 | Exact OpenAPI version used in production is pinned in this audit | unknown | S15a | no | unverified | no |

**evidenceCompletenessPercent = 8/11 × 100 = 73%**

### 10.13 LlamaIndex

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| LI1 | License MIT at pinned commit | true | S17 | yes | high | yes |
| LI2 | Memory module documents Static/FactExtraction/Vector memory blocks | true | S16 | yes | high | yes |
| LI3 | Memory retrieval merges blocks into LLM context under token limits | true | S16 | yes | high | yes |
| LI4 | Default insert paths may place memory into system or user messages | true | S16 | yes | medium | yes |
| LI5 | Implements Cortaix WRRF×policy | false | S1,S16 | yes | high | yes |
| LI6 | Python framework is primary; TS memory docs also exist | true | S16 | yes | high | yes |
| LI7 | Suitable as sole canonical personal-memory authority for Cortaix | false | S1,S16 | yes | high | yes |
| LI8 | Specific reader/node-parser package is selected for Cortaix in this stage | false | S16 | yes | high | yes |
| LI9 | BYO vector store is supported in vector memory block docs | true | S16 | yes | high | yes |
| LI10 | Cortaix production dependency on LlamaIndex exists today | false | S21 | yes | high | yes |

**evidenceCompletenessPercent = 10/10 × 100 = 100%**

### 10.14 Memobase

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| MB1 | License Apache-2.0 at pinned commit | true | S18 | yes | high | yes |
| MB2 | Described as user-profile long-term memory for chatbots | true | S18 | yes | medium | yes |
| MB3 | Primary language Python | true | S18 | yes | high | yes |
| MB4 | Documents Cortaix-compatible ID-only ExternalMemoryIndexPort | unknown | S18 | no | unverified | no |
| MB5 | Implements Stage 12 packing | false | S1,S18 | yes | high | yes |
| MB6 | Purge/export attestation evidenced in this audit | unknown | — | no | unverified | no |
| MB7 | Last push metadata indicates lower recent activity than Mem0/Graphiti | true | S18 | yes | medium | yes |
| MB8 | Safe as Cortaix canonical core | false | S1,S18 | yes | high | yes |
| MB9 | Next.js in-process support without Python | false | S18,S21 | yes | medium | yes |
| MB10 | Managed pricing fully audited here | unknown | — | no | unverified | no |

**evidenceCompletenessPercent = 7/10 × 100 = 70%**

### 10.15 HippoRAG

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| HR1 | License MIT at pinned commit | true | S19 | yes | high | yes |
| HR2 | Research RAG using knowledge graph + Personalized PageRank | true | S19,S25 | yes | high | yes |
| HR3 | NeurIPS’24-lineage paper exists | true | S25 | yes | high | yes |
| HR4 | Is a managed personal-memory SaaS | false | S19 | yes | high | yes |
| HR5 | Methodology fully re-run on Cortaix data in Stage 13 | false | S19,S25 | yes | high | yes |
| HR6 | Can replace Stage 12 fusion as product dependency | false | S1 | yes | high | yes |
| HR7 | Useful as retrieval-research inspiration | true | S19,S25 | yes | medium | yes |
| HR8 | Production purge/export story for Cortaix | not_applicable | S19 | yes | high | yes |
| HR9 | Python research codebase | true | S19 | yes | high | yes |
| HR10 | Independent production SLA exists | false | S19 | yes | high | yes |

**evidenceCompletenessPercent = 10/10 × 100 = 100%**

### 10.16 Reranker API category

| claim_id | material_claim | truth_value_or_outcome | source_ids | source_supports_claim | confidence | adjudicated |
| --- | --- | --- | --- | --- | --- | --- |
| RR1 | Stage 12 defines optional RetrievalReranker with noop default | true | S1 | yes | high | yes |
| RR2 | A specific vendor/model/version is selected in Stage 13 | false | S1 | yes | high | yes |
| RR3 | Rerankers are a complete memory platform | false | S1 | yes | high | yes |
| RR4 | HTTP rerank APIs can fit Next.js server routes | true | S21 | yes | high | yes |
| RR5 | Candidate snippet retention posture is known for the selected vendor | unknown | — | no | unverified | no |
| RR6 | Pricing for the selected vendor is pinned | unknown | — | no | unverified | no |
| RR7 | Rerank can change eligibility if mis-integrated | true | S1 | yes | high | yes |
| RR8 | Correct Stage 12 use forbids eligibility/disclosure changes by rerank | true | S1 | yes | high | yes |

**evidenceCompletenessPercent = 6/8 × 100 = 75%**

### 10.17 Evidence-completeness summary (from visible ledgers)

| Candidate | Adjudicated / Total | evidenceCompletenessPercent |
| --- | --- | ---: |
| Native Cortaix | see §10.1 | **100%** |
| Mem0 OSS | see §10.2 | **80%** |
| Mem0 managed | see §10.3 | **60%** |
| Graphiti OSS | see §10.4 | **90%** |
| Zep managed | see §10.5 | **70%** |
| Cognee OSS | see §10.6 | **80%** |
| Cognee managed | see §10.7 | **50%** |
| Letta OSS | see §10.8 | **75%** |
| Letta managed | see §10.9 | **50%** |
| LangGraph/LangMem | see §10.10 | **88%** |
| Supermemory OSS | see §10.11 | **64%** |
| Supermemory managed | see §10.12 | **73%** |
| LlamaIndex | see §10.13 | **100%** |
| Memobase | see §10.14 | **70%** |
| HippoRAG | see §10.15 | **100%** |
| Reranker APIs | see §10.16 | **75%** |

Native note: **100% evidence completeness** means all listed claims are adjudicated (including supported negatives N4–N6,N10). It does **not** mean Stage 8–12 are implemented. See §4.3 for implementation readiness.

---

## 11. Port contracts

Ten-point contracts unchanged in substance from prior revision for:

1. Mem0 → `ExternalMemoryIndexPort`  
2. Graphiti → `RelationshipProjectionPort` / `EntityProjectionPort`  
3. Reranker → `RetrievalReranker`  
4. Supermemory managed → `ConnectorIngestionPort` (watchlist/PoC-D)  
5. LlamaIndex document tooling → watchlist, no package selected  
6. Cognee → watchlist; port must be named before any future PoC  

---

## 12. Cost and TCO scenarios

### 12.1 Workload derivation

| Assumption | S | M | L | Confidence |
| --- | --- | --- | --- | --- |
| MAU | 1,000 | 10,000 | 100,000 | planning |
| Turns / user / month | 20–40 | 30–60 | 40–80 | low |
| Writes / turn | 0.2–0.6 | 0.3–0.8 | 0.4–1.0 | low |
| Embedding ops / turn | 1–3 | 2–5 | 3–8 | low |
| Extraction fraction of writes | **0.5** | **0.5** | **0.5** | low |

**Monthly turns**

```text
S: 1,000 × 20–40 = 20,000–40,000
M: 10,000 × 30–60 = 300,000–600,000
L: 100,000 × 40–80 = 4,000,000–8,000,000
```

**Monthly memory writes**

```text
S: 4,000–24,000
M: 90,000–480,000
L: 1,600,000–8,000,000
```

**Monthly LLM extraction calls** (`extraction_calls = 0.5 × memory_writes`):

```text
S: 2,000–12,000 / month
M: 45,000–240,000 / month
L: 800,000–4,000,000 / month
```

**External searches** at 0/25/50/100% of turns — unchanged table from prior revision (S @ 100% = 20,000–40,000 searches).

**Graph episodes (illustrative, low confidence):** 0.5–1.0 × writes → S 2,000–24,000; M 45,000–480,000; L 800,000–8,000,000.

**Stored vectors after 12 months (no churn, low confidence):** S 48k–288k; M 1.08M–5.76M; L 19.2M–96M.

### 12.1.1 Document chunks — explicit planning assumptions

Planning estimates only (**confidence: low**):

| Parameter | Low | High |
| --- | ---: | ---: |
| Documents uploaded / active user / month | 0.05 | 0.5 |
| Average chunks / document | 5 | 40 |
| Twelve-month retention | 100% of uploaded | 100% |

```text
S users contributing docs ≈ 1,000
S docs/year = 1,000 × 0.05×12 … 1,000 × 0.5×12 = 600–6,000
S chunks/year = 600×5 … 6,000×40 = 3,000–240,000

M: docs/year = 10,000×0.6 … 10,000×6 = 6,000–60,000
M chunks/year = 30,000–2,400,000

L: docs/year = 100,000×0.6 … 100,000×6 = 60,000–600,000
L chunks/year = 300,000–24,000,000
```

These figures are **not** used to claim vendor document TCO fits a specific plan. Vendor document-cost comparison remains incomplete where usage units do not map cleanly.

### 12.2 Mem0 public pricing [S5]

Starter 5,000 retrievals/mo; Pro 50,000. **S @ 100% search = 20,000–40,000 retrievals → exceeds Starter; may fit Pro depending on exact turns.** M/L at nontrivial search rates exceed Pro → overage/enterprise **unknown**.

### 12.3 Zep credits [S9]

**Do not assume `1 credit ≅ 1 episode`.** No official closed-form `credits_per_episode` was verified in retrieved pricing materials.

```text
monthly_credits =
  episodes
  × credits_per_episode(bytes, operations, retrieval)
```

Because `credits_per_episode(...)` is **unknown**, Zep monthly vendor fees are **unresolved** at every scenario. Flex 50k / Flex Plus 200k included credits are published list allowances only [S9].

### 12.4 Cognee sensitivity [S11]

Published: **$2.50 / 1,000,000 tokens** + $5/workspace (Standard).

Illustrative bands (**not measured**; confidence **low**):

| Band | tokens_per_memory_write | tokens_per_document |
| --- | ---: | ---: |
| Low | 500 | 5,000 |
| Mid | 2,000 | 20,000 |
| High | 8,000 | 80,000 |

Example using writes only (documents omitted):

```text
monthly_processed_tokens ≈ memory_writes × tokens_per_memory_write
monthly_fee ≈ monthly_processed_tokens / 1e6 × 2.50 + workspace_charges
```

| Scenario | Writes | Mid tokens (×2000) | Mid fee @ $2.50/1M |
| --- | --- | --- | --- |
| S | 4k–24k | 8M–48M | ~$20–$120 + workspaces |
| M | 90k–480k | 180M–960M | ~$450–$2,400 + workspaces |
| L | 1.6M–8M | 3.2B–16B | ~$8,000–$40,000 + workspaces |

L-scale still **omits** model fees, infra, and document tokens. Treat as illustrative sensitivity only.

### 12.5 Supermemory [S15a]

Documented usage units: **SM tokens** (memory plain/rich), SuperRAG SM tokens, **search & traversal per 1K queries**, **operations per 1K** (rerank/aggregation/query rewrite), plus fixed plan included balances ($0 / $19 / $100 / $399 list).

Mapping Cortaix turns → SM tokens requires content-length assumptions **not fixed**. Therefore:

- Confirmed: list plan prices and rate card existence [S15a].  
- **Unresolved:** usage cost at S/M/L.  
- Do **not** treat plan price alone as scenario TCO.

### 12.6 Native-only monthly buckets

Vendor memory $0; model/DB/infra/eng ranges unchanged from prior revision (low confidence eng estimates).

---

## 13. Benchmark evidence review

| Field | Mem0 memory-benchmarks | Zep DMR (via S8) | Zep LongMemEval (via S8) | Supermemory #1 claims | Cognee arXiv 2505.24478 | HippoRAG |
| --- | --- | --- | --- | --- | --- | --- |
| Benchmark name | Mem0 evaluation suite | DMR | LongMemEval | LongMemEval/LoCoMo/ConvoMem crowns | KG↔LLM interface paper | HippoRAG |
| Source ID | **S22** | **S8**, **S27** | **S8**, **S26** | **S24** (+ S26/S28/S29 links) | **S23** (README cite only in S10) | **S19**, **S25** |
| Dataset | unknown without full methodology read | DMR (MemGPT-associated) | LongMemEval | as claimed in README | paper-specific | paper/repo |
| Task | memory-augmented LLM eval (repo description) | deep memory retrieval | long-term temporal QA | memory benches | complex reasoning interface | multi-hop RAG |
| Memory input size | unknown | unknown | unknown | unknown | unknown | unknown |
| Retrieval method | unknown here | Zep/Graphiti (paper) | Zep (paper) | unknown here | cognee (paper) | PPR over KG |
| Answer model | unknown | unknown | unknown | unknown | unknown | unknown |
| Metric | unknown here | accuracy % | accuracy/latency claims | Recall@k / #1 rank claims | paper metrics | paper metrics |
| Reported result | suite exists; numbers not audited | 94.8% vs 93.4% (paper) | up to +18.5% / −90% latency (paper) | #1 + 95% Recall@15 claim (README) | paper results | paper results |
| Baselines | unknown here | MemGPT | paper | unknown | paper | paper |
| claim_location_found | yes (repo S22) | yes (S8) | yes (S8) | yes (S24 lines ~32–39, ~375–379) | yes (S23; S10 is citation only) | yes (S19/S25) |
| methodology_read | **no** (full suite not read) | **partial** (paper abstract/body retrieved; not re-implemented) | **partial** | **no** beyond README claims | **no** full methodology deep-read | **partial** at repo level; paper not fully read |
| code_found | yes S22 | no (product); paper only | upstream dataset S26 | unknown for SM harness | paper/code unknown here | yes S19 |
| dataset_found | unknown | unknown | yes upstream S26 | upstream links only | unknown | unknown |
| environment_reproducible | unknown | no | unknown | unknown | unknown | unknown |
| actually_reproduced | **no** | **no** | **no** | **no** | **no** | **no** |
| Preprocessing latency included | unknown | unknown | unknown | unknown | unknown | unknown |
| Extraction/indexing token cost included | unknown | unknown | unknown | unknown | unknown | unknown |
| Relevance to Cortaix | low–medium | low | medium temporal QA only | low until independent | low–medium | medium ideas |
| Limitations | not selected on | vendor paper | vendor paper | marketing crown | different problem | not a product memory layer |
| Label | vendor-reported; code available; **not reproduced** | paper-reported; **not reproduced** | paper-reported; **not reproduced** | vendor-reported; **not reproduced** | paper-reported; **not reproduced** | paper-reported; **not reproduced** |

Do not merge into one leaderboard.

---

## 14. Supermemory OSS vs managed

Separated as before: MIT self-host vs hosted ToS/pricing/connectors; do not transfer managed connectors to OSS without evidence; both fail as canonical core; managed best watchlist role = ConnectorIngestionPort; evidence % from §10.11–10.12.

---

## 15. Build-versus-reuse decomposition

Unchanged decisions: native for assertion/trust/fusion/packing; Mem0/Graphiti/rerank/connectors PoC-gated or watchlist; no graph DB required for v1.

---

## 16. Proof-of-concept specifications

PoCs are **not implemented** here.

### 16.1 PoC-A — Mem0 as ExternalMemoryIndexPort

| Field | Spec |
| --- | --- |
| Hypothesis | ID-only Mem0 channel improves recall without text authority |
| Exact port | ExternalMemoryIndexPort |
| Candidate/version | Platform API v3 and/or OSS pinned to `d6d89c98…` [S3][S6] |
| Dataset | ≥200 assertions + paraphrases + expirations + deletes |
| Golden queries | ≥30 Stage-12-like queries |
| Security cases | secret queries; highly_sensitive evidence |
| Cross-user test | user A never retrieves user B mapped hits |
| Query-disclosure test | denied purpose → zero external calls |
| Evidence-disclosure test | `allow_external_index_disclosure=false` never sent |
| Deletion test | delete assertion → mapping gone + remote miss |
| Purge test | user delete → delete_all + empty search |
| Outage test | 5xx/timeout → native-only success |
| Canonical-reconciliation test | unmapped hits discarded; zero remote-text packs |
| Latency measures | p50/p95 external vs PG |
| Quality metric | recall@k and nDCG vs native-only baseline |
| Cost measure | add+search counts vs [S5] units |
| Exit/rebuild test | wipe vendor; rebuild from PG |
| Success criteria | all security/disclosure/reconcile/outage pass |
| Failure criteria | unmapped text packed; isolation miss; mandatory dependency |
| Max eng time budget | ≤5 engineer-days |
| Decision produced | pass → may become `adopt_as_optional_adapter`; fail → disable |

### 16.2 PoC-B — Graphiti derived projection

| Field | Spec |
| --- | --- |
| Hypothesis | Temporal graph projections improve relationship/entity channels without granting truth |
| Exact port | `RelationshipProjectionPort` (and `EntityProjectionPort` if enabled in the same spike) |
| Candidate/version | `graphiti-core` at commit `3bb2d0bb…` [S7]; backend FalkorDB **or** Neo4j 5.26 as documented |
| Dataset | ≥100 assertion-backed entities/relationships including corrections, invalidations, and non-supporting hard negatives |
| Golden queries | ≥25 relationship/entity-focused queries; include 0-hop and 1-hop cases; forbid friend-of-friend |
| Security cases | highly_sensitive assertions must not be projected when disclosure denies |
| Cross-user test | user A graph namespace never returns user B nodes/edges |
| Query-disclosure test | denied external embed/LLM projection purpose → zero Graphiti calls |
| Evidence-disclosure test | assertions with `allow_external_index_disclosure=false` (or projection-equivalent deny) never leave Cortaix |
| Deletion test | delete supporting assertion → projected edge suppressed on next retrieve |
| Purge test | delete user → user subgraph absent; searches empty |
| Outage test | graph DB/LLM down → native channels succeed; graph channel skipped |
| Canonical-reconciliation test | graph-only facts without supporting eligible assertions never become eligible/packed |
| Latency measures | p50/p95 graph channel add + search; compare to native entity SQL baseline |
| Quality metric | **relationship-query recall@k and nDCG@k** on the golden set vs **native Stage 11 SQL/zero-hop baseline** (no Graphiti) |
| Cost measure | LLM extraction tokens + graph DB hours + engineer time for the spike |
| Exit/rebuild test | drop graph DB; rebuild from PostgreSQL assertions; quality within tolerance of pre-drop |
| Success criteria | rebuildable; edge≠truth; hop caps enforced; purge/cross-user/disclosure pass; quality ≥ baseline on ≥ agreed slice without trust leakage |
| Failure criteria | graph influences trust/eligibility; required dependency; disclosure bypass; cross-user leak |
| Max eng time budget | ≤8 engineer-days including ops standup |
| Decision produced | pass → optional adapter candidate; fail → native SQL projection only |

### 16.3 PoC-C — RetrievalReranker

| Field | Spec |
| --- | --- |
| Hypothesis | HTTP rerank improves ranking quality without breaking eligibility or disclosure |
| Exact port | `RetrievalReranker` |
| Candidate/version | **Not selected in Stage 13.** Before execution, Stage 15 must name and pin one provider, model/version, pricing source, and data-retention posture. |
| Dataset | Same retrieval golden set as Stage 15 core eval (≥30 queries) |
| Golden queries | Same as native retrieval golden set |
| Security cases | snippets from highly_sensitive/forbidden classes never sent when denied |
| Cross-user test | rerank batch contains only candidate IDs already scoped to the requesting user |
| Query-disclosure test | purpose `reranker` denied → identity noop; zero egress |
| Evidence-disclosure test | evidence denied for external rerank → omitted from payload or entire rerank skipped |
| Deletion test | `not_applicable` — stateless rerank holds no corpus; deleted candidates must already be absent from input list |
| Purge test | `not_applicable` — no retained memory corpus at reranker; verify provider retention policy documented before enablement |
| Outage test | timeout/5xx → identity ordering; request succeeds |
| Canonical-reconciliation test | output permutation references only input candidateIds; no new text authority |
| Latency measures | max added p50 ≤ 50ms and p95 ≤ 150ms over baseline (budget proposal; Stage 15 may tighten) |
| Quality metric | nDCG@k / recall@k vs **baseline WRRF×policy order** (noop rerank) |
| Cost measure | max cost per reranked turn from pinned price list; abort if exceeds Stage 15 cap |
| Exit/rebuild test | disable flag → immediate noop; no data migration |
| Whether candidate text leaves Cortaix | **Yes, if snippets are sent** — only disclosure-approved text; prefer ID+minimal fields |
| Provider retention assumptions | Unknown until vendor pinned; must be recorded before enablement |
| Baseline ordering | Stage 12 Final score order before rerank |
| Success criteria | no eligibility/disclosure regression; quality improves on agreed slice **or** neutral with no regressions; budgets held |
| Failure criteria | promotes ineligible; egress on deny; correctness requires rerank; budgets exceeded |
| Max eng time budget | ≤3 engineer-days after vendor pin |
| Decision produced | pass → optional vendor enable behind flag; fail → keep noop |

### 16.4 PoC-D — Supermemory managed connectors (`ConnectorIngestionPort`)

| Field | Spec |
| --- | --- |
| Hypothesis | Managed connectors can deliver untrusted intake cheaper than native connector build without write authority |
| Exact port | `ConnectorIngestionPort` |
| Exact managed product/API version | Supermemory managed API as documented at access date [S15a]; pin OpenAPI revision during Stage 15 before run |
| Connector selected for the test | **One** connector only (recommended: Notion **or** Google Drive) — not the full matrix |
| OAuth/data-boundary analysis | Document scopes granted; where tokens live; whether Supermemory stores source bytes; mapping to Cortaix sensitivity classes |
| Dataset/source account | Dedicated test tenant with seeded docs including mundane + marked-sensitive samples |
| Cross-user test | containerTag/user A cannot read user B connection documents |
| Query-disclosure applicability | `not_applicable` for sync itself; **applicable** if connector pipeline triggers embedding/search of queries — deny must hold |
| Evidence/source-disclosure test | sensitive source class default-deny never synced; ordinary sources sync only when policy allows |
| Deletion/disconnection test | delete connection → stop sync; remove mirrored objects from vendor per API |
| Purge test | user/account delete → mirrored docs/memories absent; record attestation gaps |
| Outage test | vendor 5xx → Cortaix continues; intake queue/backoff without data corruption |
| Canonical intake mapping | every mirrored object maps to Cortaix intake/document id; no direct assertion activation |
| Duplicate/idempotency test | re-sync does not create duplicate canonical documents |
| Latency/freshness measure | time-to-visible-intake p50/p95 after source change |
| Cost measure | plan fees + measured SM-token/ops draw for the test window [S15a] |
| Exit/re-sync test | disconnect; delete vendor mirrors; optionally re-connect empty |
| Success criteria | untrusted intake only; isolation/disclosure/idempotency/purge checks pass; cost within Stage 15 cap |
| Failure criteria | direct trusted writes; cross-user leak; undeletable mirrors; mandatory dependency |
| Max eng time budget | ≤5 engineer-days |
| Decision produced | pass → watchlist may promote to optional adapter candidate; fail → remain watchlist/reject connector vendor |

### 16.5 Unnecessary PoCs

Letta/Zep/Mem0/Supermemory as canonical truth; WRRF replacement; remote-text-authority designs.

---

## 17. Security analysis

Prior ≥33 threats remain applicable (cross-user, remote text authority, stale derived, incomplete purge, disclosure leaks, embed drift, agent writes, graph-as-truth, conflict collapse, opaque rerank, outage, license/pricing/termination, supply chain, Python expansion, dual-write divergence, etc.).

---

## 18. Worked adoption scenarios

Prior ≥25 scenarios remain applicable (native-only; unmapped Mem0 text discarded; deleted suppress; outage fallback; disclosure deny; graph false edge; account delete; Python workers; pricing triple; prompt-ready refuse; connector untrusted intake; rebuild; eng-cost vs differentiation).

---

## 19. Decision outcomes

| Candidate | Core outcome | Best port | Role score | Evidence % | Verdict |
| --- | --- | --- | ---: | ---: | --- |
| Native Cortaix | pass (target) | core | 91.4 | 100 | `adopt_as_core_dependency` |
| Mem0 OSS | fail | ExternalMemoryIndexPort | 63.6 | 80 | `proof_of_concept_before_decision` |
| Mem0 managed | fail | ExternalMemoryIndexPort | 58.2 | 60 | `watchlist` |
| Graphiti OSS | fail | Relationship/EntityProjection | 63.8 | 90 | `proof_of_concept_before_decision` |
| Zep managed | fail | none required | not core substitute | 70 | `reject_for_cortaix` as core |
| Cognee OSS | fail | watchlist derived | 60.8 proj card | 80 | `watchlist` |
| Cognee managed | fail | none now | not_scored_for_this_role | 50 | `watchlist` |
| Letta OSS | fail | none | not_scored_for_this_role | 75 | `reject_for_cortaix` |
| Letta managed | fail | none | not_scored_for_this_role | 50 | `reject_for_cortaix` |
| LangGraph/LangMem | fail | inspiration | 44.6 extract card | 88 | `reject_for_cortaix` as core |
| Supermemory OSS | fail | watchlist engine | not_scored_for_connectors | 64 | `watchlist` |
| Supermemory managed | fail | ConnectorIngestionPort | 54.2 | 73 | `watchlist` + PoC-D |
| LlamaIndex | fail | doc watchlist | 66.4 | 100 | `watchlist` |
| Memobase | fail | none | not_scored_for_this_role | 70 | `watchlist` |
| HippoRAG | fail | research | not_scored_for_this_role | 100 | `watchlist` |
| Reranker APIs | fail as store | RetrievalReranker | 63.8 | 75 | `proof_of_concept_before_decision` |

---

## 20. Final recommendation

**Recommendation B remains supported.**

```text
Final:
  Native canonical core.
  ExternalMemoryIndexPort optional (port only).
  RelationshipProjectionPort / EntityProjectionPort optional (port only).
  RetrievalReranker optional (noop default).

Conditional:
  Mem0 OSS after PoC-A.
  Graphiti after PoC-B.
  Reranker vendor after PoC-C + Stage 15 pin.
  Supermemory connectors after PoC-D.

Not selected now:
  Any managed/OSS candidate as canonical memory or agent runtime.
```

Corrected scoring does not override hard-gate failures.

---

## 21. Final matrices

### 21.1 Candidate matrix

| Candidate | Core gates | Core weighted | Best port | Role score | Evidence % | Verdict |
| --- | --- | ---: | --- | --- | ---: | --- |
| Native | pass target | 91.4 | core | 91.4 | 100 | adopt core |
| Mem0 OSS | fail | 43.6 | ExternalMemoryIndexPort | 63.6 | 80 | PoC-A |
| Mem0 managed | fail | 45.2 | ExternalMemoryIndexPort | 58.2 | 60 | watchlist |
| Graphiti OSS | fail | 43.8 | Projection | 63.8 | 90 | PoC-B |
| Zep managed | fail | 45.0 | none required | — | 70 | reject core |
| Cognee OSS | fail | 40.8 | watchlist | 60.8 | 80 | watchlist |
| Cognee managed | fail | 37.4 | — | — | 50 | watchlist |
| Letta OSS | fail | 19.8 | — | — | 75 | reject |
| Letta managed | fail | 20.8 | — | — | 50 | reject |
| LangGraph/LangMem | fail | 33.8 | inspiration | 44.6 | 88 | reject core |
| Supermemory OSS | fail | 47.4 | watchlist | — | 64 | watchlist |
| Supermemory managed | fail | 43.0 | ConnectorIngestionPort | 54.2 | 73 | watchlist/PoC-D |
| LlamaIndex | fail | 44.0 | doc watchlist | 66.4 | 100 | watchlist |
| Memobase | fail | 38.4 | — | — | 70 | watchlist |
| HippoRAG | fail | 44.6 | research | — | 100 | watchlist |
| Reranker APIs | fail store | 35.0 | RetrievalReranker | 63.8 | 75 | PoC-C |

### 21.2 Component matrix

Native for assertions/trust/fusion/packing/influence/FTS; pgvector primary; Mem0/Graphiti/rerank/connectors PoC-gated or watchlist; LlamaIndex no package selected.

---

## 22. Invariants

Prior invariants 1–25 retained, plus:

26. Evidence completeness uses one stable adjudicated-claim formula.  
27. Supported negatives count as evidence-complete, not as implemented capabilities.  
28. Implementation readiness stays in the status matrix.  
29. `independently_corroborated` is not set from reading one’s own repo or vendor marketing alone.  
30. Benchmark `actually_reproduced = no` unless Stage 13 ran it.  
31. Zep fees unresolved without `credits_per_episode`.  
32. Supermemory plan price ≠ scenario TCO without SM-token mapping.  
33. PoC-B/C/D field lists are explicit; “same as PoC-A” is insufficient.

---

## 23. Acceptance delta

Score rationales added (§8A–9). Evidence completeness redefined and ledgers completed (§2.5, §10). Native evidence % ≠ implementation readiness (§4.3, §10.1). Independence fields corrected (§3). Benchmark sources S22–S29 added; audit-depth fields present (§13). Extraction calls calculated; document chunks calculated with low-confidence assumptions (§12). Zep symbolic credits; Cognee sensitivity math; Supermemory unresolved usage (§12.3–12.5). PoC-B/C/D complete (§16). Recommendation B retained.

---

## 24. Stage 14 / 15 / 16–17 handoffs

Stage 14 red-teams B, dual-write, purge, score subjectivity, adapter surface. Stage 15 runs conformance + pins reranker vendor before PoC-C. Stage 16 native first; adapters after PoCs. Stage 17 preserves invariants. **No implementation authorized.**

---

## 25. Final report checklist

1. Category score-evidence tables added for core and scored adapter roles.  
2. Evidence completeness = adjudicated/total.  
3. Native evidence 100% with separate §4.3 implementation matrix.  
4. All candidate ledger percentages visible above.  
5. S1/S2/S21 independently_corroborated = no.  
6. Benchmark sources S22–S29 mapped to rows.  
7. actually_reproduced = no for all.  
8. Extraction S/M/L totals calculated.  
9. Document-chunk assumptions and totals calculated (low confidence).  
10. Zep unresolved; Cognee bands shown; Supermemory usage unresolved.  
11–13. PoC-B/C/D complete.  
14. Recommendation B supported.  
15. Unknowns: purge attestations, credits_per_episode, tokens_per_write measured, SM-token map, reranker vendor pin.  
16. Safe to merge as draft docs after review.  
17. Stage 14 may begin after review (red-team only).

---

## 26. Document control

| Item | Value |
| --- | --- |
| Implementation authorized | No |
| Providers selected now | None |
| Next stage | 14 — red-team |
| PR posture | Draft documentation only |
