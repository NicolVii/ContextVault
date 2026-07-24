# Stage 14 — Architecture Red-Team Review

| Field | Value |
| --- | --- |
| Stage | 14 — Architecture red-team review |
| Status | Draft for architecture review |
| Document date | 2026-07-24 |
| Binding predecessors | Stages 0–13 (especially 7–13) |
| Output | Adversarial architecture review only — **no implementation authorized** |
| Repository context | Cortaix / Context Vault (`NicolVii/ContextVault`) |
| Base commit | `5cbb2333fdf3d1710e1953fde0e5e94c9a2ed886` (Stage 13 merge) |
| Changed file | This document only |

---

## 0. Executive summary

**Final verdict: `approve_with_required_amendments`.**

Recommendation B disposition: **`upheld_with_required_amendments`**.

Stage 7–13 correctly rejects vendor frameworks as canonical authority and correctly elevates PostgreSQL ownership, reconciliation, disclosure, and deletion as first-class contracts. That core direction survives adversarial review.

What does **not** survive unchanged is the assumption that the full Stage 8–12 surface — orthogonal trust matrices, conflict groups, entity/relationship graphs, multi-provider evidence planning, influence-record completeness, optional multi-adapter topology, and normative uncalibrated WRRF constants — is the minimum architecture required to deliver Cortaix’s differentiating value.

This review finds:

| Class | Count |
| --- | --- |
| Distinct attacks evaluated | **56** |
| Confirmed blockers (attack dispositions) | **6** |
| Architecture changes required (attack dispositions) | **10** |
| Clarifications required (attack dispositions) | **5** |
| Stage-15 / sequencing / first-PR constraints (attack dispositions) | **28** |
| Accepted-risk attack dispositions | **3** |
| Rejected attacks | **3** |
| Unresolved attacks | **1** |
| True cross-stage contradictions | **8** |
| Resolvable tensions (matrix) | **12** |
| Correction backlog items | **17** |
| Risk-acceptance register entries | **8** |

**Highest-severity confirmed findings**

1. **Complexity budget overrun** — Stages 8–12 specify ~40+ logical tables, hundreds of invariants, 11+ retrieval channels, and multi-adapter ops without a deliverable minimum-viable cut. Small-team operability fails before product differentiation is proven.
2. **False determinism** — “Deterministic” packing/provider planning sits atop nondeterministic extraction, embedding upgrades, and approximate tokenization. Exactness claims are not enforceable as stated.
3. **Deletion vs provenance / audit** — Immutable provenance, influence records, and deletion completeness are jointly asserted without a proven terminal state under partial failure and backup retention.
4. **Current Mem0 remote-text path** — Production code can inject Mem0 hit text without canonical reconciliation when `cv_memory_id` is absent. Target forbids this; coexistence without disable/harden is unsafe.
5. **Optional adapters → mandatory ops surface** — Recommendation B’s “optional” ports create failure domains (outbox lag, dual-write, purge, pricing) that become operationally mandatory once enabled.
6. **Required-evidence × disclosure × token-budget deadlock** — Stage 12 can invalidate all provider plans; product behaviour under total plan failure is under-specified for UX and billing.

**Recommendation B survives as a direction, not as the v1 build scope.** Amend to:

```text
Native canonical core (narrowed MVA)
+ ports preserved as interfaces
+ zero external memory adapters enabled for private beta
+ adapters remain PoC-gated and depth ≤ 1 after product validation
```

**Stage 15 may begin** after the amendment backlog items marked `blocking_before_stage15` are accepted as normative corrections (documentation amendments in later stages or an explicit Stage-14-accepted correction register — not by silently editing Stages 0–13 in this PR).

**Stage 16/17 and all implementation remain prohibited** until Stage 15 produces a testing framework that can falsify the amended architecture.

---

## 1. Evidence taxonomy and method

### 1.1 Evidence classes

Every material claim below is labelled:

| Class | Meaning |
| --- | --- |
| `repository_fact` | Observable in current code, migrations, tests, or config |
| `design_claim` | Asserted in Stages 7–13 docs |
| `external_fact` | From primary external sources (cited) |
| `assumption` | Stated or implied without proof |
| `inference` | Conclusion drawn from evidence |
| `unknown` | Not established |

### 1.2 Red-team independence rules

- Later-stage dependence does **not** validate an earlier decision.
- Product goals, architectural choices, implementation conveniences, untested assumptions, and external constraints are distinguished.
- Recommendation B is not protected.
- Vendor benchmarks are never treated as architectural proof.
- Stage 13 vendor research is not repeated unless needed to challenge a conclusion.

### 1.3 Repository snapshot used

| Item | Value | Class |
| --- | --- | --- |
| Commit | `5cbb233` — Merge PR #46 Stage 13 | `repository_fact` |
| Runtime memory | Flat `public.memories` + optional Mem0 hybrid | `repository_fact` |
| Target assertion schema | Not in `supabase/migrations/` | `repository_fact` |
| Outbox / workers / WRRF / entity graph | Docs only | `repository_fact` |
| App topology | Next.js 14 App Router, Supabase, Vercel-oriented API routes | `repository_fact` |

---

## 2. Architecture reconstruction

### 2.1 Current implemented architecture

```text
[Browser] → Next.js API routes (/api/chat, /api/think, /api/memories, /api/documents, /api/account, /api/export)
         → Supabase Auth (JWT) + RLS
         → MemoryProvider (Supabase pgvector | Mem0 hybrid)
         → EmbeddingProvider (local hash | OpenAI)
         → Document extract/chunk/embed (sync in request)
         → buildSystemPrompt (profile force-merge + memories + chunks)
         → runInference (OpenRouter / mock)
         → extractCandidates (LLM | heuristic fallback) → insert status=proposed
```

**Canonical store today:** `public.memories` (and documents/chunks).  
**Optional derived index today:** Mem0 remote API when `MEMORY_PROVIDER=mem0`.

Key repository anchors:

| Concern | Path | Lines / symbol | Current behaviour | Class |
| --- | --- | --- | --- | --- |
| Provider interface | `src/lib/memory/provider.ts` | `MemoryProvider` ~L31–54 | insert/retrieve/reembed/remove/syncMetadata/removeAll | `repository_fact` |
| Factory | `src/lib/memory/index.ts` | `getMemoryProvider` | Mem0 iff `MEMORY_PROVIDER=mem0` + key | `repository_fact` |
| Supabase provider | `src/lib/memory/supabase-provider.ts` | `retrieve` | embed → `match_memories` RPC | `repository_fact` |
| Mem0 remote-text fallback | `src/lib/memory/mem0-provider.ts` | L119–125, `toRetrievedMemory` L274–295 | If no `cv_memory_id`, return Mem0 hit text as retrieved memory | `repository_fact` |
| Chat orchestration | `src/lib/orchestration/chat.ts` | L92–133, L214–240 | retrieve → profile force-merge → docs → prompt → extract → proposed | `repository_fact` |
| Profile force-merge | `src/lib/orchestration/chat.ts` | L98–111 | Active `type=profile` injected with `similarity: 1` | `repository_fact` |
| Heuristic fallback | `src/lib/memory/extraction/index.ts` | L139–150 | LLM timeout/error → heuristic extract | `repository_fact` |
| Account delete | `src/app/api/account/route.ts` | L23–53 | `removeAll` → storage → `auth.admin.deleteUser` → cascade | `repository_fact` |
| Export | `src/app/api/export/route.ts` | GET | memories ≠ deleted + docs metadata + profile JSON | `repository_fact` |
| RLS | `supabase/migrations/20260720000006_rls.sql` | memories/docs/chat policies | `auth.uid() = user_id` | `repository_fact` |
| match RPC | `supabase/migrations/20260720000007_functions.sql` | `match_memories` | SECURITY INVOKER + `auth.uid()` filter | `repository_fact` |
| Embeddings | `src/lib/embeddings/index.ts` | `EMBEDDING_DIM=1536` | local or OpenAI | `repository_fact` |
| Workers / outbox | — | — | **Absent** | `repository_fact` |

### 2.2 Target Stage 7–13 architecture

```text
TurnOrchestrator
  → QueryDisclosureService
  → multi-channel recall (memory/doc/entity/relationship/project/conversation/identity[+external])
  → canonical reconciliation + eligibility
  → WRRF × bounded policy (λ=0.15, k=60)
  → optional RetrievalReranker (noop default)
  → conflict-safe grouping
  → provider-candidate planning + hierarchical packing
  → untrusted structured render → inference
  → Processing Pipeline (freeze) → Memory Ingestion Gateway → memory_assertions
  → durable_jobs outbox → workers → derived indexes / graph projections / external adapters
  → DeletionCoordinator across canonical + derived
```

**Canonical:** PostgreSQL `memory_assertions` + supporting operational/history tables.  
**Derived:** embeddings, FTS, external index entries, graph projections.  
**Rejected as core:** Mem0/Zep/etc. as personal-truth authority; graph DB as required infra.

### 2.3 Major data flows

1. **Chat/Think turn** — request-path retrieve + infer; extraction may be request-path today, target moves to outbox after reply durability.
2. **Document upload** — sync extract/chunk/embed today; target adds candidate processing jobs, not auto-trust.
3. **Manual remember / forget** — Think instructions; target: Gateway commands with policy.
4. **Export** — JSON of current rows; target must include revisions/conflicts/decisions semantics.
5. **Deletion** — best-effort provider purge + Auth cascade today; target stateful workflow.

### 2.4 Trust boundaries

| Boundary | Current | Target |
| --- | --- | --- |
| Browser → API | Session cookie / JWT | Same; SELECT-only PostgREST clients |
| API → Postgres | User-scoped Supabase client + RLS | Gateway RPCs for mutations |
| API → Mem0 | Server key; user_id param | Optional ID-only adapter |
| API → OpenRouter/OpenAI | Server/BYOK keys | Disclosure-gated Provider Gateway |
| Worker → Postgres | N/A | service_role claim + allowlisted commands |
| Storage | Per-user folder RLS | Same + deletion steps |

### 2.5 External-call boundaries

Embeddings, Mem0 search/add/update/delete, OpenRouter inference, OpenAI embeddings, optional future reranker/connectors/Graphiti. Target requires query disclosure **before** each external class.

### 2.6 Canonical vs derived

| Class | Current | Target |
| --- | --- | --- |
| Canonical | `memories`, profiles, docs metadata, chat | `memory_assertions`, revisions, provenance, review, disclosure, turns, deletion workflows, influence |
| Derived | pgvector column; Mem0 mirror (de facto co-authority today) | `memory_embeddings`, FTS, external index entries, entity/relationship projections |
| Ambiguous today | Mem0 remote text used without row | Explicitly forbidden by Stages 12–13 |

### 2.7 Request-path vs background-path

| Path | Current | Target |
| --- | --- | --- |
| Request | retrieve, infer, extract, document process, delete | retrieve/pack/infer; durable reply+outbox registration |
| Background | none | extraction continuation, embed, external sync, graph rebuild, deletion steps, repair |

### 2.8 Deletion and export (current vs target)

**Current deletion** (`src/app/api/account/route.ts` L34–53): audit → Mem0 `removeAll` (must succeed) → storage remove → Auth delete → FK cascade. No tracked workflow; Storage list shallow; Stripe/billing cleanup not in this route.

**Target:** `deletion_workflows` + steps; Auth delete last; `subject_ref` survival; purge derived systems; influence/provenance retention rules still contested (see contradiction matrix).

**Current export:** active-ish memories + document metadata + profile. Omits Mem0-only state, revisions (none), conflicts (none), influence.

### 2.9 Retrieval and context flow

**Current:** cosine `match_memories` + profile force-include + `match_document_chunks` → interpolate into system prompt (`src/lib/ai/context.ts`).

**Target:** multi-channel WRRF×policy → conflict groups → disclosure-aware provider plans → reserve-then-fill packing → structured untrusted blocks.

### 2.10 Framework adapter boundaries

Designed ports: `ExternalMemoryIndexPort`, `RelationshipProjectionPort` / `EntityProjectionPort`, `RetrievalReranker`, `ConnectorIngestionPort`, `ExtractionAssist`. Depth ≤ 1. None implemented as target ports.

### 2.11 Current-to-target migration assumptions

Additive `memory_assertions`; `memories` compatibility projection; dual-read; write-through adapter; backfill without inventing trust history; Think+Chat behind TurnOrchestrator; Mem0 harden/disable; no forever dual-write; implementation gated on Stages 14/15/17.

### 2.12 Unimplemented dependencies required by target

Durable job workers (not Vercel request), Gateway mutation RPCs, assertion schema + CHECKs, embedding space registry, FTS documents, deletion coordinator, query/evidence disclosure services, WRRF fusion, packing, influence schema extensions, entity graph tables, processing freeze runs, observability that excludes raw secrets.

### 2.13 Architecture diagram (Mermaid)

Legend: solid = implemented; dashed = designed_not_implemented; dotted = optional_future; cross = rejected.

```mermaid
flowchart TB
  subgraph IMPL["implemented"]
    UI[Browser UI]
    API[Next.js API routes]
    AUTH[Supabase Auth + RLS]
    MEM[(public.memories)]
    DOC[(documents + chunks)]
    PGV[pgvector match_*]
    EMB[EmbeddingProvider local/OpenAI]
    INF[runInference OpenRouter/mock]
    EXT[extractCandidates LLM/heuristic]
    MEM0API[Mem0 HTTP API]
  end

  subgraph PART["partially_implemented"]
    MP[MemoryProvider port]
    EXP[Export JSON]
    DEL[Account DELETE best-effort]
  end

  subgraph DES["designed_not_implemented"]
    TO[TurnOrchestrator]
    QD[QueryDisclosureService]
    WRRF[WRRF x policy fusion]
    PACK[Provider planning + packing]
    GW[Memory Ingestion Gateway]
    MA[(memory_assertions + support)]
    JOBS[durable_jobs outbox + workers]
    DC[DeletionCoordinator]
    ENT[Entity/relationship projections]
    INFREC[response_influence_records]
  end

  subgraph OPT["optional_future"]
    IDX[ExternalMemoryIndexPort]
    RERANK[RetrievalReranker]
    CONN[ConnectorIngestionPort]
    GRAPH[Graphiti-backed projection]
  end

  subgraph REJ["rejected as core"]
    VCORE[Vendor as canonical memory]
    GDB[Required Neo4j/graph DB]
  end

  UI --> API
  API --> AUTH
  API --> MP
  MP --> MEM
  MP -.-> MEM0API
  API --> PGV
  PGV --> MEM
  API --> DOC
  API --> EMB
  API --> INF
  API --> EXT
  EXT --> MP
  API --> EXP
  API --> DEL

  API -.planned.-> TO
  TO -.-> QD
  TO -.-> WRRF
  WRRF -.-> PACK
  PACK -.-> INF
  TO -.-> GW
  GW -.-> MA
  TO -.-> JOBS
  JOBS -.-> ENT
  JOBS -.-> IDX
  JOBS -.-> GRAPH
  PACK -.-> RERANK
  JOBS -.-> CONN
  DEL -.planned.-> DC
  TO -.-> INFREC

  VCORE -.->|rejected| MA
  GDB -.->|rejected| ENT
```

---

## 3. Review lenses — strongest objections

| # | Lens | Strongest objection |
| ---: | --- | --- |
| 1 | Adversarial security | Mem0 remote-text fallback and system-prompt interpolation create injection and cross-authority paths that Stages 12–13 forbid but production still encodes. |
| 2 | Privacy | “Disclosure before external call” is design-only; BYOK, provider logs, and embeddings lack enforceable proof obligations. |
| 3 | PostgreSQL/DB architect | Orthogonal enum explosion + composite FKs + outbox + deletion workflows exceed operable schema complexity before load justifies it. |
| 4 | Distributed systems | Dual-write + outbox + multi-adapter purge without proven idempotency/poison handling will diverge under partial failure. |
| 5 | SRE | Optional adapters multiply on-call domains (PG, workers, Mem0, Graphiti/Neo4j, reranker, connectors) beyond solo/small-team capacity. |
| 6 | ML retrieval/eval | WRRF weights and λ=0.15 are normative before Stage 15 evidence — cargo-cult fusion. |
| 7 | Prompt-injection | Untrusted render reduces instruction-shaped injection but does not stop model-side extraction poisoning from malicious PDFs. |
| 8 | Product architect | Differentiation is “user-owned trusted memory,” not “11-channel WRRF.” Architecture delays learning. |
| 9 | UX / user-control | Assertion/summary/entity/conflict/trust axes will not be comprehensible; review queues will fatigue. |
| 10 | Cost/capacity | Reindex, dual embed spaces, deletion sweeps, and eval infra omitted from TCO of “native.” |
| 11 | Solo-founder delivery | Stages 8–12 are a multi-team platform plan packaged as a product v1. |
| 12 | Framework-adoption skeptic | Ports are fine; enabling any adapter before native MVA works recreates today’s Mem0 hybrid failure mode. |
| 13 | Native-build skeptic | Native estimates hide worker platform, eval harness, and migration years of complexity; managed acceleration underweighted for connectors only. |
| 14 | Incident responder | Recovery procedures depend on rebuildability claims that are untested; vendor-only metadata must never be required — yet mapping tables invite that dependency. |
| 15 | Portability/deletion | Export semantics and deletion terminal states are asserted without fixtures proving round-trip or purge under backup retention. |

Lenses do **not** agree. Security/privacy push more machinery; delivery/UX/cost push radical simplification. The resolution is a **narrowed native MVA**, not “build everything” or “trust a vendor core.”

---

## 4. Architecture complexity inventory

### 4.1 Counts / estimates (from Stages 7–13)

| Category | Estimate | Source |
| --- | --- | --- |
| Canonical tables (Stage 9 core) | ~15–18 named mutation tables | 09 §8 |
| Derived tables | ~5–8 (embeddings, FTS, external index, chunk embeddings, projections) | 09 §8; 11 |
| Mapping / link tables | several (intake links, assertion links, external_memory_index_entries, entity grounding) | 09/11 |
| Policy axes / enums | ~20 Stage 9 + ~15 Stage 11 additive | 09 §8.0; 11 |
| Lifecycle / review / retention / succession | review 5; org 2; retention 4; succession 4 | 09 |
| Trust states | 3 | 08/09 |
| Disclosure flags / policies | per-assertion disclosure policies + purpose permissions | 08/12 |
| Temporal fields | phase × bounds × modality (+ validity intervals) | 08/09 |
| Services / ports | ~15 Stage 9 + ~10 Stage 11 + ~14 Stage 12 + 5–7 framework ports | 09/11/12/13 |
| Background job types | ~12 Stage 9 + ~12 Stage 11 | 09/11 |
| External-call purposes | embed, index search, inference, rerank, connector sync, projection rebuild | 12/13 |
| Provider plans | per eligible provider per turn | 12 §22 |
| Retrieval channels | 11+ | 12 §8 |
| Ranking / packing stages | ≥8 pipeline stages | 12 §1 |
| Audit / influence records | `audit_log` + `response_influence_records` | 09 |
| User-visible review states | 5 review enum + conflict_open UX | 09/08 |
| Migration / reindex workflows | coexistence, backfill, embedding space reindex, graph rebuild | 09/11/12 |
| Invariants across 7–13 | 26+35+64+69+87+46+33 ≈ **360** | stage §§ |

### 4.2 Complexity interrogation

| Category | Diff? | Safety? | Premature? | Collapse? | Defer? | State explosion? | Small team? | User-explainable? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Full assertion taxonomy (11 kinds) | partial | no | yes for v1 | yes → fewer kinds | yes | moderate | hard | weak |
| Multi-axis trust/lifecycle | yes | yes (narrow) | partly | collapse review+trust UX | defer org/retention sophistication | high | hard | weak |
| Temporal intervals | yes | yes | partially | phase+current/historical flag | defer full modality matrix | high | medium | medium |
| Conflict groups | yes | yes | needed early-ish | keep minimal dual-truth ban | defer rich UI | medium | medium | medium |
| Entity/relationship graph | aspirational | limited | **yes** | defer graph; keep names in text | **yes** | high | no | weak |
| Influence records | explainability | medium | yes for full schema | start with message_context evolution | yes | medium | medium | medium |
| Multi-provider evidence planning | niche | privacy-related | **yes** | single-provider pack first | **yes** | high | no | weak |
| External indexes | scale | no | yes | omit | yes | high | no | n/a |
| Rerankers | quality | no | yes | noop forever until metrics | yes | low | low | n/a |
| Connectors | growth | privacy risk | yes | omit | yes | high | no | medium |
| WRRF multi-channel | quality | no | yes | semantic+lexical+profile | calibrate later | medium | medium | n/a |
| Multiple embedding spaces | ops reality | correctness | needed when changing models | one space v1 | second space on change | high | hard | n/a |
| Automatic consolidation | quality | risk | yes | manual/correction first | yes | high | hard | weak |
| Review queues | control | yes | needs UX proof | confirm/reject only | advanced triage later | high | UX risk | weak |

### 4.3 Complexity budget

| Bucket | Components |
| --- | --- |
| `essential_now` | PG canonical assertions (simplified); candidate vs trusted vs distrusted; user confirmation; secret fail-closed; RLS/Gateway mutation control; proposed-not-as-truth; basic semantic+lexical retrieve; conflict-safe “don’t state dual settled facts”; deletion workflow for account/memory; export of canonical rows; TurnOrchestrator convergence; outbox for post-reply extraction; disable unsafe Mem0 remote-text |
| `required_before_scale` | Embedding space registry + reindex; durable workers hardening; influence/explainability; FTS hybrid; document coverage honesty; richer temporal; conflict groups UX; metering for embeds |
| `optional_later` | Entity graph; relationship projections; external memory index; reranker; connectors; multi-provider evidence planning; WRRF full channel set; automatic consolidation; Graphiti |
| `unjustified` (as v1 normative) | 11+ channel fusion with uncalibrated weights as correctness; full orthogonal enum surface before UX validation; depth>1 adapters; forever dual-write; treating optional adapters as needed for differentiation |

---

## 5. Contradiction audit

| ID | Decision A | Decision B | Stages/sections | Conflict | Practical consequence | Severity | Classification | Required resolution |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Immutable provenance / influence retain explainability | Complete user deletion / erasure | 07 P7/P14; 09 §8.23/§23; 13 Inv 10 | Retained records may encode deleted facts | Legal/product “complete deletion” false or explainability hollow | high | `true_contradiction` | Define erasable vs tombstone-only fields; forbid raw fact text in durable audit after purge |
| C2 | Canonical revision history | User deletion of assertion | 08/09 revisions CASCADE vs deletion coordinator | History deleted with assertion or survives? | Export/deletion semantics ambiguous | high | `documentation_ambiguity` | Normative: what survives account delete vs assertion delete |
| C3 | Explicit remember → trusted (clear user-asserted) | Ordinary statements never auto-trusted; sensitive never auto-approved UX | 08 §8–9; 04/06 audits; UI copy | Borderline phrases flip trust | Users surprised by silent trust | medium | `resolvable_tension` | Narrow auto-trust; always show confirmation for sensitive |
| C4 | Deterministic Final(c) / packing | Nondeterministic extraction & approximate tokens | 12 §12/§24; 10 extraction | Same vault → different candidates → different packs | “Deterministic” marketing false | high | `true_contradiction` | Scope determinism to *given candidate set + versions*; never claim end-to-end |
| C5 | Model independence | Fixed 1536-dim spaces; extraction model changes alter memory | 09 embedding lock; 10/13 G9 | Independence of vendor ≠ independence of interpretation | Personality/memory drift across models | high | `resolvable_tension` | Separate provider independence from interpretation stability; pin extraction model |
| C6 | Required evidence must pack | Token budgets + disclosure may block all plans | 12 §22–24 | Total invalidation under-specified | Empty/degraded answers, billing confusion | high | `true_contradiction` | Normative terminal UX + no charge-without-explanation policy |
| C7 | Optional adapters harmless when down | Product features may depend on adapter quality | 13 Rec B; 12 optional channels | Optional becomes load-bearing | Outage = quality collapse misread as “safe” | medium | `resolvable_tension` | SLOs: native-only quality floor; adapters cannot be sole source of differentiation claims |
| C8 | External IDs never replace canonical IDs | Mapping tables + Mem0 metadata | 13 Inv 8; 09 external_memory_index_entries; current mem0 `source_detail` | Mapping becomes de facto join key | Vendor metadata required for purge/retrieve | high | `true_contradiction` | Canonical owns mapping; missing map = unreconciled miss, never remote text |
| C9 | Native serverless/Vercel topology | Long workers, Graphiti/Neo4j PoC-B, heavy reindex | 07 P18; 13 PoC-B; AGENTS.md | Ops model incompatible | Hidden platform rewrite | high | `true_contradiction` | Stage 16 must introduce worker platform before adapter PoCs needing it |
| C10 | Confidence ≠ trust | Policy features use confidence/pin/importance in ranking | 08 Inv 2; 12 policy | Importance biases “truthy” presentation | Users treat ranked order as confidence | medium | `resolvable_tension` | Presentation labels; never show rank as trust |
| C11 | Summaries deferred/controlled | Conversation summaries as MVA candidate | 08/10 vs product need | Summary staleness vs usefulness | Wrong beliefs from stale summary | medium | `resolvable_tension` | Summaries non-authoritative; never extract trust from summary alone |
| C12 | Graph edges derived from assertions | Precomputed projections / one-hop | 11/12 | Projection lag or summary bypass | Stale relationships in context | medium | `implementation_gap` | Rebuild_pending non-consumable (already said) — enforce in Stage 15 |
| C13 | Import never grants trust (10) | Stage 8 deferred import confirmation exception | 08 vs 10 | Docs disagree | Import path unsafe or UX broken | medium | `true_contradiction` | Adopt Stage 10 harden; amend Stage 8 language in later correction stage |
| C14 | Fail-closed disclosure | Availability under provider outage | 12/13 Inv 9 | Safe native path may omit needed sensitive evidence | Wrong answers or refusals | medium | `resolvable_tension` | Explicit local-only UX |
| C15 | Profile force-merge current product | Stage 7/12 reject always-include | 05 High; 07/12 | Migration coexistence contradiction | Invasive memory / wrong identity | high | `implementation_gap` | Must retire before target retrieval declared |
| C16 | Heuristic fallback invents memories | Stage 10 bans heuristic conversational semantic fallback | 04; `extraction/index.ts` L139–150; 10 | Live behaviour forbidden by target | Pollutes candidates | high | `true_contradiction` | Disable inventing fallback before enabling Gateway |
| C17 | Deduplicate paraphrases | Preserve distinct provenance | 10 dedupe | Over-merge destroys sources | Irreversible loss | medium | `resolvable_tension` | Suppress display not destroy provenance |
| C18 | Entity merge reversible | Operational irreversibility of projections | 11 | Split after merge expensive | User harm from wrong merge | high | `resolvable_tension` | Defer auto-merge; manual only in MVA |
| C19 | Roadmap statuses pending | Stages 7–13 exist as complete drafts | 00 vs files | Process doc stale | Process confusion | low | `documentation_ambiguity` | Update roadmap in a later docs PR (not this PR’s scope to edit 00) |
| C20 | Stage 13 cites Mem0 §20.4 | §20 has no .4 | 13 §23 Q30 | Broken citation | Auditability gap | low | `documentation_ambiguity` | Fix in Stage 13 follow-up amendment stage |
| C21 | “Complete export” | Derived system state / influence / jobs | 07/13 | Export incomplete by construction | Portability false | high | `true_contradiction` | Define export as canonical semantic package only; label derived as non-portable |
| C22 | Retry extraction | Idempotent Gateway | 10 freeze vs current retries | Duplicate proposed memories | Vault spam | medium | `implementation_gap` | Idempotency keys mandatory |


## 6. Invariant audit

### 6.1 Method

Consolidated from Stage 13’s 33 invariants plus material must/never/fail-closed rules from Stages 7–12. Status values: `uphold | amend | merge_with_another | defer | remove | unresolved`.

### 6.2 Stage 13 invariants (S13-I1…I33)

| invariant_id | source | statement (abbr.) | product goal | testable | enforceable | conflicts_with | ops cost | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S13-I1 | 13§22 | Eval cannot redefine 7–12 | process | yes | process | C13/C4 amendment needs | low | **amend** — red-team may require normative amendments via explicit correction register |
| S13-I2 | 13§22 | PG canonical regardless of recommendation | independence | yes | yes (if Gateway) | — | med | **uphold** |
| S13-I3 | 13§22 | Weighted score ≠ override failed gate | process | yes | process | — | low | **uphold** |
| S13-I4 | 13§22 | Vendor benchmarks labelled | honesty | yes | docs | — | low | **uphold** |
| S13-I5 | 13§22 | Unknown pricing stays unknown | honesty | yes | docs | — | low | **uphold** |
| S13-I6 | 13§22 | Managed isolation not assumed | privacy | partial | partial | — | low | **uphold** |
| S13-I7 | 13§22 | External text never bypasses reconciliation | safety | yes | yes | current Mem0 L123–125 | med | **uphold** (enforce by disabling path) |
| S13-I8 | 13§22 | External IDs ≠ canonical IDs | independence | yes | yes | C8 mapping gravity | med | **uphold** |
| S13-I9 | 13§22 | Optional outage ≠ block native retrieval | safety | yes | yes | C7 | med | **uphold** |
| S13-I10 | 13§22 | Deletion propagates to every derived system | privacy | hard | partial | C1 backups | high | **amend** — “every derived system Cortaix controls”; backups/legal holds explicit |
| S13-I11 | 13§22 | Query/evidence disclosure Cortaix-owned | privacy | yes | yes | — | med | **uphold** |
| S13-I12 | 13§22 | Trust/conflict Cortaix-owned | safety | yes | yes | — | med | **uphold** |
| S13-I13 | 13§22 | Final packing Cortaix-owned | independence | yes | yes | — | med | **uphold** |
| S13-I14 | 13§22 | Agent writes via Gateway | safety | yes | yes | — | med | **uphold** |
| S13-I15 | 13§22 | Exit strategy per adapter | independence | partial | process | — | med | **uphold** |
| S13-I16 | 13§22 | Self-host ≠ low ops risk | ops | n/a | n/a | — | low | **uphold** |
| S13-I17 | 13§22 | OSS ≠ portable | ops | n/a | n/a | — | low | **uphold** |
| S13-I18 | 13§22 | Managed ≠ production safe | ops | n/a | n/a | — | low | **uphold** |
| S13-I19 | 13§22 | Accept per-port not global | process | yes | process | — | low | **uphold** |
| S13-I20 | 13§22 | Stage 13 ≠ authorize implementation | process | yes | process | — | low | **uphold** |
| S13-I21 | 13§22 | Weighted totals reproducible | process | yes | docs | — | low | **uphold** |
| S13-I22 | 13§22 | Core vs adapter scores non-interchangeable | process | yes | docs | — | low | **uphold** |
| S13-I23 | 13§22 | Gate outcome enum fixed | process | yes | docs | — | low | **uphold** |
| S13-I24 | 13§22 | Native compatibility ≠ implementation verified | honesty | yes | process | — | low | **uphold** |
| S13-I25 | 13§22 | Optional adapter needs PoC when marked | process | yes | process | — | med | **uphold** |
| S13-I26 | 13§22 | Evidence completeness formula stable | process | yes | docs | — | low | **uphold** |
| S13-I27 | 13§22 | Negative facts ≠ capabilities | honesty | yes | docs | — | low | **uphold** |
| S13-I28 | 13§22 | Readiness separate from evidence | process | yes | docs | — | low | **uphold** |
| S13-I29 | 13§22 | Vendor read ≠ independent corroboration | honesty | yes | docs | — | low | **uphold** |
| S13-I30 | 13§22 | Benchmarks not reproduced unless executed | honesty | yes | docs | — | low | **uphold** |
| S13-I31 | 13§22 | Zep fees unresolved w/o credits math | cost | yes | docs | — | low | **uphold** |
| S13-I32 | 13§22 | Supermemory price ≠ TCO w/o mapping | cost | yes | docs | — | low | **uphold** |
| S13-I33 | 13§22 | PoC-B/C/D need explicit fields | process | yes | docs | — | low | **uphold** |

### 6.3 Material Stage 7–12 invariants (consolidated; non-exhaustive listing of all material rules, grouped)

| invariant_id | source | statement | product goal | testable | enforceable | conflicts_with | ops cost | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S7-P1 | 07 | PG canonical for memory semantics | independence | yes | yes | — | med | uphold |
| S7-I1 | 07 | Provider cannot activate/overwrite/delete canonical memory unilaterally | safety | yes | yes | Mem0 hybrid today | med | uphold |
| S7-I7 | 07 | External results reconciled before context | safety | yes | yes | Mem0 L123–125 | med | uphold |
| S7-I8 | 07 | Ineligible memory cannot enter model context | safety | yes | yes | profile force-merge | med | uphold |
| S7-I9 | 07 | Untrusted text cannot change system policy | safety | partial | partial | model noncompliance | med | amend — “must not be *instructed* as system policy”; model compliance unknown |
| S7-I10 | 07 | Sensitive disclosure before provider send | privacy | yes | yes | missing impl | med | uphold |
| S7-I13 | 07 | Never mix embedding spaces | correctness | yes | yes | — | high | uphold |
| S7-I15 | 07 | Deletion workflow to terminal state | privacy | hard | partial | C1 | high | amend |
| S7-I18 | 07 | Workspaces cannot broaden personal memory | safety | yes | yes | workspace tables exist | med | uphold |
| S7-I19 | 07 | Ordinary statements not auto-trusted | safety | yes | yes | C3 | med | uphold |
| S7-P18 | 07 | Prefer operable topology | delivery | partial | process | C9 | high | **amend** — make binding on adapter adoption |
| S8-I1 | 08 | Do not collapse kind/trust/confidence/temporal/sensitivity/lifecycle/eligibility | clarity | partial | schema | complexity budget | high | **amend** — uphold separation of trust vs confidence; defer full orthogonal surface |
| S8-I2 | 08 | Confidence ≠ confirmation | safety | yes | yes | C10 | low | uphold |
| S8-I3 | 08 | No provider grants canonical trust | safety | yes | yes | — | med | uphold |
| S8-I11 | 08 | Deleted never retrieval-eligible | safety | yes | partial | stale indexes | med | uphold |
| S8-I16 | 08 | Documents ≠ memories by upload alone | safety | yes | yes | — | low | uphold |
| S8-I27 | 08 | Forbidden secrets never trusted memory | safety | yes | yes | — | med | uphold |
| S8-I30 | 08 | Unresolved contradictions not dual settled facts | safety | yes | packing | C6 budget | med | uphold |
| S8-I31 | 08 | Material rewrite loses explicit-remember authority | safety | partial | process | — | med | uphold |
| S9-I12 | 09 | Deleted/purge-pending/purged never eligible | safety | yes | yes | — | med | uphold |
| S9-I14 | 09 | Candidates/rejected/distrusted ≠ trusted truth in context | safety | yes | yes | — | med | uphold |
| S9-I17 | 09 | Incompatible embedding spaces never co-queried | correctness | yes | yes | — | high | uphold |
| S9-I38 | 09 | Browser SELECT-only; no self-grant trust | safety | yes | grants | — | med | uphold |
| S9-I49 | 09 | Workers cannot create user_asserted | safety | yes | Gateway | — | med | uphold |
| S9-I53 | 09 | Forbidden secrets never assertion class | safety | yes | yes | — | med | uphold |
| S9-I63 | 09 | Vectors never in job payload/audit/errors | privacy | yes | yes | — | med | uphold |
| S10-I1 | 10 | Processing never writes canonical memory directly | safety | yes | yes | — | med | uphold |
| S10-I4 | 10 | Confidence cannot grant trust | safety | yes | yes | — | low | uphold |
| S10-I9 | 10 | Raw secrets never in assertions/jobs/logs | privacy | hard | partial | provider logs external | high | amend — Cortaix-controlled stores |
| S10-I12 | 10 | Document instructions cannot alter processing policy | safety | partial | prompt+validate | model | med | uphold |
| S10-I13 | 10 | Document-derived remain candidates | safety | yes | yes | — | low | uphold |
| S10-I20 | 10 | Conflict never auto-distrusts trusted | safety | yes | yes | — | low | uphold |
| S10-I47 | 10 | After freeze never re-extract | correctness | yes | yes | — | med | uphold |
| S10-I55 | 10 | Import metadata cannot set trust | safety | yes | yes | C13 | med | uphold |
| S11-I3 | 11 | Resolution never grants assertion trust | safety | yes | yes | — | med | uphold |
| S11-I5 | 11 | Relationship projections ≤ supporting authority | safety | yes | yes | — | high | **defer** with graph |
| S11-I36 | 11 | Global cross-user entity dedupe forbidden | privacy | yes | yes | — | med | uphold |
| S11-I52 | 11 | Self entity never merge loser | safety | yes | yes | — | med | uphold |
| S11-I63 | 11 | Provisional persons must not auto-link by name equality | safety | yes | yes | — | med | uphold |
| S11-I83 | 11 | Stage 12 must not consume rebuild_pending | correctness | yes | yes | — | med | uphold |
| S12-I1 | 12 | Score/graph/pin/confidence never grant trust/eligibility | safety | yes | yes | C10 | med | uphold |
| S12-I3 | 12 | External index never authoritative text | safety | yes | yes | Mem0 | med | uphold |
| S12-I5 | 12 | Ineligible classes never as trusted facts | safety | yes | yes | — | med | uphold |
| S12-I6–8 | 12 | Historical≠current; uncertain≠settled; conflict≠silent truth | safety | yes | packing | C6 | med | uphold |
| S12-I10 | 12 | Scores never override disclosure | privacy | yes | yes | — | med | uphold |
| S12-I25 | 12 | Optional channel failure degrades not fail-open policy | safety | yes | yes | — | med | uphold |
| S12-I27 | 12 | Final(c)=WRRF×(1+λPolicy); λ=0.15; WRRF0⇒Final0 | quality | yes math | yes code | uncalibrated | med | **amend** — formula family uphold; constants `defer` to Stage 15 versioned calibration |
| S12-I28/34 | 12 | Purpose permissions independent; embed≠final inference | privacy | yes | yes | — | med | uphold |
| S12-I40 | 12 | Required evidence never silently downgraded | privacy/UX | yes | yes | C6 | high | amend — define total-failure behaviour |
| S12-local | 12 | local_only never fail-open to another model | privacy | yes | yes | — | med | uphold |

### 6.4 Proposed consolidated invariant set (normative for post-14 work)

Keep a **short enforceable core** (CE-*); move the rest to versioned policy or deferred modules.

| ID | Statement | status |
| --- | --- | --- |
| CE-1 | PostgreSQL (Cortaix schema) is the only authority for personal memory trust, ownership, eligibility, and deletion state. | uphold |
| CE-2 | External systems are derived; hits must reconcile to canonical IDs; remote text never enters context without a live eligible canonical row. | uphold |
| CE-3 | Models and providers never grant `trusted` / `user_asserted` / `user_confirmed`. | uphold |
| CE-4 | Confidence, similarity, rank, pin, graph degree, and vendor scores never grant trust or eligibility. | uphold |
| CE-5 | Forbidden secrets never become durable memory content in Cortaix-controlled stores. | uphold |
| CE-6 | Disclosure purpose is evaluated before each external call class; BYOK ≠ consent. | uphold |
| CE-7 | Ineligible / deleted / purge-pending / distrusted / candidate memories are never presented as settled trusted facts. | uphold |
| CE-8 | Unresolved conflicts are never presented as simultaneous settled current truths. | uphold |
| CE-9 | Embedding spaces are pinned; cross-space similarity is forbidden. | uphold |
| CE-10 | User deletion workflows reach a terminal state for all Cortaix-controlled derived stores; residual backup/legal-hold handling is explicit and user-communicated. | amend |
| CE-11 | Export packages canonical semantic state with documented limitations; derived indexes are rebuild instructions, not portable truth. | amend |
| CE-12 | Given a frozen candidate set, policy version, and tokenizer version, packing/tie-break is deterministic; end-to-end turn determinism is **not** claimed. | amend |
| CE-13 | Native-only path must remain correct and safe when all optional adapters are disabled or down. | uphold |
| CE-14 | Workspaces never broaden personal memory ACL. | uphold |
| CE-15 | Browser clients cannot mutate trust-bearing memory except via allowlisted Gateway commands. | uphold |
| CE-16 | v1 retrieval may use semantic + lexical + explicit identity channels; additional channels require Stage 15 evidence before normative status. | amend |
| CE-17 | Entity auto-merge and external memory adapters are disabled until PoC + product metrics justify them. | amend |

Redundant stage-local duplicates should `merge_with_another` into CE-*. Untestable “model never complies with injection” claims become best-effort + eval, not absolute invariants.

---

## 7. Attack register (≥50)

Disposition legend: `confirmed_blocker | architecture_change_required | architecture_clarification_required | stage15_test_required | stage16_sequencing_constraint | stage17_first_pr_constraint | accepted_risk | rejected_attack | unresolved`.

### 7.1 Attack table (A01–A56)

| Attack ID | Domain | Challenged decision | Evidence | Adversarial setup | Failure mechanism | Likelihood | Impact | Detectability | Confidence | Existing mitigation | Why mitigation may fail | Disposition | Required action | Stage 15 test | Stage 16 constraint | Stage 17 constraint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | security | PG canonical as slogan | design 07/13; code still flat memories | Enable Mem0; strip metadata | Remote text bypasses PG | high | high | easy | high | S13-I7; ID-only | Path still in `mem0-provider.ts` L123–125 | **confirmed_blocker** | Disable/harden before target retrieval | Remote-text inject fixture | Mem0 off until hardened | Forbid enabling Mem0 in first PR |
| A02 | privacy | Remote scores ≠ trust | 12 policy; Mem0 score used as similarity | Malicious high scores | Rank bias → preferred wrong memory | medium | medium | moderate | medium | CE-4 | Rank still influences packing | **stage15_test_required** | Rank ≠ trust eval | Score manipulation harness | — | — |
| A03 | correctness | Framework summaries ≠ canonical | 13 Rec B; Graphiti summaries | Summary ingested as assertion text | Derived summary becomes truth | medium | high | moderate | medium | Gateway validation | Human ops paste summary | **architecture_change_required** | Ban summary→trusted without user confirm | Summary promotion tests | Defer Graphiti | — |
| A04 | correctness | Derived entities ≠ resolve authority | 11 | Projection suggests merge | Auto-merge wrong people | medium | high | moderate | high | S11-I63 | Pressure to automate | **architecture_change_required** | No auto-merge v1 | Merge precision/recall | Entity graph after beta | — |
| A05 | independence | Vendor-only metadata dependency | mem0 `source_detail`; 09 mapping table | Vendor omits fields | Cannot purge/reconcile | medium | high | easy | high | S13-I8 | Mapping gravity | **architecture_change_required** | Canonical mapping rows required | Missing-map purge test | — | — |
| A06 | ops | Mapping table as vendor authority | 09 external_memory_index_entries | Prefer map over assertion | Join treats vendor id as truth | low | high | difficult | medium | Inv 8 | Convenience drift | **stage15_test_required** | Invariant tests | — | — | — |
| A07 | UX | Trust state complexity | 08/09 enums | Mixed review/trust/retention | Inconsistent enforcement | high | medium | moderate | high | docs | Humans err | **architecture_change_required** | Collapse UX states | Operator scenario tests | Simplify schema phase | — |
| A08 | correctness | Circular trust transitions | 08 | Confirm↔conflict↔distrust loops | Oscillation | low | medium | moderate | medium | succession model | Underspecified | **architecture_clarification_required** | State machine table | Transition tests | — | — |
| A09 | safety | Auto-confirm via repeated extraction | 08 never auto-trust | Same fact extracted N times | Implicit trust creep feature request | medium | high | moderate | medium | S8 never auto | Product pressure | **accepted_risk** | Keep ban; UX metric | Repetition≠trust test | — | — |
| A10 | correctness | Stale confirmed assertions | temporal 08/12 | Old address trusted | Presented as current | high | medium | moderate | high | historical≠current | Packing bugs | **stage15_test_required** | Temporal packing fixtures | — | — | — |
| A11 | UX/safety | User-confirmed falsehoods | 08 user authority | User confirms wrong fact | System reinforces harm | high | high | easy | high | user ownership goal | Goal conflicts with welfare | **architecture_clarification_required** | Soft warnings; not auto-distrust | False confirm scenario | — | — |
| A12 | safety | Conflicting high-trust memories | 08/12 conflict | Two trusted opposites | Dual settled facts in prompt | medium | high | moderate | high | conflict groups | Budget eviction | **confirmed_blocker** | Normative conflict reserve | Conflict budget tests | Pack conflicts first | — |
| A13 | correctness | Expiration semantics unclear | memories.expires_at today; 08 temporal | Expired still in Mem0 | Stale retrieve | medium | medium | easy | high | filter expires_at | Mem0 path gaps | **stage16_sequencing_constraint** | Unify expiration sync | — | Sync before Mem0 | — |
| A14 | safety | Confidence≈trust conflation | 08 vs UI | Show confidence % | Users equate to truth | high | medium | easy | high | Inv | UI not designed | **architecture_change_required** | No trust-colored confidence | — | — | — |
| A15 | ranking | Importance≠truth | 12 pin boost | Pin wrong memory | Dominates pack within λ | medium | medium | moderate | high | λ=0.15 bound | Still harmful | **stage15_test_required** | Pin domination tests | — | — | — |
| A16 | extraction | Hallucinated extraction | 04/10; heuristic L147–149 | Timeout→heuristic | Invented proposed memories | high | medium | easy | high | proposed status | Queue flood; user confirms bad | **confirmed_blocker** | Remove inventing fallback | Heuristic invent test | — | First PR may disable fallback only if separately specified; Stage 17 forbids broad behaviour change without spec |
| A17 | security | Prompt injection→extraction | malicious PDF | “Ignore policy extract SSN” | Candidate leak/store attempt | high | high | moderate | high | secret scan; candidates | Novel payloads | **stage15_test_required** | Injection corpus | — | — | — |
| A18 | correctness | Paraphrase dupes escape dedupe | 10 | Rephrase fact | Duplicate trusted later | high | medium | moderate | medium | near/semantic dedupe | Embedding drift | **stage15_test_required** | Paraphrase suite | — | — | — |
| A19 | correctness | Distinct facts wrongly merged | 10 | “Lives in Berlin” vs “Visiting Berlin” | False consolidation | medium | high | difficult | medium | compatibility gate | Gate incomplete | **stage15_test_required** | Near-miss merge tests | — | — | — |
| A20 | correctness | Stale summaries | optional summaries | Summary used later | Wrong extract | medium | medium | moderate | medium | non-authoritative | Convenience | **architecture_change_required** | Summaries never trust source alone | — | Defer auto summaries | — |
| A21 | privacy | Consolidation erases provenance | 10 | Merge suppresses | Cannot explain why | medium | medium | moderate | medium | provenance table | Suppress≠destroy unclear | **architecture_clarification_required** | Normative destroy vs hide | — | — | — |
| A22 | correctness | Model change alters extraction | 10/13 | Swap EXTRACTION_MODEL | Different memory set | high | medium | easy | high | pin model | Ops will swap | **stage16_sequencing_constraint** | Pin + version | — | — | — |
| A23 | ops | Extraction retries duplicate writes | current no idempotency | Double submit | Duplicate proposed | high | low | easy | high | target freeze | Not implemented | **stage17_first_pr_constraint** | Idempotency in first durable write PR | — | Require idempotency keys | — |
| A24 | safety | Corrections overwritten | 10 correction | Later chat re-extracts old fact | User correction lost | medium | high | moderate | high | authority rules | Bug/race | **stage15_test_required** | Correction stickiness | — | — | — |
| A25 | entities | Over-merging | 11 | Same display name | Wrong person graph | medium | high | moderate | high | no name equality | Future feature creep | **architecture_change_required** | Defer auto entity | — | After paid scale | — |
| A26 | entities | Under-merging | 11 | Many aliases | Fragmented context | medium | low | moderate | medium | alias table | — | **rejected_attack** | Prefer under-merge | — | — | — |
| A27 | entities | Alias collision cultures | 11 | Common names | False link | medium | high | moderate | high | S11-I63 | — | **stage15_test_required** | Multilingual alias tests | — | — | — |
| A28 | entities | Relationship w/o assertion | 11 | Manual edge pressure | Edge grants truth | low | high | easy | high | manual requires assertion | Bypass | **stage15_test_required** | Edge orphan test | — | — | — |
| A29 | ops | Graph projection lag | 11/12 | Query during rebuild | Stale edges used | medium | medium | moderate | high | rebuild_pending ban | Enforcement miss | **stage15_test_required** | Lag fixtures | — | — | — |
| A30 | ranking | Graph loops amplify candidates | 11/12 | Cyclic relations | Flood | low | medium | moderate | medium | one-hop bound | Precomputed summaries | **architecture_change_required** | Defer graph | — | — | — |
| A31 | ranking | One-hop bypass via summaries | 12 | Summary encodes multi-hop | Policy bypass | medium | medium | difficult | medium | hop policy | — | **stage15_test_required** | Multi-hop summary test | — | — | — |
| A32 | ops | Merge irreversible in practice | 11 | Split after projections | Costly/incomplete split | medium | high | moderate | high | reversible design | Ops reality | **architecture_change_required** | Manual merge only; soft links | — | — | — |
| A33 | ranking | Candidate flooding | 12 channels | Huge vault | Latency/cost collapse | high | high | easy | high | caps | Caps untested | **stage15_test_required** | 1e6 chunk soak | Scale gates | — | — |
| A34 | ranking | Low-quality channel dominates | 12 weights | Noisy lexical | Wrong top-k | medium | medium | moderate | medium | weights | Uncalibrated | **stage15_test_required** | Ablation | — | — | — |
| A35 | ranking | WRRF constants arbitrary | 12 λ=0.15 k=60 | Adversarial orderings | Normative without evidence | high | medium | easy | high | Stage 15 calibrate | Treated as sacred | **architecture_change_required** | Version constants; non-blocking for MVA | Calibration suite | Don’t freeze λ | — |
| A36 | ranking | Policy multipliers hidden bias | 12 | Pin+recency stack | Systematic skew | medium | medium | difficult | medium | ±15% | Compounding features | **stage15_test_required** | Bias audit | — | — | — |
| A37 | packing | Required evidence starves budget | 12 | Large required set | Utility collapse | medium | high | moderate | high | reserve-then-fill | Deadlock C6 | **confirmed_blocker** | Terminal plan policy | Deadlock fixtures | — | — |
| A38 | packing | Conflicts displace useful evidence | 12 | Many conflicts | Answer poor | medium | medium | moderate | medium | conflict reserve | Over-reserve | **stage15_test_required** | Tradeoff metrics | — | — | — |
| A39 | packing | Token estimate ≠ tokenizer | 12 | Tiktoken vs provider | Invalidated plan | high | medium | moderate | high | exact pack fallback | Fallback unbounded risk | **architecture_clarification_required** | Bound exact-pack attempts | Tokenizer mismatch tests | — | — |
| A40 | ranking | Reranker undoes order | 13 optional rerank | Enable vendor rerank | Non-deterministic eligibility creep | medium | medium | moderate | high | cannot change eligibility | Bug | **stage15_test_required** | Rerank invariant | PoC-C gate | — | — |
| A41 | routing | Provider projection suboptimal | 12 plans | Cheap model wins estimate | Bad answer | medium | medium | moderate | medium | attainableUtility | Metric wrong | **stage15_test_required** | Plan quality | Defer multi-provider | — | — |
| A42 | UX | Optional evidence churn | 12 | Flaky optional channel | Unstable answers | medium | medium | moderate | medium | degrade | User trust loss | **accepted_risk** | Telemetry | — | — | — |
| A43 | privacy | Identity shortcut leakage | 12 identity; context.ts | Name Q → hard answer | OK; but persona leak? | low | low | easy | medium | allowlist | — | **rejected_attack** | Keep allowlist | — | — | — |
| A44 | docs | Coverage failure | 12 whole-doc | Caps 4/2 | False completeness | medium | medium | easy | high | honest labels | UI omit labels | **stage15_test_required** | Label honesty | — | — | — |
| A45 | correctness | Embedding drift/upgrade | 09 spaces | Silent model upgrade | Rank chaos | high | high | moderate | high | space registry | Not implemented | **confirmed_blocker** | Registry before model change | Drift A/B | No embed model change in early PRs | — |
| A46 | correctness | Cross-space contamination | 09 | Query wrong space | Nonsense | low | high | easy | high | ban | Bug | **stage15_test_required** | — | — | — | — |
| A47 | privacy | Lexical retrieve deleted text | 12 FTS | Soft delete lag | Leak deleted | medium | high | moderate | high | eligibility | Index lag | **stage15_test_required** | Delete-then-search | Deletion before FTS | — | — |
| A48 | ops | Stale cache retrieval | design | CDN/app cache | Stale memory | low | medium | difficult | low | force-dynamic routes | Future caches | **unresolved** | — | — | — | — |
| A49 | scale | Long-vault latency collapse | product | Power user | Timeouts | high | high | easy | high | caps | Sync topology | **stage16_sequencing_constraint** | Async retrieve budgets | Workers before huge vaults | — | — |
| A50 | privacy | Query disclosure misclassification | 12 | Purpose wrong | Over/under share | medium | high | difficult | medium | purpose matrix | Ambiguous intents | **stage15_test_required** | Purpose corpus | — | — | — |
| A51 | privacy | Redaction changes meaning | 12 | Redact entity | Wrong retrieve | medium | medium | moderate | medium | — | — | **stage15_test_required** | Redaction IR tests | — | — | — |
| A52 | privacy | BYOK as consent | 13 §1.4#11 | User supplies key | Policy bypass pressure | medium | high | easy | high | BYOK≠bypass | Support exceptions | **architecture_clarification_required** | Product copy + enforce | — | — | — |
| A53 | privacy | Provider logs retain prompts | external | Use OpenRouter | Sensitive retain | high | high | difficult | medium | disclosure | Vendor opaque | **accepted_risk** | DPA/legal review; minimize | — | — | — |
| A54 | privacy | Embeddings leak restricted info | embed external | Embed secrets | Vector inversion risk | low | medium | difficult | low | secret block | Residual | **rejected_attack** | Block secrets pre-embed | — | — | — |
| A55 | privacy | External rerank leaks text | PoC-C | Send candidates | Data exfil | medium | high | easy | high | disclosure | Misconfig | **stage16_sequencing_constraint** | Rerank after disclosure svc | — | — | — |
| A56 | delivery | Overbuilt architecture delays PMF | Rec B full | Build 8–12 fully | No users; wasted eng | high | high | easy | high | phased 16 | Scope creep | **confirmed_blocker** | Adopt MVA cut | — | Sequence MVA first | First PR only MVA foundation |

### 7.2 Attack domain coverage check

Mandatory domains from the brief are covered by A01–A56 plus scenarios S01–S40 (deletion, export, dual-write, poison, clocks, UX queue, cost, etc.). Additional domain-specific attacks appear in worked scenarios where causal chains are longer than a single register row.

---

## 8. Worked adversarial scenarios (≥35; mandatory set included)

Format fields: setup, actors, initial state, event sequence, expected architecture behaviour, plausible actual failure, data exposed or corrupted, user-visible effect, detection, recovery, design implication, Stage 15 test.

### S01 — Retract then repeat false fact
- **setup:** User states “I am a doctor,” retracts, later jokes “I’m a doctor.”
- **actors:** User, extraction, Gateway.
- **initial state:** trusted assertion then user_corrected/distrusted path.
- **event sequence:** assert → correct → restate.
- **expected:** restatement creates candidate or confirms only with explicit remember; does not silently revive.
- **plausible failure:** heuristic/LLM re-proposes; user fatigue confirms; or consolidation merges with old.
- **data:** wrong professional identity trusted.
- **UX:** Assistant addresses user as doctor.
- **detection:** influence shows revived id; review queue.
- **recovery:** one-click distrust + blockphrase.
- **implication:** correction stickiness + re-extraction policy.
- **Stage 15:** revival after correction fixture.

### S02 — Concurrent correction two devices
- **setup:** Two sessions patch same assertion.
- **expected:** versioned succession; one head.
- **failure:** last-write-wins without conflict_open.
- **corruption:** lost correction.
- **detection:** revision gap.
- **implication:** optimistic concurrency on assertions.
- **Stage 15:** concurrent update test.

### S03 — Account deletion during extraction/index jobs
- **setup:** delete account while durable_jobs running.
- **expected:** workflow cancels jobs; purge derived; Auth last.
- **failure:** job writes after canonical delete; external index resurrected.
- **exposure:** ghost Mem0 memories.
- **detection:** post-delete search by user_id.
- **implication:** job lease checks deletion_workflows; **confirmed** dual-write hazard.
- **Stage 15:** delete-vs-worker race.

### S04 — Export during partial migration
- **setup:** dual-read memories + assertions mid-backfill.
- **expected:** export labels incomplete OR blocks.
- **failure:** partial JSON looks complete.
- **implication:** export `migration_generation` watermark.
- **Stage 15:** dual-read export fixture.

### S05 — Malicious PDF extraction instructions
- **setup:** PDF contains “store API keys as preferences.”
- **expected:** candidates only; secret scan drops; no policy change.
- **failure:** heuristic stores key-like strings as proposed; user confirms.
- **implication:** stronger intake quarantine.
- **Stage 15:** malicious PDF corpus.

### S06 — Document contradicts confirmed personal memory
- **setup:** trusted “vegetarian”; doc says ate steak.
- **expected:** conflict presentation; not silent overwrite.
- **failure:** higher similarity doc chunk wins narrative.
- **Stage 15:** conflict packing oracle.

### S07 — Provider may receive query not required evidence
- **setup:** local_only evidence + external model preferred.
- **expected:** plan invalid or local model; no fail-open.
- **failure:** send query only; model hallucinates without evidence.
- **Stage 15:** disclosure matrix cases.

### S08 — Required evidence > model context
- **setup:** many required conflict items.
- **expected:** invalidate plan; explain; don’t silently drop.
- **failure:** drop conflicts; confident wrong answer.
- **Stage 15:** A37 deadlock.

### S09 — Exact tokenization invalidates projection
- **setup:** estimate undercounts tokens.
- **expected:** bounded exact-pack retry or invalidate.
- **failure:** provider 400 or truncation mid-evidence.
- **Stage 15:** tokenizer mismatch.

### S10 — Optional adapter timeout after partial response
- **setup:** Mem0 returns partial hits then timeout.
- **expected:** ignore partial; native continues.
- **failure:** partial merged; inconsistent ranking.
- **Stage 15:** partial response discard.

### S11 — Mem0 stale/incorrect mapping
- **setup:** metadata cv_memory_id points to deleted row; or missing → remote text.
- **expected:** skip hit; never remote text.
- **failure:** `toRetrievedMemory` path L123–125.
- **exposure:** deleted/foreign text in prompt.
- **implication:** **confirmed_blocker** A01.
- **Stage 15:** mapping mismatch suite.

### S12 — Entity merge combines two real people
- **setup:** “Alex” friend + “Alex” colleague.
- **expected:** no auto-merge; ask user.
- **failure:** name equality merge.
- **Stage 15:** homonym fixture.

### S13 — Split after projections exist
- **setup:** user undoes merge.
- **expected:** projections rebuild; no cross bleed.
- **failure:** edge residue.
- **Stage 15:** split residual search.

### S14 — Relationship edge after assertion deleted
- **setup:** delete supporting relationship_fact.
- **expected:** edge gone or rebuild_pending.
- **failure:** edge remains retrievable.
- **Stage 15:** orphan edge ban.

### S15 — Simultaneous name/employer/location/preference change
- **setup:** user updates life facts in one message.
- **expected:** multiple candidates; temporal succession; no single blob summary as truth.
- **failure:** one summary assertion; old facts linger as current.
- **Stage 15:** multi-fact extraction temporal.

### S16 — Silent embedding model upgrade
- **setup:** OPENAI_EMBEDDING_MODEL changes.
- **expected:** new space; reindex; no cross-query.
- **failure:** mixed vectors one index.
- **Stage 15:** space pin enforcement.

### S17 — Reindex interrupted halfway
- **setup:** job crash mid-backfill.
- **expected:** restartable; query only ready space.
- **failure:** half old half new similarities.
- **Stage 15:** interrupt/resume.

### S18 — Postgres up, workers down
- **setup:** outbox fills.
- **expected:** chat works; extraction delayed; user informed if review lag.
- **failure:** sync extract reintroduced under pressure; or unanswered durability broken.
- **Stage 15:** worker outage chaos.

### S19 — Postgres degraded, external index up
- **setup:** PG slow; Mem0 fast.
- **expected:** fail closed on canonical miss; no remote-text authority.
- **failure:** serve Mem0-only answers.
- **Stage 15:** PG timeout with adapter up.

### S20 — Reranker gets disclosure-forbidden candidate
- **setup:** bug sends restricted text to rerank API.
- **expected:** pre-filter by disclosure.
- **failure:** leak to vendor.
- **Stage 15:** red-team filter.

### S21 — Redacted query still identifying
- **setup:** “my HIV clinic on Maple St” → redacted structure.
- **expected:** block or local_only.
- **failure:** send skeleton still unique.
- **Stage 15:** residual identifiability cases (**privacy review**).

### S22 — Why do you believe embarrassing fact?
- **setup:** user asks explanation.
- **expected:** influence without raw third-party private provenance beyond policy.
- **failure:** dumps email snippet / doc title sensitive.
- **Stage 15:** explainability redaction.

### S23 — Forget fact but keep conversation
- **setup:** forget memory; retain chat.
- **expected:** memory ineligible; chat may still contain text unless scrub requested.
- **failure:** retrieve from message history channel as memory.
- **implication:** clarify forget vs erase transcripts (**product + legal review**).
- **Stage 15:** history-channel eligibility.

### S24 — Same document via two connectors
- **setup:** duplicate import.
- **expected:** dedupe by content hash; one doc.
- **failure:** double chunks flood retrieval.
- **Stage 15:** duplicate ingest.

### S25 — Connector OAuth lost mid-sync
- **setup:** token revoke.
- **expected:** job fails safe; no partial trusted memory.
- **failure:** partial candidates; retry storms.
- **Stage 16:** connectors after core.

### S26 — Vendor triples pricing
- **setup:** Mem0/rerank price shock.
- **expected:** disable adapter; native continues.
- **failure:** business depends on adapter quality.
- **implication:** adapters non-load-bearing for differentiation claims.

### S27 — OSS adapter abandoned
- **setup:** Graphiti unmaintained.
- **expected:** exit strategy; drop port.
- **failure:** fork burden.
- **Stage 13 Inv 15 uphold.**

### S28 — Schema rollback with new workers
- **setup:** migrate forward; rollback DB; workers new.
- **expected:** version gate jobs.
- **failure:** poison messages; corruption.
- **Stage 16:** expand/contract migrations.

### S29 — Cross-user retrieval via metadata filters
- **setup:** attacker crafts Mem0 filter / RPC params.
- **expected:** server-side user scope only.
- **failure:** client-supplied user id trusted.
- **note:** current RPC uses auth.uid() — good; Mem0 uses server userId — good if never client-controlled.
- **Stage 15:** IDOR suite.

### S30 — Millions of document chunks
- **setup:** power user.
- **expected:** caps, async, quotas.
- **failure:** Vercel 60s upload; retrieve timeout (`documents/route.ts` maxDuration=60).
- **Stage 16:** quotas before connectors.

### S31 — Low-latency model rejects sensitive evidence
- **setup:** required sensitive → local_only model slower.
- **expected:** choose capable plan or refuse with notice.
- **failure:** strip evidence to keep latency SLA.
- **Stage 15:** latency vs disclosure.

### S32 — Summary omits conflict then used for extraction
- **setup:** summary job drops conflict.
- **expected:** summaries non-canonical.
- **failure:** extract trusts summary.
- **Stage 15:** summary non-authority.

### S33 — Historical address as current
- **setup:** trusted historical home.
- **expected:** labelled historical.
- **failure:** profile force-merge style presentation.
- **Stage 15:** temporal labels.

### S34 — User confirms false memory
- **setup:** bad proposed confirmed.
- **expected:** trusted false; user-owned; easy undo.
- **failure:** hard to find/undo; harms.
- **implication:** undo UX mandatory.
- **Stage 15:** confirm→undo latency.

### S35 — Model-independent representation differs across models
- **setup:** same assertions; different chat models.
- **expected:** same eligibility; answers may differ in style not memory set.
- **failure:** model-specific packing hacks.
- **Stage 15:** cross-model memory invariance.

### S36 — Review queue thousands ambiguous
- **setup:** chatty user; heuristic flood.
- **expected:** rate limits; batch reject; priority.
- **failure:** abandonment; random confirms.
- **implication:** extraction precision > recall for v1.
- **Stage 15:** queue growth simulation.

### S37 — Deletion audit log contains deleted fact
- **setup:** audit metadata stores content.
- **expected:** hashes/ids only after purge.
- **failure:** `recordAudit` payloads retain text (**check implementations**).
- **implication:** C1 amendment.
- **Stage 15:** audit post-delete scan.

### S38 — Repair job republishes deleted external entry
- **setup:** usage repair / reindex after delete.
- **expected:** deletion gate on all publishers.
- **failure:** resurrect Mem0 row.
- **Stage 15:** publish-after-delete ban.

### S39 — Import foreign vault incompatible semantics
- **setup:** import JSON with “trusted” flags.
- **expected:** Stage 10 — metadata cannot grant trust.
- **failure:** Stage 8 ambiguity grants trust.
- **Stage 15:** hostile import.

### S40 — Multi-day provider outage → local-only
- **setup:** OpenRouter down.
- **expected:** mock/local degrade; memory safe; UX clear.
- **failure:** silent quality collapse; billing oddities.
- **Stage 15:** outage UX.

### Additional scenarios (S41–S45) for coverage density
- **S41 Dual-write divergence:** Supabase insert ok; Mem0 fail rolls back today (mem0-provider insert); reverse order failure modes in target outbox.
- **S42 Poison message:** malformed job payload loops; needs DLQ.
- **S43 Clock skew:** expires_at boundary wrong across nodes.
- **S44 Correction vs retrieval race:** retrieve sees old head mid-correction.
- **S45 Graph rebuild vs merge race:** covered by S13/S29-like; entity rebuild_pending.


## 9. Recommendation B adversarial review

Stage 13 recommendation:

```text
Native canonical core + optional framework adapters
```

### 9.1 Direct attacks on B

1. **Confirmation bias:** Stages 7–12 already assumed native ownership; Stage 13’s hard gates encode that assumption, so externals “fail as core” by construction. That is acceptable for *core* rejection, but it does not prove the *optional adapter surface* is justified.
2. **Optional → mandatory:** Once Mem0/Graphiti/rerank/connectors are enabled for demos, ops and product promises accrete until “optional” is false (A56, S26).
3. **Engineering cost transfer:** B claims to save build cost via adapters while simultaneously requiring native WRRF, disclosure, deletion, packing, influence — adapters add net ops without removing native scope.
4. **Current Mem0 experience:** The only live adapter-like path already violates B’s own invariants (remote text). B underestimates how hard “derived only” is in production.
5. **Small-team topology:** B + PoC-B Neo4j is incompatible with current Next/Vercel request topology without a new worker platform (C9).

### 9.2 Alternatives

#### Alternative A — Full Recommendation B
Native core + optional index, graph, reranker, connector adapters.

| Dimension | Assessment |
| --- | --- |
| product-value speed | Slow — large surface before learning |
| safety | Good *if* ports enforced; historically leaky |
| privacy | Hard — more external calls |
| correctness | Complex failure modes |
| model independence | Strong on paper |
| eng effort | Very high |
| ops effort | Very high when adapters on |
| migration risk | High (dual-write) |
| reversibility | Medium (exit strategies claimed) |
| latency | Worse with fan-out |
| cost | Higher variance |
| user comprehensibility | Poor |
| testing burden | Extreme |

**Strongest case:** Long-term platform optionality without vendor lock-in for scale features.

#### Alternative B — Strict native-only v1
No external memory framework adapters in first production architecture.

| Dimension | Assessment |
| --- | --- |
| product-value speed | Faster than A for core trust UX |
| safety | Best control |
| privacy | Best |
| correctness | Fewer moving parts |
| model independence | Preserved |
| eng effort | High but focused |
| ops effort | Lowest among capable options |
| migration risk | Lower |
| reversibility | High (ports can exist unused) |
| latency | Best controllable |
| cost | Predictable |
| comprehensibility | Better |
| testing burden | Still high but bounded |

**Strongest case:** Matches CE-13; validates differentiation without Mem0/Graphiti. **Preferred for private/public beta.**

#### Alternative C — Minimal memory core
Confirmed profile + atomic user-authored memories + conversation summaries + document retrieval + basic semantic/lexical search. Defer trust matrices, graphs, multi-provider planning, advanced consolidation, framework ports.

| Dimension | Assessment |
| --- | --- |
| product-value speed | **Fastest** honest learning |
| safety | Good if candidate≠trusted held |
| privacy | Good |
| correctness | Limited intelligence |
| model independence | Yes |
| eng effort | Lowest differentiating |
| ops effort | Low |
| migration risk | Lowest |
| reversibility | High |
| latency | Good |
| cost | Lowest |
| comprehensibility | **Best** |
| testing burden | Lowest |

**Strongest case:** Delivers “remember what I confirmed” and document Q&A — likely the actual user-visible wedge — without theatre.

**Risk:** Underbuilding conflict/temporal may re-create Stage 5 failures; keep a *thin* conflict+temporal slice.

#### Alternative D — Framework-centred derived engine
PG canonical but one framework owns extraction + candidates.

| Dimension | Assessment |
| --- | --- |
| speed | Medium short-term |
| safety | Weak — authority leakage historically |
| privacy | Weak |
| correctness | Vendor-shaped |
| independence | Theatre risk |
| eng | Medium integration |
| ops | Vendor + dual-write |
| migration | High lock-in |
| reversibility | Poor |
| latency | Vendor-dependent |
| cost | Vendor |
| UX | Opaque |
| testing | Hard (vendor nondeterminism) |

**Strongest case:** Speed if vendor already solves extraction quality — **rejected for Cortaix** given product thesis and current Mem0 harm.

#### Alternative E — Managed acceleration
Native authority + one managed memory/connector service for selected workloads.

| Dimension | Assessment |
| --- | --- |
| speed | Good for connectors |
| safety | Conditional |
| privacy | Needs DPA + disclosure |
| correctness | Mixed |
| independence | Partial |
| eng | Lower for connectors |
| ops | Vendor SEV risk |
| migration | Medium |
| reversibility | Medium |
| latency | Medium |
| cost | COGS |
| UX | Connector magic |
| testing | Contract tests |

**Strongest case:** **Connectors only** after core exists (aligns with PoC-D watchlist) — not for memory authority.

#### Alternative F — Event-sourced memory core
Append-only events canonical; materialized assertions + rebuildable projections.

| Dimension | Assessment |
| --- | --- |
| speed | Slow to build |
| safety | Excellent audit/delete tombstones |
| privacy | Strong erasure semantics possible |
| correctness | Rebuildable |
| independence | Strong |
| eng | Very high |
| ops | High |
| migration | Hard from flat rows |
| reversibility | N/A |
| latency | Materialization lag |
| cost | Storage |
| UX | Harder |
| testing | Heavy |

**Strongest case:** Resolves C1 deletion vs provenance better than mutable-row + side audit. **Not v1** — revisit if deletion/audit proofs fail Stage 15.

### 9.3 Comparative verdict on alternatives

```text
Private beta:   Alternative C sharpened with thin trust/conflict/deletion from B's native core
Public beta:    Alternative B (strict native-only; ports exist but disabled)
Paid scale:     Consider E for connectors; A only after metrics
Reject as v1:   D
Defer:          F (unless Stage 15 deletion proofs demand it)
Rec B:          upheld_with_required_amendments → "B-ports + C/B-scope"
```

---

## 10. Minimum viable architecture challenge

### 10.1 Differentiating value (product goal)

Cortaix differentiation (from Stages 7–13 product framing): **user-owned, model-independent personal memory** with explicit control — not multi-channel fusion theatre.

Honest MVA:

```text
1. Profile identity (allowlisted)
2. User-authored / user-confirmed atomic memories (trusted)
3. Extraction proposals as candidates only (no inventing fallback)
4. Document chunk retrieval with honest coverage
5. Semantic + lexical retrieval over canonical text
6. Conflict-safe packing (no dual settled current facts)
7. Basic temporal current vs historical label
8. Gateway-enforced trust mutations
9. Deletion workflow for memories/account across Cortaix-controlled stores
10. Export of canonical semantic package
11. TurnOrchestrator unifying Chat/Think
12. Outbox for post-reply processing
```

### 10.2 Component classification

| Component | Class | Postpone failure / required benefit |
| --- | --- | --- |
| Simplified assertions (candidate/trusted/distrusted) | must_exist_before_private_beta | Without: Stage 4/5 failures persist |
| User confirmation + undo | must_exist_before_private_beta | Without: no user ownership |
| Secret fail-closed | must_exist_before_private_beta | Safety |
| RLS + Gateway mutations | must_exist_before_private_beta | Tampering |
| TurnOrchestrator | must_exist_before_private_beta | Chat/Think drift |
| Outbox workers (minimal) | must_exist_before_public_beta | Charge-without-reply / sync extract risk |
| Deletion coordinator | must_exist_before_public_beta | Privacy claims false |
| Export canonical package | must_exist_before_public_beta | Portability claims false |
| Lexical+semantic hybrid | must_exist_before_public_beta | Quality floor |
| Thin conflict handling | must_exist_before_public_beta | Dual-truth harm |
| Thin temporal labels | must_exist_before_public_beta | Stale current facts |
| Embedding space registry | must_exist_before_paid_scale | Drift incidents |
| Full assertion taxonomy | optional_after_product_validation | Benefit: precision analytics |
| Multiple trust axes beyond 3 | optional_after_product_validation | Benefit: nuanced UX proven |
| Full temporal intervals/modality | optional_after_product_validation | Benefit: measured temporal errors |
| Rich conflict groups UX | optional_after_product_validation | Benefit: conflict rate metrics |
| Entity graph | optional_after_product_validation / remove from v1 normative | Benefit: entity task eval lift |
| Relationship graph | optional_after_product_validation | Same |
| Full influence schema | must_exist_before_paid_scale (basic) / optional full | Benefit: support+trust |
| Multi-provider evidence planning | optional_after_product_validation | Benefit: privacy-sensitive enterprise |
| External memory indexes | optional_after_product_validation | Benefit: latency at scale |
| Rerankers | optional_after_product_validation | Benefit: NDCG lift ≥ threshold |
| Connectors | optional_after_product_validation | Benefit: retention/activation |
| Whole-document coverage modes | optional_after_product_validation | Benefit: doc-QA eval |
| Multiple embedding spaces | must_exist_before_paid_scale when changing models | — |
| Automatic consolidation | optional_after_product_validation | Benefit: dupe rate ↓ without precision loss |
| Advanced review queues | optional_after_product_validation | Benefit: confirm rate without fatigue |
| WRRF full channel set | optional_after_product_validation | Benefit: ablation proof |
| Graphiti/Mem0 adapters | optional_after_product_validation | Benefit: scale metrics only |

### 10.3 Smallest differentiating v1

**Alternative C + thin safety spine** (conflict, temporal label, deletion, export, Gateway, no adapters).

---

## 11. Current implementation feasibility matrix

| Target component | Current code | Preserve | Replace | New dependency | Migration difficulty | Operational dependency | Earliest safe phase | Key blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MemoryProvider port | `src/lib/memory/provider.ts` | yes evolve | — | — | low | — | private beta | — |
| Supabase pgvector retrieve | `supabase-provider.ts`, `match_memories` | yes as channel | extend | — | med | PG | private beta | single-channel only |
| Mem0 hybrid | `mem0-provider.ts` | **no as-is** | harden or disable | — | med | Mem0 API | after harden | remote text L123–125 |
| Embeddings | `embeddings/index.ts` | yes | add registry | optional OpenAI | med | keys | private beta | dim lock |
| Chat orchestrator | `orchestration/chat.ts` | skeleton | TurnOrchestrator | — | high | — | private beta | Think duplicate |
| Think route | `api/think/route.ts` | intents | merge to TO | — | high | — | private beta | drift |
| Context prompt | `ai/context.ts` | identity allowlist | untrusted render | — | high | — | public beta | injection surface |
| Extraction | `memory/extraction/*` | schema bits | Gateway pipeline; **remove inventing fallback** | — | high | model | private beta | heuristic L147–149 |
| Profile | `profile.ts`, profiles table | yes | stop memory force-merge | — | med | — | private beta | chat.ts L98–111 |
| Documents | `documents/*` | yes | async later | — | med | storage | private beta | sync timeout |
| RLS | `*_rls.sql` | yes | Gateway grants | — | high | — | private beta | browser mutate paths |
| Export | `api/export` | shape | widen semantics | — | med | — | public beta | incompleteness |
| Account delete | `api/account` | ordering idea | DeletionCoordinator | workers | high | Auth, storage, adapters | public beta | partial failure |
| message_context | chat store | interim | influence records | — | med | — | paid scale | schema |
| Assertions schema | none | — | new | migrations | very high | — | after Stage 17 | design amendments |
| durable_jobs | none | — | new | **worker platform** | very high | queue/worker host | public beta | Vercel limits |
| WRRF/packing | none | — | new | — | high | — | after MVA retrieve | uncalibrated |
| Entity graph | none | — | defer | maybe Neo4j later | very high | — | optional later | complexity |
| Tests | unit/integration memory | expand | eval harness | — | high | Supabase up | Stage 15 | missing oracles |

**Coexistence hazards:** profile force-merge + target eligibility; heuristic invent + candidate purity; Mem0 remote text + CE-2; dual Chat/Think; forever dual-write (rejected).

**Should Mem0 be disabled before target exists?** **Yes**, whenever `MEMORY_PROVIDER=mem0` can serve remote text; safe retain only with ID-only reconciliation and tests — not current default path.

**Impractical in pure Next/Vercel/Supabase without extras:** long-running Graphiti/Neo4j, large reindex, multi-step deletion sweeps, continuous workers — needs Stage 16 worker topology.

---

## 12. Operational surface review

### 12.1 Native-only target (MVA)

| Element | Minimum |
| --- | --- |
| Processes | Next.js web; 1 worker pool consuming `durable_jobs` |
| Queues | Postgres outbox |
| DBs | Supabase Postgres + Storage |
| External APIs | OpenRouter (chat), optional OpenAI embeds |
| Secrets | Supabase, OpenRouter, OpenAI |
| Monitoring | API error rate, job lag, deletion workflow age, extract propose rate |
| Backups | PG PITR; storage versioning policy |
| Deploy units | Web + worker |
| On-call domains | Web, PG, worker, inference vendor |
| Recovery | Replay jobs; rebuild embeddings from canonical text |

### 12.2 Native + Mem0 OSS

Adds: Mem0 service/API, mapping repair, dual-write lag monitors, purge verifier, vendor SEV status. **On-call +1–2 domains.**

### 12.3 Native + Graphiti

Adds: Python workers, Neo4j (or equivalent), projection rebuild, hop-policy monitors. **On-call +2 domains; likely unacceptable for solo founder.**

### 12.4 Native + managed connectors

Adds: OAuth token store, connector sync workers, vendor DPA, scope monitors. Acceptable **after** core if single vendor.

### 12.5 Native + all optional adapters

Web + workers + Mem0 + Graphiti/Neo4j + reranker + connectors + multi-embed vendors. **Unacceptable operational surface for small team** — failure point for adapter enablement policy.

**Cutoff:** Enable at most **one** optional adapter class post-validation; never Graphiti+Mem0+connectors simultaneously for initial release.

---

## 13. Privacy and deletion proof obligations

| Claim | Proof obligation | Current evidence | Missing evidence | Failure consequence | Stage 15 test | Production telemetry |
| --- | --- | --- | --- | --- | --- | --- |
| user-owned memory | Only user/Gateway paths change trust; export shows ownership | proposed status; manual remember | Gateway; undo UX metrics | Fake ownership | Trust mutation matrix | trust_transition_total |
| private memory | No cross-user read; disclosure enforced | RLS tests `tests/memory.test.ts` | disclosure svc; provider log proof | Breach / vendor leak | IDOR + disclosure suite | cross_user_deny_total; external_call_purpose |
| complete deletion | Terminal workflow; derived purge; backups policy | account route best-effort | coordinator; backup erase SOP; audit redaction | Residual personal data | delete-then-search all stores | deletion_workflow_terminal_ratio |
| complete export | Round-trip semantic package documented | partial JSON export | revisions/conflicts/decisions | Lock-in / loss | export schema validate | export_completeness_flag |
| model independence | Same eligibility across models | routing exists | packing invariance tests | Vendor lock theatre | S35 suite | memory_set_hash_by_model |
| provider independence | Swap inference without schema change | OpenRouter abstraction | extraction pin story | Drift | provider swap drill | — |
| safe fallback | Native-only quality/safety floor | mock chat offline | chaos without adapters | Silent wrong mode | S18–S19 | adapter_down_native_ok |

**Areas requiring privacy/legal review (not legal conclusions):** backup retention vs erasure; transcript retain after “forget”; provider subprocessors; BYOK; residual identifiability after redaction; cross-border embeddings.

---

## 14. Decision register

| Decision ID | Source | Decision | Status | Reason | Required amendment | Downstream impact |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | 07/13 | PostgreSQL canonical authority | **uphold** | Survives all serious alternatives except F (defer) | Enforce via Gateway; not slogan | All stages |
| D02 | 08/09 | Assertion model orthogonal | **amend** | Full orthogonality premature | Ship thin spine; keep separation trust≠confidence | 08/09/10 |
| D03 | 08 | Trust axes (3 positions) | **uphold** | Necessary minimum | — | — |
| D04 | 08/09 | Lifecycle/review enums full | **defer** | UX overload | Collapse user-visible states | 09 |
| D05 | 08 | Temporal representation rich | **amend** | Need current/historical now; full modality later | Thin temporal v1 | 12 packing |
| D06 | 08/12 | Conflict representation | **uphold_with_clarification** | Dual-truth ban stands | Budget deadlock policy | 12 |
| D07 | 08/09 | Provenance model | **amend** | Conflicts with erasure | Erasable vs tombstone fields | deletion |
| D08 | 09/12 | Influence records full | **defer** | Start from message_context | Basic explainability first | 09§8.23 |
| D09 | 07/09 | Deletion coordinator | **uphold** | Current path insufficient | Define terminal + backup policy | 09/16 |
| D10 | 11 | Entity identity canonical operational | **defer** | Premature | Text mentions OK | 11/12 |
| D11 | 11 | Relationship projection | **defer** | Premature | — | 11 |
| D12 | 07/11/13 | Graph DB deferral | **uphold** | Ops surface | Keep rejected as required | PoC-B later |
| D13 | 10 | Extraction proposals | **uphold** | — | Kill inventing heuristic | extraction |
| D14 | 08/10 | Confirmation model | **uphold_with_clarification** | — | Sensitive always explicit | UX |
| D15 | 10 | Deduplication | **uphold** | — | Suppress≠destroy provenance | 10 |
| D16 | 10 | Consolidation auto | **defer** | Risk | — | — |
| D17 | 12 | Hybrid retrieval | **amend** | Full multi-channel premature | semantic+lexical(+identity) v1 | 12 |
| D18 | 12 | WRRF formula family | **uphold_with_clarification** | Multiplicative bound good | Constants versioned via Stage 15 | 12/13 |
| D19 | 12 | Bounded policy λ=0.15 | **defer** as sacred constant | Uncalibrated | `retrieval_policy_version` | 12 |
| D20 | 12/13 | Reranking optional noop | **uphold** | — | — | PoC-C |
| D21 | 12 | Query disclosure | **uphold** | — | Implement before adapters | 12 |
| D22 | 12 | Evidence disclosure | **uphold** | — | Deadlock UX | 12 |
| D23 | 12 | Provider candidate planning | **defer** multi-provider | Premature | Single provider pack v1 | 12 |
| D24 | 12 | Context packing hierarchical | **uphold_with_clarification** | — | Determinism scoped | 12 |
| D25 | 12 | Document coverage modes | **defer** advanced | Labels required if any | Honest incompleteness | 12 |
| D26 | 13 | External framework ports | **uphold** as interfaces | — | Disabled in v1 | 13 |
| D27 | 13 | Recommendation B | **uphold_with_required_amendments** | Direction yes; scope no | B-ports + native-only enablement | all |
| D28 | 13 | Current Mem0 disposition | **amend** → **disable until hardened** | Live invariant break | Remove remote-text; default off | code later |
| D29 | 07/13 | Model/provider independence | **uphold_with_clarification** | Provider swap ≠ interpretation stability | Pin extraction; CE-12 | 10/12 |

---

## 15. Required amendments (correction backlog)

| correction_id | severity | affected | exact problem | required normative change | why clarification insufficient | dependencies | owner stage | before 15? | before 16? | before 17? | class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COR-01 | blocking | 13 Rec B; 07–12 scope | v1 scope = full 8–12 | Adopt MVA cut (§10); adapters disabled | Scope drives eng years | — | 14→16 | **yes** | yes | yes | blocking_before_stage15 |
| COR-02 | blocking | 12 determinism language | E2E determinism false | Scope determinism to frozen candidates+versions | Tests would be wrong | CE-12 | 14→15 | yes | yes | yes | blocking_before_stage15 |
| COR-03 | blocking | 09/07 deletion vs provenance | Complete deletion vs retained fact text | Erasure field policy | Safety/privacy claims | legal review | 14→15 | yes | yes | yes | blocking_before_stage15 |
| COR-04 | blocking | 12 required evidence | Plan deadlock underspecified | Terminal UX + billing rule | Product harm | D06 | 14→15 | yes | yes | no | blocking_before_stage15 |
| COR-05 | blocking | Mem0 current | Remote text path | Disable/harden ID-only | Live contradiction | A01 | 16/17 | no (test design yes) | **yes** | **yes** | blocking_before_stage16 |
| COR-06 | high | 10 vs code | Heuristic invent fallback | Ban for conversational semantic | Pollutes vault | A16 | 16/17 | test yes | yes | yes | blocking_before_stage17 |
| COR-07 | high | 05/12 | Profile force-merge | Retire always-include | Eligibility invariant | — | 16 | no | yes | yes | blocking_before_stage16 |
| COR-08 | high | 12 WRRF constants | Sacred uncalibrated | Versioned calibration | False precision | D19 | 15 | yes (as non-sacred) | yes | no | blocking_before_stage15 |
| COR-09 | high | 11 graph v1 | Premature normative | Defer entity graph from v1 | Complexity | D10 | 16 | yes | yes | yes | blocking_before_stage15 |
| COR-10 | high | 08/10 import | Trust-from-metadata tension | Stage 10 wins | Safety | C13 | 14 note | yes | yes | yes | blocking_before_stage15 |
| COR-11 | med | 09 influence full | Overbuilt | Phase explainability | Delivery | D08 | 16 | no | yes | no | blocking_before_stage16 |
| COR-12 | med | 12 multi-provider plans | Premature | Single-provider v1 | Ops | D23 | 16 | yes | yes | yes | blocking_before_stage15 |
| COR-13 | med | C9 workers | No worker platform | Stage 16 prerequisite | Adapters otherwise fantasy | — | 16 | no | yes | yes | blocking_before_stage16 |
| COR-14 | med | S13-I1 vs red-team | Eval cannot redefine 7–12 | Allow explicit correction register | Process deadlock | — | 14 | yes | no | no | blocking_before_stage15 |
| COR-15 | low | 13 §20.4 cite | Broken reference | Fix citation in later docs PR | Auditability | — | docs chore | no | no | no | non_blocking_clarification |
| COR-16 | med | Audit payloads | May retain content | Hash/id only post-purge | C1 | S37 | 15/16 | yes | yes | no | blocking_before_stage15 |
| COR-17 | low | Roadmap 00 statuses | Stale pending flags | Update in docs hygiene PR | Process | — | later | no | no | no | accepted_debt |

---

## 16. Risk acceptance register

| risk | why accepted | scope | expiration/review | telemetry | rollback trigger | owner |
| --- | --- | --- | --- | --- | --- | --- |
| Provider logs retain prompts | Vendor opacity; DPA not architecture | all external inference | every vendor change | external_call_purpose counts | drop vendor | privacy owner |
| Under-merging entities | Safer than over-merge | deferred graph | when entity features start | — | — | product |
| Optional channel answer churn | Prefer degrade vs fail-open | retrieval | after public beta metrics | answer_stability | disable channel | retrieval |
| Embedding inversion theoretical | Low practicality; secret blocking | embeds | annual | secret_block_total | — | security |
| Native eng slower than vendor demo | Differentiates on ownership | strategy | after private beta learning | activation | — | founder |
| Thin temporal ≠ full modality | Ship labels first | v1 | when temporal error rate high | temporal_mislabel_rate | deepen model | memory |
| No reranker v1 | Quality maybe lower | ranking | after NDCG baseline | — | PoC-C | retrieval |
| Heuristic offline-only (non-chat) | Offline demo utility | mock mode | when mock≠prod confusion | — | disable | eng |

Reject mitigations costing more than risk: e.g. full event-sourcing before deletion proofs fail; Graphiti for hop queries before entity demand exists; multi-provider planning before enterprise disclosure demand.

---

## 17. Stage 15 handoff — prioritized tests

| test_id | finding_ids | hypothesis | fixture | oracle | metric | threshold | failure interpretation | env | before impl | during PoC | before release | pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T15-001 | A01,S11 | Remote text can enter context | Mem0 hits w/o cv_memory_id | zero context without canonical row | inject_count | 0 | CE-2 broken | mock Mem0 | yes | yes | yes | P0 |
| T15-002 | A16,C16 | Heuristic invents on timeout | force timeout | empty or non-invent | invented_facts | 0 in chat mode | extraction unsafe | unit | yes | no | yes | P0 |
| T15-003 | A12,C6,COR-04 | Conflicts dual-stated or deadlock silent | two trusted opposites | no dual settled; explicit degrade | dual_truth_rate | 0 | packing unsafe | sim | yes | yes | yes | P0 |
| T15-004 | C1,S37,COR-03 | Audit retains deleted fact | delete assertion | audit scan no raw fact | residual_text | 0 | erasure false | integration | yes | no | yes | P0 |
| T15-005 | S03,S38 | Delete vs worker race | job+delete | no republish | resurrect_count | 0 | deletion unsafe | integration+worker | no | yes | yes | P0 |
| T15-006 | S29 | Cross-user retrieve | two users | deny | idor_success | 0 | RLS/provider fail | integration | yes | yes | yes | P0 |
| T15-007 | A17,S05 | PDF injection | malicious PDF | no policy change; secrets dropped | inject_success | 0 | processing unsafe | integration | yes | yes | yes | P0 |
| T15-008 | A45,S16 | Embed space mix | two models one index | query reject or separate | cross_space_queries | 0 | correctness break | integration | yes | yes | yes | P0 |
| T15-009 | S01,A24 | Correction stickiness | retract+repeat | no silent revive | revive_rate | 0 | authority fail | sim | yes | yes | yes | P0 |
| T15-010 | S07,S31 | Disclosure fail-open | local_only evidence | no external send | leak_count | 0 | privacy fail | unit | yes | yes | yes | P0 |
| T15-011 | D18,A35 | WRRF policy domination | adversarial ranks | \|Final-WRRF\|≤λ·WRRF; WRRF0⇒0 | domination | hold | formula broken | unit | yes | yes | yes | P1 |
| T15-012 | S35,D29 | Cross-model memory set | same vault two models | same eligible IDs | set_hamming | 0 | independence theatre | sim | yes | yes | yes | P1 |
| T15-013 | S04,C21 | Export completeness | mid-migration | watermark or block | false_complete | 0 | portability false | integration | yes | no | yes | P1 |
| T15-014 | S18 | Workers down | pause workers | chat ok; lag visible | chat_success | ≥99% | durability design fail | chaos | no | yes | yes | P1 |
| T15-015 | S19 | PG down Mem0 up | PG errors | no Mem0-only truth | native_bypass | 0 | adapter authority | chaos | no | yes | yes | P1 |
| T15-016 | A33,S30 | Chunk flood | 1e6 chunks | latency SLO / quota | p95_ms | budget | scale fail | soak | no | yes | yes | P2 |
| T15-017 | A18,A19 | Dedupe quality | paraphrase+near-miss | precision/recall bands | F1 | set later | merge policy | offline | yes | yes | yes | P2 |
| T15-018 | S12,A25 | Entity homonym | two Alex | no auto-merge | false_merge | 0 | graph unsafe | unit | yes | yes | no | P2 |
| T15-019 | S36 | Queue fatigue | high propose rate | batch tools / rate limit | confirm_randomness | low | UX fail | sim | yes | no | yes | P2 |
| T15-020 | A39,S09 | Tokenizer mismatch | estimate vs exact | bounded retries | unbounded_loop | 0 | packing fail | unit | yes | yes | yes | P1 |
| T15-021 | S22 | Explainability leak | embarrassing fact | redacted explain | sensitive_explain | 0 | privacy | integration | yes | no | yes | P0 |
| T15-022 | S23 | Forget vs history | forget memory | history channel policy | memory_via_history | policy | product ambiguity | integration | yes | no | yes | P1 |
| T15-023 | S39,COR-10 | Hostile import | trusted flags in JSON | candidates only | import_trust_grant | 0 | safety | unit | yes | no | yes | P0 |
| T15-024 | A37 | Required evidence deadlock | oversize required | explicit invalid plan | silent_drop | 0 | COR-04 | unit | yes | yes | yes | P0 |
| T15-025 | profile force-merge | Always-include bypass | irrelevant profile mem | relevance rules | forced_irrelevant | 0 target | eligibility | unit | yes | no | yes | P1 |

**Counts:** P0 = 14; P1 = 8; P2 = 3 (expandable). Stage 15 should convert this table into the evaluation framework directly.

---

## 18. Stage 16 handoff

1. **Sequencing changes:** MVA spine before WRRF full; deletion coordinator before adapters; worker platform before Graphiti/Mem0 OSS; disclosure before any external index/rerank.
2. **Move earlier:** disable Mem0 remote-text; remove inventing heuristic; TurnOrchestrator; thin assertions; deletion workflow; export watermark.
3. **Move later:** entity graph, multi-provider plans, full influence, connectors, rerank, WRRF extra channels, auto consolidation.
4. **Remove from v1 normative:** Graphiti requirement; sacred λ; full orthogonal enums as launch gate.
5. **Migration safeguards:** expand/contract; memories projection; no forever dual-write; generation watermarks on export.
6. **Ops prerequisites:** worker host; job lag alerts; deletion SLA alerts; backup/erasure SOP (**legal review**).
7. **Still prohibited:** vendor as canonical; remote-text authority; browser trust grants; cross-user entity graphs.
8. **PoCs still justified:** none for private beta; PoC-A only after native MVA metrics; PoC-D connectors after retention need.
9. **PoCs cancel/defer:** PoC-B Graphiti deferred until entity demand; PoC-C until NDCG plateau.
10. **Max optional-adapter surface initial release:** **zero enabled**; ports may exist as noops.

---

## 19. Stage 17 handoff — first safe PR boundaries

**Must prove:** a narrow, reversible foundation toward CE-* without enabling adapters or claiming Stage 8–12 completeness.

**May change (when Stage 17 specifies):** docs-approved dark schema additive migrations; feature-flagged code paths off by default; tests; observability hooks without raw secrets.

**May not change:** production default behaviour without flag; enable Mem0; broaden trust auto-grant; delete Stages 0–13; add Graphiti/Neo4j deps; implement full WRRF as required path.

**Required rollback:** feature flag off; migrate expand/contract down.

**Required tests:** T15-001/002/006 style unit tests applicable to the PR surface.

**Required observability:** flag state; no raw memory text in logs.

**Migration safety:** additive only; no drop of `memories`.

**Max surface:** single architectural concern (e.g. “disable remote-text” OR “additive assertion table dark” — not both + workers).

**Dependency additions:** forbidden unless Stage 17 explicitly lists.

**Dark/disabled behaviour:** preferred.

**Blockers to close first:** COR-01 accepted; COR-02 language; COR-05 plan for Mem0; COR-14 correction-register process.

---

## 20. Final verdict

### 20.1 Choice

```text
approve_with_required_amendments
```

### 20.2 Detail

1. **Verdict:** approve_with_required_amendments.
2. **Highest-severity confirmed findings:** A01 Mem0 remote-text; A12/A37 conflict×budget deadlock; A45 embed drift without registry; A16 inventing extraction vs target; A56 overbuild before learning; C1 deletion×provenance.
3. **Upheld:** D01 PG canonical; D03 trust triad; D09 deletion coordinator; D13 proposals; D15 dedupe principles; D20 rerank noop; D21–22 disclosure ownership; D26 ports-as-interfaces; CE-1…CE-9, CE-13…CE-15 core.
4. **Amended:** Rec B scope; determinism claims; deletion completeness language; assertion orthogonality breadth; hybrid channel breadth; Mem0 disposition → disable-until-hardened; provenance erasure; import trust (10 over 8); S13-I1 via correction register; S13-I10 scope.
5. **Reversed:** “Full Stage 8–12 surface is v1 architecture”; sacred λ=0.15 as unversioned truth; entity graph as near-term normative; multi-provider planning as v1; optional adapters enabled for initial release.
6. **Deferred:** Graphiti/PoC-B; rich lifecycle enums; full influence; auto consolidation; connectors; event-sourcing F; advanced coverage modes.
7. **Accepted risks:** §16 table.
8. **Remaining unknowns:** vendor log retention empirically; backup erasure legal; residual redaction identifiability; true eng cost of workers on chosen host; whether thin MVA suffices for retention.
9. **Recommendation B survives?** **Yes, with required amendments** (`upheld_with_required_amendments`): ports + native-only enablement + MVA cut.
10. **Minimum viable architecture:** §10.1 / Alternative C + thin safety spine.
11. **Stage 15 may begin?** **Yes**, after accepting COR-01,02,03,04,08,09,10,12,14,16 as the correction register inputs.
12. **Preconditions for Stage 15:** this document reviewed; correction register acknowledged; no implementation.
13. **Stage 16 later?** Yes, after Stage 15 framework exists; not now.
14. **Implementation prohibited?** **Yes** until Stages 15 and 17 approved per roadmap gate.

---

## 21. Required acceptance questions (answers)

1. **Internally coherent?** Partially — core PG authority coherent; full surface over-specified and self-tensioned.
2. **Real contradictions?** C1, C4, C6, C8, C9, C13, C16, C21 (and related) — see §5.
3. **Untestable requirements?** Absolute model noncompliance with injection; “complete” deletion including uncontrolled backups without policy; E2E determinism.
4. **Unenforceable?** Provider-side log deletion; model obedience; vendor metadata always present.
5. **Excessive for v1?** Full enums, entity graph, multi-provider plans, WRRF 11 channels, influence completeness, adapters.
6. **Missing safety?** Explicit deletion residual policy; audit redaction; hostile import harden; deadlock UX; disable live Mem0 path.
7. **Overbuilt safety?** Full orthogonal lifecycle before threat-model proof; graph safety machinery pre-graph.
8. **PG canonical enforceable?** Yes iff Gateway + no remote-text + workers respect deletion — not automatically.
9. **Derived disposable?** Only with rebuild tests and zero authority leakage — currently false for Mem0.
10. **External scores → trust?** Not as trust field; yes as ranking influence — must keep CE-4 presentation-clear.
11. **Corrections propagate?** Designed yes; unproven under races/adapters — Stage 15.
12. **Deletion under partial failure?** Not with current code; target needs proofs.
13. **Export meaningful?** Only if redefined as canonical package with limitations.
14. **Model independence maintainable?** Provider independence yes; interpretation stability only with pins + tests.
15. **Embedding spaces isolated?** Designed yes; not implemented.
16. **Provider planning deterministic?** Only given frozen inputs — amend claims.
17. **Required evidence × disclosure deadlock?** Yes possible — COR-04.
18. **Conflicts always fit budget?** No — need reserve + invalid plan path.
19. **Merges reversible?** Design yes; ops no at scale — defer auto-merge.
20. **Graph necessary?** Not for v1 differentiation.
21. **Trust model comprehensible?** Full orthogonal no; triad yes.
22. **Review queue usable?** Not if heuristic flood remains.
23. **Influence worth complexity?** Basic yes; full schema later.
24. **Current Mem0 safe temporarily?** **No** with remote-text path.
25. **Disable Mem0 before migration?** **Yes** until hardened.
26. **Rec B biased?** Partially — gates encode native core; adapter half less evidenced.
27. **Native cost understated?** Yes (workers, eval, migration).
28. **Managed benefits understated?** For connectors yes; for memory authority no.
29. **Optional adapters become mandatory?** Likely if demoed early — policy must prevent.
30. **Operable by small team?** Full A no; MVA B/C yes.
31. **Fails first at 1k users?** Review queue noise; sync extract latency; support at wrong memories.
32. **At 10k?** DB load on retrieve; job lag; deletion ops; embed cost.
33. **At 100k?** Need sharding/caps/adapters or search infra; worker throughput; reindex windows.
34. **Cheapest safe v1?** Alternative C + thin spine §10.
35. **Smallest differentiating v1?** User-confirmed atomic memories + docs retrieve + model-swappable chat.
36. **Remove?** Graph-as-normative; sacred uncalibrated channel zoo; enabled adapters.
37. **Defer?** Entity/relationship, connectors, rerank, multi-provider, auto consolidation, full influence.
38. **Stage 15 prove?** CE-2/4/7/8/10/12; deadlock; deletion residual; import; cross-model eligibility.
39. **Stage 16 sequence?** Workers + MVA + deletion before adapters; disclosure before external calls.
40. **Stage 17 forbid?** Behavioural defaults enabling adapters; remote-text; broad schema drops; dependency sprawl.
41. **Rec B survive?** Yes, amended.
42. **Stage 15 begin?** Yes after correction register acceptance.

---

## 22. Final consistency checks

Searched mentally/structurally for banned complacent phrases. Confirmations:

1. Repository facts separated via tables and evidence classes — **yes**.
2. Confirmed blockers have causal evidence (code lines / contradictions) — **yes**.
3. Rejected attacks explained (e.g. A43) — **yes**.
4. Recommendation B genuinely challenged (§9) — **yes**.
5. ≥50 attacks — **56** — **yes**.
6. ≥35 scenarios — **40+** — **yes**.
7. Major decisions dispositioned (§14) — **yes**.
8. All 33 Stage 13 invariants reviewed (§6.2) — **yes**.
9. Complexity reduction considered (§4, §10) — **yes**.
10. Counterfactuals strong (§9) — **yes**.
11. Feasibility assessed (§11) — **yes**.
12. Privacy/deletion proof obligations (§13) — **yes**.
13. Amendments explicit (§15) — **yes**.
14. Accepted risks explicit (§16) — **yes**.
15. Stage 15 tests trace to findings (§17) — **yes**.
16. Stage 16 constraints trace (§18) — **yes**.
17. Stage 17 constraints trace (§19) — **yes**.
18. Verdict follows evidence (§20) — **yes**.
19. Report self-contained — **yes**.
20. Only this file intended to change — **enforced by PR scope**.
21. No implementation added — **yes**.
22. Stages 0–13 untouched — **yes**.
23. Stage 15 not started — **yes**.
24. PR remains draft — **process requirement**.

### Phrase discipline notes

- Avoided treating “canonical therefore safe,” “optional therefore harmless,” “managed therefore reliable,” “OSS therefore portable.”
- “Deterministic” narrowed via COR-02/CE-12.
- “Complete deletion/export” treated as proof obligations, not slogans.
- “Model/provider independent” split into testable claims.
- Recommendation B, Mem0, Graphiti, WRRF, trust, conflict, disclosure, outbox, idempotent, rollback, accepted risk, rejected attack — all appear with adversarial treatment.

---

## 23. Appendix — Key repository citations

| Claim | Path | Lines | Behaviour |
| --- | --- | --- | --- |
| Mem0 remote-text fallback | `src/lib/memory/mem0-provider.ts` | 119–125, 274–295 | If no `cv_memory_id`, map hits via `toRetrievedMemory` |
| Profile force-merge | `src/lib/orchestration/chat.ts` | 98–111 | Active profile memories similarity=1 |
| Heuristic invent fallback | `src/lib/memory/extraction/index.ts` | 139–150 | On timeout/error, heuristic extract |
| Account deletion order | `src/app/api/account/route.ts` | 34–53 | removeAll → storage → deleteUser |
| System prompt interpolation | `src/lib/ai/context.ts` | 132–183 | Memories/chunks into system prompt |
| Provider selection | `src/lib/memory/index.ts` | getMemoryProvider | mem0 vs supabase |
| EMBEDDING_DIM | `src/lib/embeddings/index.ts` | 3 | 1536 fixed |
| Documents maxDuration | `src/app/api/documents/route.ts` | export maxDuration=60 | Sync processing limit |

---

## 24. Appendix — Recommendation B amended statement (normative for later stages)

```text
Amended Recommendation B*:

Final:
  Native PostgreSQL-backed canonical core (MVA spine).
  Cortaix owns trust, lifecycle (thin), disclosure, packing,
  deletion/export, and retrieval eligibility.

Ports preserved but disabled for initial release:
  ExternalMemoryIndexPort
  RelationshipProjectionPort / EntityProjectionPort
  RetrievalReranker (noop)
  ConnectorIngestionPort

Enablement rule:
  Zero adapters enabled until native MVA metrics + Stage 15 gates pass.
  At most one adapter class thereafter.
  Depth ≤ 1.

Not selected:
  Any vendor as canonical memory or agent runtime.
  Graphiti/Neo4j as near-term dependency.
  Full Stage 8–12 surface as private-beta scope.
```

---

*End of Stage 14 red-team review.*
