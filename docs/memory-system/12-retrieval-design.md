# 12 — Hybrid Retrieval, Reranking, and Context Design

> **Role:** Stage 12 Hybrid Retrieval, Reranking, and Context Architecture Designer  
> **Scope:** Complete target retrieval and context-construction architecture for Cortaix: query planning, multi-channel candidate generation, canonical reconciliation, eligibility, hybrid fusion/reranking, deduplication, conflict-safe selection, token-aware packing, untrusted rendering, disclosure-aware provider interaction, provenance, and degradation.  
> **Constraints:** Documentation and architecture design only. No production TypeScript, React, API routes, migrations, executable SQL, application prompts, tests, dependencies, configuration, environment variables, provider integrations, or runtime feature flags. Does not edit Stages 0–11. Does not begin Stages 13–17. Does not select a Stage 13 framework or vendor.  
> **Prior docs:** [`00-roadmap.md`](./00-roadmap.md), [`01-repository-map.md`](./01-repository-map.md), [`02-current-memory-flow.md`](./02-current-memory-flow.md), [`03-database-rls-audit.md`](./03-database-rls-audit.md), [`04-extraction-audit.md`](./04-extraction-audit.md), [`05-retrieval-context-audit.md`](./05-retrieval-context-audit.md), [`06-security-failure-audit.md`](./06-security-failure-audit.md), [`07-target-architecture.md`](./07-target-architecture.md), [`08-memory-model.md`](./08-memory-model.md), [`09-technical-design.md`](./09-technical-design.md), [`10-memory-processing-design.md`](./10-memory-processing-design.md), [`11-entity-relationship-design.md`](./11-entity-relationship-design.md).

Stages **1–11** are treated as **complete** even where `00-roadmap.md` status text lags. Prior reports are **not** edited. Where Stage 12 needs a capability Stages 9–11 did not define, this document records a clearly labelled **amendment request**. Binding prior-stage decisions are preserved unless repository evidence shows an actual contradiction.

---

## Legend (evidence classes)

| Label | Meaning |
| --- | --- |
| **Verified** | Observed directly in current repository source, migrations, or tests. |
| **Binding prior decision** | Normative choice from Stages 7–11 that Stage 12 must preserve. |
| **Stage 12 decision** | New technical decision owned by this stage. |
| **Tradeoff** | Cost accepted for a Stage 12 decision. |
| **Assumption** | Reasonable premise not proven by live production metrics. |
| **Unknown** | Cannot be resolved from audits/design alone; later stages or runtime must answer. |
| **Deferred** | Intentionally left to a later stage or product decision. |
| **Amendment request** | Capability missing from Stage 9 or 11; recorded here without editing those docs. |

Citations use repository paths and prior-stage section references as of this design.

---

## 1. Executive summary

### Verdict

Cortaix’s target retrieval architecture is **Option B — multi-channel candidate generation, weighted reciprocal-rank fusion (WRRF), then deterministic policy rescoring**, followed by **canonical reconciliation-first eligibility**, **conflict-safe grouping**, **hierarchical reserve-then-fill token packing**, and **structured untrusted context rendering**.

PostgreSQL remains the sole authority for memory assertions, ownership, trust, lifecycle, disclosure, entity identity, relationship user decisions, and operational coordination. Embeddings, FTS documents, graph projections, and external indexes are **derived and rebuildable**. Every search hit reconciles to current canonical state before ranking. Ranking never grants trust. Disclosure never yields to relevance. Retrieved text is always **untrusted data**, never system instructions.

### Why Option B

| Need | Option A linear hybrid | **Option B WRRF + policy** | Option C cross-encoder | Option D LLM judge |
| --- | --- | --- | --- | --- |
| Determinism | Medium (score-scale fragile) | **High** | Medium–low without pin | Low |
| Explainability | Medium | **High** (rank + features) | Opaque score | Opaque |
| Provider independence | High | **High** | Needs reranker model | Needs LLM |
| Offline/degraded | Weak if vectors dominate | **Strong** (FTS/exact survive) | Fails without reranker | Fails without LLM |
| Injection exposure | Low | **Low** | Medium | **High** |
| Cost / latency | Low | **Low–medium** | High | Highest |
| Over-engineering | Medium | **Proportionate** | High for current scale | Excessive |

Option C may later sit behind `RetrievalReranker` as an **optional** second stage. Option D is rejected for v1. Option A loses because heterogeneous channel scores (cosine, FTS rank, exact match, graph overlap) do not share a stable linear scale without heavy calibration.

### Pipeline (one user turn)

```text
rawQuery + turnId + userId + model/selection hints
        │
        ▼
 RetrievalPlanner → RetrievalQueryPlan (once)
        │
        ▼
 HybridCandidateRetriever (parallel channels, shared query embedding)
        │
        ▼
 CanonicalEligibilityService (reconcile + gate; scores cannot override)
        │
        ▼
 CandidateFusionService (WRRF) → policy rescoring → Deduplicator → ConflictContextService
        │
        ▼
 DisclosureContextPlanner (sensitivity summary → compatible provider class)
        │
        ▼
 ContextPacker (model-specific token budget, hierarchical reserve-then-fill)
        │
        ▼
 ContextRenderer (structured ContextPackage → provider adapter)
        │
        ▼
 InfluenceRecorder (selected + budget-drop + conflict groups; ids/scores/codes)
```

### Headline Stage 12 decisions

1. **Architecture:** Option B WRRF + deterministic policy rescoring; optional reranker interface unused for correctness.  
2. **Policy version:** `retrieval_policy_version = "rp-v1.0"`.  
3. **Query plan:** Deterministic rules first; optional structured model assistance cannot grant trust, widen ownership, bypass disclosure, or silently pick ambiguous entities/projects.  
4. **Graph expansion v1:** **Zero-hop default**; **one bounded hop** only for `entity_focused` / `relationship_focused` via Stage 11 contracts to supporting assertions — never friend-of-friend.  
5. **Disclosure order:** Option B — build disclosure summary → select compatible provider/model → pack to that window.  
6. **Packing:** Hierarchical reserve-then-fill with group minima/maxima and utility-per-token fill.  
7. **History:** Complete eligible turns with reserved recent-turn budget; no orphan/failed turns; optional derived summaries never become trusted memory.  
8. **Identity:** Not unconditional inject-everything; direct name/identity short-circuits may bypass expensive retrieval when deterministic.  
9. **External indexes:** IDs only → canonical map → eligibility; **no remote-text fallback**.  
10. **Amendments:** Compact JSONB expansions on `response_influence_records` and `conversation_turns.retrieval_snapshot`; optional `retrieval_policy_version` column; conversation-turn eligibility fields if missing.

### Completeness

Stage 12 is **internally complete** for architecture review and Stage 13/15 handoff. It does **not** implement behaviour. Stage 13 may begin **after** architecture review of this document.

---

## 2. Verified current repository behaviour

Evidence class: **Verified** unless noted. Sources: Stage 5 audit plus re-inspection of listed files for this stage.

### 2.1 End-to-end Think / Chat flow

| Step | Behaviour | Evidence |
| --- | --- | --- |
| Entry | `/api/think` is primary UI; `/api/chat` → `runChatOrchestrator` | `src/app/api/think/route.ts`, `src/lib/orchestration/chat.ts` |
| Intent | Think classifies intent; retrieval for question/instruction paths | `src/lib/think/intent.ts` |
| Memory | Provider `retrieve` limit **8**, then app filter `similarity ≥ 0.05` | `chat.ts` |
| Profile boost | Up to **10** active `type=profile` rows forced at similarity **1.0**; **no `expires_at` filter** on this query | `chat.ts` / Think route |
| Documents | `match_document_chunks` limit **3**, similarity ≥ 0.05; **no `documents.status='ready'`** in SQL | `20260720000007_functions.sql`, `documents/retrieve.ts` |
| Identity | `display_name`, `persona` (persona capped 500) | `src/lib/ai/context.ts` |
| History | Last **10 messages** by `created_at`, not complete turns | `conversation/store.ts` |
| Prompt | Memories/chunks interpolated into system-adjacent USER CONTEXT | `ai/context.ts` |
| Provenance | `message_context` stores memory/chunk + relevance only | `20260720000004_chat.sql` |
| Think UI | `ThinkingView` + `ResponseInfoButton` show date/model/`memoryRegistered`, **not** retrieved context | components |
| Chat UI | `ChatView` expandable “Why does the AI know this?” | `ChatView.tsx` |

### 2.2 Ranking signals today

| Signal | Used in chat retrieval? |
| --- | --- |
| Cosine similarity / Mem0 score | **Yes — sole semantic rank** |
| Confidence, source, sensitivity, recency, pin | **No** (pin sorts Vault lists only) |
| FTS | **No** (ILIKE vault search UI only) |
| Conflict / temporal / modality | **No** |
| Entity / relationship / project entity | **No** |
| Token budget | **No** — fixed counts + char caps; `contextChars` is a length proxy for router long-context heuristic (`24_000`) |

### 2.3 Memory providers

- Default: `SupabaseMemoryProvider` → embed query → `match_memories`.  
- Mem0 mode: search Mem0 by `user_id`; prefer hits with `cv_memory_id` rehydrated from Supabase; **if no hit has any CV id, return remote text directly** (**Correctness risk**, Stage 5).  
- Mem0 API errors do **not** fall back to Supabase semantic search.  
- Query embedding may be generated separately for memories and documents (**duplicate embed risk**).

### 2.4 Documents

- Chunk size **1000**, overlap **150**.  
- Upload marks `processing` → chunk/embed → `ready` / `failed`.  
- Chunks insert **before** status flips to ready → narrow pre-ready retrieval window exists.  
- Prompt excerpt cap **500** chars per chunk.  
- No dedicated `match_document_chunks` tests found.

### 2.5 What is already solid

- `match_memories` filters `auth.uid()`, `status='active'`, non-null embedding, non-expired.  
- Proposed/rejected/archived/deleted excluded from pgvector path.  
- Profile∩semantic merge dedupes by memory **id**.  
- Identity allowlist + `directIdentityAnswer` for name questions.  
- Cross-user `match_memories` isolation integration-tested.

---

## 3. Binding prior-stage constraints

These are **Binding prior decisions**. Stage 12 does not reopen them.

### 3.1 Canonical authority (Stages 7, 9)

1. PostgreSQL is canonical for assertions, ownership, provenance, trust, lifecycle, disclosure, entity identity, relationship user decisions, and operational coordination.  
2. Embeddings, FTS, graph projections, and external memory services are derived and rebuildable.  
3. External search results must never inject remote text directly.  
4. External hits must map to canonical IDs and pass canonical eligibility before use.

### 3.2 Trust and eligibility (Stages 8, 9)

1. Candidates are not trusted facts.  
2. Review rejection is not distrust.  
3. `distrusted` means user repudiation / confirmed false.  
4. Historical assertions may remain trusted.  
5. Archived, deleted, purge-pending, purged assertions do not enter ordinary assistant context.  
6. Superseded assertions are not current truth.  
7. Confidence, similarity, entity resolution, and graph association are **not** trust.  
8. Pinning may boost relevance but cannot bypass eligibility.

### 3.3 Temporal and conflict (Stages 8, 11)

1. Current / historical / prospective / ended remain distinguishable.  
2. Temporal bounds and claim modality remain separate.  
3. Uncertain, conditional, hypothetical, planned claims are not settled facts.  
4. Unresolved assertion conflicts are not silently resolved.  
5. `conflict_open` relationship episodes remain queryable and participating but must be shown as conflicted.  
6. Historical episodes are not presented as current.  
7. Multiple episodes are not collapsed into one fact.

### 3.4 Security and privacy (Stages 6–10)

1. Personal memory is user-scoped; workspace membership cannot widen access.  
2. Retrieved memories, documents, history, entities, and relationships are untrusted data.  
3. Forbidden secrets never reach retrieval.  
4. Storage permission ≠ provider-disclosure permission.  
5. Provider-restricted data may be local-only.  
6. Logs and durable-job payloads must not contain raw private context by default.

### 3.5 Stage 11 graph rules

1. Assertions remain canonical facts; entities are canonical operational identity; relationship series/episodes/support/relations are derived; user decisions are canonical operational.  
2. Graph retrieval uses Stage 11 `EntityQueryPort` contracts.  
3. Ambiguous project labels are not resolved arbitrarily.  
4. Entity redirects are followed.  
5. Relationship series must be reconciled before Stage 12 consumes them.  
6. Dense episode relations use participating episodes: `episode_state IN ('active','conflict_open')`.  
7. `rebuild_pending` is incomplete and not context-safe.  
8. Pairwise episode relations do not grant assertion trust.

### 3.6 Stage 9 retrieval persistence contract

Stage 12 consumes ownership, trust, review, temporal phase/bounds, modality, organisation, retention, succession, conflict, sensitivity/disclosure, pin, scope, revision, embedding space/state, and provenance identifiers — and **must not bypass them**.

---

## 4. Current retrieval failures Stage 12 must solve

Mapped from Stage 5 + re-verification:

| # | Failure | Stage 12 remedy |
| --- | --- | --- |
| 1 | Cosine is sole semantic ranking signal | Multi-channel WRRF + policy features |
| 2 | Profile memories forced into every prompt | Identity/profile as relevance channel + reserved budget only when needed |
| 3 | Profile retrieval ignores expiry | Canonical eligibility includes temporal bounds / expiry |
| 4 | Confidence/source/sensitivity/recency/pin unused | Explicit boost/penalty features (never trust) |
| 5 | Contradictions injected as equal facts | ConflictContextGroup presentation |
| 6 | Paraphrase duplicates waste budget | Assertion-family + near-paraphrase dedupe |
| 7 | Memory + document copy of same fact twice | Cross-channel dedupe with source diversity |
| 8 | Overlapping chunks repeated | Chunk overlap / adjacency merge rules |
| 9 | History by message count | Complete-turn eligibility + token budget |
| 10 | Failed/orphaned user turns in history | Exclude non-`replied` / incomplete turns |
| 11 | No product-level token budget | `ContextBudget` from model metadata |
| 12 | `contextChars` inaccurate vs final request | Token estimator + packing decision record |
| 13 | Retrieved text system-adjacent | Structured untrusted `ContextRecord`s |
| 14 | External fallback remote text | IDs-only + reconcile; drop unmapped |
| 15 | Document ready not required | Ready-document gate in eligibility |
| 16 | Duplicate query embeddings | One reusable embedding per space per turn |
| 17 | Think UI incomplete provenance | Influence records + UI handoff contract |
| 18 | Influence cannot explain rank/eligibility/drops | Extended influence snapshot (amendment) |
| 19 | Entities/relationships absent | Stage 11 channels |
| 20 | No current/historical/prospective/uncertain distinction | Query plan temporal modes + eligibility + labels |

---

## 5. Retrieval architecture alternatives

### 5.1 Option A — Weighted linear hybrid score

Normalize per-feature scores into `[0,1]` and compute `Σ w_i · f_i`.

| Criterion | Assessment |
| --- | --- |
| Correctness | Good if calibrated; fragile across FTS vs cosine scales |
| Determinism | High given fixed weights |
| Explainability | Feature contributions readable |
| Latency / cost | Low |
| Provider independence | High |
| Failure behaviour | Vectors out → must reweight; easy to mis-tune |
| Privacy / injection | Low exposure |
| Over-engineering | Medium calibration burden |
| Suitability | Acceptable but weaker than rank fusion for heterogeneous channels |

### 5.2 Option B — Rank fusion + deterministic policy rescoring (**selected**)

Each channel produces an independent ranked list. Fuse with **weighted reciprocal-rank fusion**, then apply deterministic boosts/penalties, diversity, conflict grouping.

| Criterion | Assessment |
| --- | --- |
| Correctness | Strong for multi-channel recall without forcing score commensurability |
| Determinism | High under pinned `retrieval_policy_version` |
| Explainability | Channel ranks + fused rank + policy deltas |
| Latency / cost | Low–medium; parallel channels |
| Provider independence | High |
| Failure behaviour | Drop failed channel; fuse remaining |
| Privacy / injection | No model sees candidates before packing |
| Compatibility | Native to PostgreSQL + pgvector + FTS |
| Over-engineering | Proportionate |

### 5.3 Option C — Two-stage with cross-encoder / model reranker

Broad deterministic recall, then expensive semantic rerank.

| Criterion | Assessment |
| --- | --- |
| Correctness | Potentially highest relevance quality |
| Determinism | Depends on model pin; often weaker |
| Explainability | Weak without feature logging |
| Latency / cost | High |
| Provider independence | Compromised if required |
| Failure behaviour | Needs safe fallback = Option B |
| Injection | Reranker sees candidate text |
| Suitability | Optional later; **not** v1 correctness path |

### 5.4 Option D — LLM judge over candidates

| Criterion | Assessment |
| --- | --- |
| Correctness | Unstable; circular (judge needs context) |
| Determinism | Poor |
| Cost / latency | Highest |
| Injection | **Severe** — candidates can instruct the judge |
| Provider independence | Broken |
| Verdict | **Rejected** for v1 and as correctness dependency |

### 5.5 Selection

**Stage 12 decision:** Option B is primary v1. `RetrievalReranker` exists as an optional interface defaulting to no-op / identity. Correctness, eligibility, disclosure, and packing must not require it.

---

## 6. Selected architecture

### 6.1 Components and ownership

| Component | Owner domain | Role |
| --- | --- | --- |
| `RetrievalPlanner` | Turn Orchestrator / Retrieval | Build `RetrievalQueryPlan` once |
| `HybridCandidateRetriever` | Retrieval | Fan-out channels |
| `CanonicalEligibilityService` | Memory CAS + Disclosure | Reconcile + gate |
| `CandidateFusionService` | Retrieval | WRRF + policy score |
| `RetrievalReranker` | Retrieval (optional) | No-op in v1 |
| `CandidateDeduplicator` | Retrieval | Multi-level dedupe |
| `ConflictContextService` | Retrieval + Memory model | Groups + presentation |
| `ConversationHistorySelector` | Conversation | Complete turns |
| `DisclosureContextPlanner` | Disclosure + Routing | Provider class + filter |
| `ContextPacker` | Retrieval | Token budget packing |
| `ContextRenderer` | Inference adapters | Structured → provider messages |
| `InfluenceRecorder` | Explainability | Persist influence |

### 6.2 Authoritative vs derived channels

| Channel | Authority of **text** | Authority of **hit** |
| --- | --- | --- |
| Canonical assertion semantic/FTS/exact | Canonical revision text | Derived index hit |
| Document chunk semantic/FTS | Canonical chunk text (ready doc) | Derived |
| Entity / relationship | Supporting **assertion** text only | Derived graph |
| Project | Supporting assertions via `project_entity_id` | Operational entity |
| Identity fields | Account profile fields (local) | Account store |
| Conversation | Canonical messages for eligible turns | Conversation store |
| External index | **None** — IDs only | Derived; must reconcile |

### 6.3 End-to-end invariants (preview)

See §33 for the full invariant list. Non-negotiable: score ≠ trust; external ≠ text authority; disclosure not overridden; packing reproducible under policy version.

---

## 7. Query planning

### 7.1 `RetrievalQueryPlan`

Produced **once per user turn**. Provider-independent.

```ts
type IntentMode =
  | 'general'
  | 'personal_recall'
  | 'identity'
  | 'current_state'
  | 'historical'
  | 'prospective'
  | 'uncertain_or_options'
  | 'project_scoped'
  | 'document_focused'
  | 'entity_focused'
  | 'relationship_focused'
  | 'conversation_recall'
  | 'memory_management';

type TemporalMode = 'current' | 'historical' | 'prospective' | 'ended' | 'unknown';

type RetrievalQueryPlan = {
  userId: string;
  turnId: string;
  rawQuery: string;

  intentMode: IntentMode;
  /** Primary modes requested; may include multiple when ambiguous. */
  requestedTemporalModes: TemporalMode[];

  /** Resolved only — never guessed from ambiguous labels. */
  projectEntityIds: string[];
  entityIds: string[];
  relationshipTypes: string[];
  documentIds: string[];
  referencedFilenames: string[];

  lexicalQueries: string[];
  semanticQueryText: string;
  embeddingSpace?: string; // pinned space id when embeddings used

  requiresPersonalContext: boolean;
  requiresConversationHistory: boolean;
  requiresDocumentEvidence: boolean;
  requiresGraphEvidence: boolean;

  disclosurePurpose: 'chat_inference';

  /** Stage 12 additions */
  planConfidence: 'high' | 'medium' | 'low';
  ambiguityFlags: Array<
    | 'ambiguous_project'
    | 'ambiguous_entity'
    | 'uncertain_intent'
    | 'uncertain_temporal'
  >;
  allowExpensiveChannels: boolean;
  directAnswerHint?: 'identity_name' | 'identity_persona' | null;
  memoryManagementAction?: 'none' | 'remember' | 'forget' | 'correct' | 'review';
  plannerVersion: string; // e.g. "planner-v1.0"
};
```

### 7.2 How the plan is produced

**Stage 12 decision — hybrid deterministic planner with optional structured assist:**

1. **Deterministic rules (required):**
   - Identity patterns (“what is my name”, “who am I”) → `identity`, `directAnswerHint='identity_name'`.  
   - Temporal cues (“before”, “used to”, “in 2024”, “previously”) → include `historical` / `ended`.  
   - Prospective cues (“plan to”, “will”, “next month”) → `prospective`.  
   - Uncertainty cues (“might”, “options”, “should I”) → `uncertain_or_options`.  
   - Explicit document/filename references → `document_focused`, populate `referencedFilenames` / attachment ids.  
   - “What did we discuss / decide” → `conversation_recall`.  
   - Explicit memory commands → `memory_management` (retrieval may still run for grounding corrections).  
   - General knowledge with no personal markers and `requiresPersonalContext=false` → skip personal channels (still allow history if needed for discourse).  
2. **Existing references:** attachment document ids, session project bindings, prior turn entity ids in `retrieval_snapshot`.  
3. **Stage 11 resolution:** `resolveEntityId`, `resolveProjectScopeLabel` — on `ambiguous`, set ambiguity flag and **do not** invent ids.  
4. **Optional structured model assistance:** may propose `intentMode`, lexical expansions, entity mention strings. **Forbidden:** granting trust, widening `userId`, setting disclosure true, selecting among ambiguous projects/entities, injecting remote facts.  
5. **Model-free fallback:** if assist fails or `planConfidence='low'`, use broad personal recall with `requestedTemporalModes` including `current` (+ `unknown`), enable memory+document+history channels, keep graph optional.

### 7.3 Uncertain classification

When intent is uncertain:

- Prefer **recall over silence** for personal questions (`requiresPersonalContext=true`) with medium channel limits.  
- Prefer **no personal retrieval** for clear general-knowledge questions.  
- Never silently bind ambiguous entities/projects; return ambiguity groups to packing.  
- Temporal uncertainty → include `current` and allow historical as secondary (lower policy weight unless cues present).

### 7.4 Direct identity short-circuit

**Stage 12 decision:** Deterministic direct answers for allowlisted identity fields (display name, and narrowly scoped persona questions where product policy allows) may **bypass expensive multi-channel retrieval** while still recording influence for the identity field used. If memory assertions **conflict** with profile fields, do **not** short-circuit; run full retrieval and emit a conflict group.

---

## 8. Retrieval channels

Channels run **independently** and preferably **in parallel**. Each returns ranked candidate stubs (ids + channel scores/ranks). Private text is loaded after eligibility when possible.

### 8.0 Shared rules

| Rule | Decision |
| --- | --- |
| Parallelism | All enabled channels start together |
| Shared embedding | Exactly **one** query embedding per `(turnId, embeddingSpace)` reused by memory + document semantic channels |
| Cross-space scores | Forbidden |
| Channel timeout | Soft deadline per channel; late results dropped with degradation marker |
| Auth | Always scoped to `userId`; RLS + explicit filters |
| Required vs optional | See §28 |

### 8.A Canonical memory assertions

| Subchannel | Method | Notes |
| --- | --- | --- |
| `memory_semantic` | `memory_embeddings` join current revision, `state='ready'`, pinned space | Cosine / distance → similarity |
| `memory_fts` | `memory_fts_documents` tsvector | Lexical rank |
| `memory_exact` | Normalized exact / phrase match on `content_text` / `normalised_content` | Highest lexical precision |

Filters applied at generation or immediately after (still subject to eligibility gate):

- Content-kind filters from plan  
- Scope / `project_entity_id` when resolved  
- Entity-grounded filters via Stage 11  
- Temporal phase prefilter aligned to `requestedTemporalModes` (soft — gate enforces)  
- Source/provenance constraints when document-focused  

**Limits (v1):** semantic top **32**, FTS top **32**, exact top **16**.

### 8.B Documents

| Subchannel | Method |
| --- | --- |
| `document_semantic` | `document_chunk_embeddings` ready + matching `content_sha256` |
| `document_fts` | Chunk FTS / lexical (derived; see amendment if table absent) |
| `document_exact` | Filename / document id targeting from plan |

**Hard requirements before use:**

1. Document `status='ready'`.  
2. Chunk belongs to `userId`.  
3. Embedding ready + fingerprint match when semantic.  
4. Soft-deleted / purge documents excluded.

**Modes:**

- Normal Q&A: top chunks by fusion.  
- Summarization (“summarise this PDF”): prefer section-diverse coverage of the targeted document; raise document channel weight; still pack under budget.  
- Filename targeting: boost that `documentId`.

**Limits:** semantic **24**, FTS **24**, max **8** chunks considered per document before diversity.

Overlap-aware handling: see §14.

### 8.C Entities

Use Stage 11 only:

- `listAssertionsForEntity` / `listEntitiesForAssertion` / `listAssertionsForEntities`  
- `resolveEntityId` (follow redirects)  
- Kind filters; self entity; project entity resolution  

Entity overlap is a **relevance feature**, never trust.

**Ambiguity:** multiple entities for one mention → `ambiguous_entity` conflict/ambiguity group; do not pick.

**Unresolved mentions:** contribute **only** via raw assertion text channels, not as entity filters (**answers Stage 11 Q4**).

**Limit:** up to **64** assertion refs from entity channel before eligibility.

### 8.D Relationship series and episodes

Use Stage 11:

- `listRelationshipSeries` / `listRelationshipEpisodes`  
- `explainRelationshipEpisode` / `listEpisodeRelations` / user decisions  
- Only `series_state IN ('active','conflict_open')` with dense completeness  

Relationship rows are **not** independent factual truth. Context ultimately cites **supporting eligible assertions**.

**Graph expansion v1 (Stage 12 decision):**

| Query mode | Expansion |
| --- | --- |
| Default / general / personal_recall | **Zero hop** — no automatic neighbourhood walk |
| `entity_focused` | **One hop:** entity → grounded assertions (and optional series listing for display metadata) |
| `relationship_focused` | **One hop:** series → episodes → supporting assertions; include `conflict_open` with badge |
| Friend-of-friend / two-hop | **Forbidden in v1** |

Justification: safest correctness boundary; prevents trust laundering through graph paths; matches Stage 11 “association ≠ trust”.

If series is `rebuild_pending` / `inactive`: mark `graph_incomplete` degradation; do not invent relations; missing relation ≠ `disjoint`.

### 8.E Project context

1. Resolve via `resolveProjectScopeLabel` or session binding.  
2. On `ambiguous` → ambiguity group; **no silent pick**.  
3. On resolved → `listAssertionsForProjectEntity`.  
4. Distinguish active vs ended project entities via temporal class on related episodes/assertions.  
5. Project relevance **never** becomes ACL authority.

### 8.F Conversation history

See §20. Channel emits recent eligible complete turns as candidates of kind `conversation_turn`. Optional older-turn semantic recall when `conversation_recall` or plan requires.

### 8.G Account identity

Separate layers:

| Layer | Always local? | Provider request? |
| --- | --- | --- |
| Account display name | Yes | Only when identity-relevant or short-circuit |
| Persona | Yes (capped) | Only when style/identity-relevant |
| Trusted identity assertions | Via memory channels | When eligible + relevant |
| Self entity | Via Stage 11 | Metadata / filters |
| Style preferences | Via memory channels | When relevant |
| Sensitive identity | Local subject to disclosure | Only if disclosure allows |

**Not** an unconditional inject-everything channel.

Conflicts between profile fields and trusted identity assertions → conflict group, not silent profile win in multi-signal mode (note: current code prefers structured identity for name questions — target preserves short-circuit only when no conflicting trusted assertion exists).

### 8.H External derived indexes

1. External service returns **IDs only** (+ opaque remote score for channel rank).  
2. Map via `external_memory_index_entries` → `assertion_id` / `revision_id`.  
3. Reload canonical assertion + eligibility.  
4. Unmapped / wrong user / deleted → drop; mark stale index.  
5. **No remote-text fallback** (closes current Mem0 gap).  
6. Timeout → degrade to PostgreSQL channels.  
7. No cross-embedding-space comparison.

---

## 9. Canonical reconciliation

After candidate generation and **before** ranking fusion finalization, every candidate maps to a canonical target + current revision.

### 9.1 Reconciliation steps (assertions)

1. Confirm `user_id` matches request.  
2. Load canonical assertion.  
3. Confirm current revision exists and matches indexed `revision_id` when from embedding/FTS/external.  
4. Attach disclosure policy, succession, temporal, modality, organisation, retention, trust, review.  
5. Resolve entity redirects on attached entity ids.  
6. Resolve project ambiguity — if still ambiguous, outcome `ambiguous_scope`.  
7. For graph-derived stubs, replace with supporting assertion refs (retain graph provenance).

### 9.2 Documents

Map chunk → document → verify ownership, `ready`, fingerprint, embedding state.

### 9.3 Conversation / identity

Map to turn ids / allowlisted profile fields; no assertion trust implied.

### 9.4 Stale index handling

If indexed revision ≠ current revision → `stale_index` (ineligible for ordinary context; may trigger async rebuild, not blocking for other candidates).

---

## 10. Eligibility gate

A search score **never** overrides this gate.

### 10.1 Outcomes

```text
eligible                 — may rank as ordinary current/settled evidence for the plan
eligible_with_warning    — eligible but carry warning (e.g. low embedding freshness metadata)
eligible_historical      — eligible only as historical / comparison evidence
eligible_conflicted      — eligible only inside a conflict group presentation
local_only               — eligible for local UX / packing into local-only plans; not for external provider
ineligible               — excluded; reason code required
stale_index              — derived hit out of date; exclude from context
ambiguous_scope          — cannot safely use until disambiguated
```

### 10.2 Assertion checklist (all must pass for `eligible`)

1. Correct `user_id`.  
2. Canonical assertion exists.  
3. Current revision exists and matches indexed revision.  
4. Trust eligible for intended use (`trusted` for settled personal facts; candidates never as trusted truth).  
5. Review state eligible (rejected candidates out).  
6. Retention `present`.  
7. Organisation `visible` for ordinary assistant context.  
8. Succession valid for requested temporal mode (superseded → not current; may be `eligible_historical`).  
9. Temporal phase/bounds fit plan modes.  
10. Modality fits plan (uncertain/planned not settled unless `uncertain_or_options` / prospective).  
11. Conflict represented safely (`eligible_conflicted` or grouped — never silent settled dual).  
12. Disclosure allows intended provider/channel (`local_only` if inference denied).  
13. Embedding/FTS index version current enough when that channel produced the hit.  
14. Source deletion policy respected.  
15. Entity redirects / project ambiguity resolved safely.

### 10.3 Closed exclusion reason codes

```text
wrong_user
missing_canonical_row
stale_revision
candidate_not_trusted
distrusted
review_rejected
archived
deleted
purge_pending
purged
superseded_for_current
temporal_mode_mismatch
modality_mismatch
conflict_not_settled
disclosure_denied
provider_restricted
stale_embedding
ambiguous_project
ambiguous_entity
document_not_ready
source_deleted
quarantined
graph_incomplete
fingerprint_mismatch
embedding_space_mismatch
turn_incomplete
turn_failed
turn_denied
```

### 10.4 Document / turn / identity specifics

| Kind | Extra gates |
| --- | --- |
| Document chunk | `document_not_ready`, fingerprint mismatch, ownership |
| Conversation turn | Must be complete `replied` (or product-equivalent success); exclude denied/failed/orphan |
| Identity field | Allowlist only; sensitivity/disclosure |

---

## 11. Candidate model

```ts
type RetrievalChannel =
  | 'memory_semantic'
  | 'memory_fts'
  | 'memory_exact'
  | 'document_semantic'
  | 'document_fts'
  | 'document_exact'
  | 'entity'
  | 'relationship'
  | 'project'
  | 'identity'
  | 'conversation'
  | 'external_index';

type CanonicalKind =
  | 'assertion'
  | 'document_chunk'
  | 'identity_field'
  | 'conversation_turn'
  | 'conflict_notice'
  | 'ambiguity_notice';

type EligibilityDecision = {
  outcome:
    | 'eligible'
    | 'eligible_with_warning'
    | 'eligible_historical'
    | 'eligible_conflicted'
    | 'local_only'
    | 'ineligible'
    | 'stale_index'
    | 'ambiguous_scope';
  reasonCodes: string[];
  warnings: string[];
  snapshot: Record<string, string | boolean | number | null>; // ids/flags/codes only
};

type RetrievalScoreFeatures = {
  semanticSimilarity?: number;      // 0..1
  ftsRank?: number;                 // normalized 0..1
  exactLexical?: number;            // 0 or 1
  entityOverlap?: number;
  projectMatch?: number;
  relationshipMatch?: number;
  temporalCompatibility?: number;
  sessionRelevance?: number;
  sourceAuthority?: number;         // user_asserted/confirmed boost band — not trust grant
  pinBoost?: number;
  userConfirmationBoost?: number;
  recencyScore?: number;
  historicalRelevance?: number;
  modalityFit?: number;
  confidenceWeak?: number;          // weak only
  conflictPenalty?: number;
  sensitivityPenalty?: number;      // ranking only; disclosure separate
  duplicatePenalty?: number;
  sameSourcePenalty?: number;
  chunkOverlapPenalty?: number;
  pageProximityBonus?: number;
  previouslyUsedPenalty?: number;
  feedbackScore?: number;           // Deferred product
};

type RetrievalProvenance = {
  channels: RetrievalChannel[];
  channelRanks: Partial<Record<RetrievalChannel, number>>;
  channelScores: Partial<Record<RetrievalChannel, number>>;
  supportingAssertionIds?: string[];
  relationshipSeriesId?: string;
  relationshipEpisodeId?: string;
  entityIds?: string[];
  externalProvider?: string;
  externalId?: string;
  embeddingSpace?: string;
  embeddingVersionHint?: string;
};

type RetrievalCandidate = {
  candidateId: string; // stable: `${canonicalKind}:${canonicalId}[:${subId}]`
  userId: string;
  channel: RetrievalChannel; // originating; fused candidates retain multi-channel provenance
  canonicalKind: CanonicalKind;

  assertionId?: string;
  assertionRevisionId?: string;
  documentId?: string;
  documentChunkId?: string;
  entityIds?: string[];
  relationshipSeriesId?: string;
  relationshipEpisodeId?: string;
  turnIds?: string[];
  identityField?: 'display_name' | 'persona';

  eligibility: EligibilityDecision;
  rawChannelRank: number;
  rawChannelScore?: number;
  scoreFeatures: RetrievalScoreFeatures;
  provenance: RetrievalProvenance;

  /** Text loaded late when possible */
  contentRef?: { table: string; id: string };
};
```

### 11.1 Stable identity and multi-channel fusion

- Same assertion from semantic+FTS+entity → **one** candidate; merge provenance channel ranks.  
- Same chunk from FTS+vector → one candidate.  
- Graph expansion pointing at assertion A merges into assertion A candidate with `relationship` / `entity` provenance.  
- Revision advance invalidates candidate ids tied to old `assertionRevisionId`.  
- Selected text loaded after finalist IDs when feasible; operational logs store ids/scores/codes only.

---

## 12. Hybrid fusion and reranking

### 12.1 Method (exact v1)

**Stage 12 decision:**

1. Per channel, keep top-N candidates that are not `ineligible` / `stale_index` (conflicted/historical/local_only retained with flags).  
2. Compute **Weighted Reciprocal Rank Fusion**:

\[
\mathrm{WRRF}(c) = \sum_{ch \in channels(c)} w_{ch} \cdot \frac{1}{k + r_{ch}(c)}
\]

where \(r_{ch}(c)\) is 1-based rank in channel `ch`, \(k=60\) (standard RRF constant), \(w_{ch}\) from §13.

3. Compute **policy score**:

\[
\mathrm{Policy}(c) = \mathrm{clip}\Big(
  b_{pin} + b_{confirm} + b_{source} + b_{temporal} + b_{project} + b_{entity} + b_{session}
  - p_{dup} - p_{conflict} - p_{overlap} - p_{sensitive} - p_{prev}
  + 0.05 \cdot \mathrm{confidenceWeak}
\Big)
\]

clipped to `[-1.0, +1.0]`.

4. Final score:

\[
\mathrm{Final}(c) = \mathrm{WRRF}(c) + \lambda \cdot \mathrm{Policy}(c)
\]

with \(\lambda = 0.15\) (policy cannot dominate fusion).

5. Optional `RetrievalReranker` may reorder within the top **M=40** finalists **without** changing eligibility or disclosure. Default = identity.

6. Apply diversity / dedupe / conflict grouping (§14–15).  
7. Select top finalists for packing (not yet token-truncated).

### 12.2 Hard filters vs ranking features

| Signal | Role |
| --- | --- |
| Ownership, trust, retention, organisation, disclosure, ready doc, revision match | **Hard filter** |
| Temporal/modality mismatch vs plan | **Hard filter** (or route to historical/conflicted outcome) |
| Semantic, FTS, exact, entity overlap, project match, pin, confirmation, recency, confidence | **Boost / weak boost** |
| Duplicate, overlap, conflict-as-settled attempt, same-source spam | **Penalty** |
| Pin, confidence, similarity, graph edge | **Must never grant trust** |
| Any score | **Must never override disclosure** |

### 12.3 Calibration

All numeric weights in §13 are **initial calibration constants**, versioned under `retrieval_policy_version`, changeable without changing canonical memory semantics. Stage 15 owns empirical calibration.

### 12.4 Special ranking rules

- Recency must **not** bury durable identity / standing preferences: identity/preference kinds receive `b_source` floor when temporally compatible.  
- When plan requests historical, do **not** apply current-phase penalty to historical candidates; use `historicalRelevance`.  
- Pin boosts rank but **cannot force inclusion** if ineligible or crowded out by higher-utility diverse evidence under packing minima.

---

## 13. Initial ranking constants

**`retrieval_policy_version`: `rp-v1.0`**  
**`planner_version`: `planner-v1.0`**

### 13.1 Channel weights \(w_{ch}\)

| Channel | Weight | Justification |
| --- | --- | --- |
| memory_exact | 1.00 | Highest precision lexical |
| memory_fts | 0.85 | Strong lexical |
| memory_semantic | 0.80 | Core semantic recall |
| document_exact | 0.90 | Explicit file targeting |
| document_fts | 0.75 | Lexical evidence |
| document_semantic | 0.70 | Semantic evidence |
| entity | 0.65 | Relevance evidence only |
| relationship | 0.60 | Via supporting assertions |
| project | 0.65 | Scope relevance |
| identity | 0.70 | When identity-relevant |
| conversation | 0.55 | Discourse continuity |
| external_index | 0.50 | Derived; must reconcile |

### 13.2 Limits and deadlines

| Constant | Value | Notes |
| --- | --- | --- |
| `k_rrf` | 60 | Standard RRF |
| `lambda_policy` | 0.15 | Policy blend |
| `channel_limit_memory_semantic` | 32 | |
| `channel_limit_memory_fts` | 32 | |
| `channel_limit_memory_exact` | 16 | |
| `channel_limit_document_semantic` | 24 | |
| `channel_limit_document_fts` | 24 | |
| `channel_limit_entity_assertions` | 64 | |
| `channel_limit_relationship_assertions` | 48 | |
| `channel_limit_external` | 32 | |
| `finalist_limit_pre_pack` | 40 | |
| `per_channel_deadline_ms` | 250 | Soft |
| `global_retrieval_deadline_ms` | 800 | Soft conceptual budget |
| `min_similarity_floor` | 0.12 | Post-gate weak filter for semantic-only weak hits (**calibration**) — exact/FTS exempt |
| `max_assertions_per_family` | 2 | Dedupe |
| `max_chunks_per_document` | 4 | Diversity |
| `max_chunks_per_section` | 2 | |
| `near_paraphrase_similarity` | 0.92 | Calibration; Stage 15 |

### 13.3 Policy boosts / penalties (additive before clip)

| Feature | Symbol | v1 value | Notes |
| --- | --- | --- |
| Pin | `b_pin` | +0.20 | Not force-include |
| User confirmation authority | `b_confirm` | +0.15 | `user_confirmed` / `user_corrected` |
| User asserted | `b_source` | +0.10 | |
| Temporal fit | `b_temporal` | +0.15 | |
| Project match | `b_project` | +0.12 | Resolved entity only |
| Entity overlap | `b_entity` | +0.10 | |
| Session relevance | `b_session` | +0.08 | |
| Confidence weak | — | +0.05 × conf | Never authority |
| Duplicate family | `p_dup` | −0.25 | |
| Unresolved conflict if mis-presented | `p_conflict` | −0.30 | Prefer grouping over raw penalty alone |
| Chunk overlap | `p_overlap` | −0.20 | |
| High sensitivity (rank only) | `p_sensitive` | −0.05 | Disclosure separate |
| Previously used same session | `p_prev` | −0.05 | Mild diversity |

### 13.4 What Stage 15 must calibrate

Similarity floor, near-paraphrase threshold, channel weights, λ, pin boost, chunk maxima, and latency deadlines.

---

## 14. Deduplication and diversity

### 14.1 Assertion-level

| Case | Policy |
| --- | --- |
| Same assertion, many channels | Merge to one candidate |
| Multiple revisions | Keep current revision only (historical query may keep prior as `eligible_historical` separately keyed) |
| Merged assertions | Follow survivor id |
| Superseded | Exclude as current; optional historical |
| Near-paraphrase (sim ≥ 0.92, same kind, overlapping temporal) | Keep highest Final; others penalty / drop from pack |
| Distinct scopes or temporal periods | **Do not merge** |

**Duplicate key (exact):** `assertion:{assertionId}:{assertionRevisionId}`  
**Family key:** `assertion_family:{rootAssertionId or assertionId}`

### 14.2 Memory ↔ document

| Case | Policy |
| --- | --- |
| Trusted assertion extracted from doc + same chunk | Prefer assertion for settled personal fact; keep **one** short document citation if user asked about the document or for provenance diversity |
| Manual assertion verbatim in PDF | Same |
| Memory summary + source assertions | Prefer atomic source assertions; summary only if atomic set insufficient (**Assumption**) |

### 14.3 Document chunks

| Case | Policy |
| --- | --- |
| Overlapping chunks | Prefer higher Final; apply overlap penalty; max per section |
| Adjacent same page | May **merge for packing** into one record if overlap ≥ 40% and same document |
| Lexical+semantic same chunk | Merge candidates |
| Headers/footers repeated | Penalty via overlap / low uniqueness (**Assumption** heuristic Deferred detail) |
| Page-neighbour expansion | Optional +1 neighbour if budget remains and plan document-focused |

### 14.4 Graph-derived repetition

Entity hit + relationship-support hit → same assertion candidate. Multiple episodes supported by same assertion → one assertion; episodes retained in provenance/conflict metadata.

### 14.5 Diversity caps

- Max **2** from one assertion family in packed context.  
- Max **4** chunks from one document; **2** per section.  
- Source diversity: attempt ≥1 non-document personal assertion when personal recall required and available.

**Dedup must never silently merge genuine conflicts or distinct temporal episodes.**

---

## 15. Conflict-safe representation

```ts
type CandidateReference = {
  candidateId: string;
  assertionId?: string;
  relationshipEpisodeId?: string;
  entityId?: string;
  projectEntityId?: string;
};

type ConflictContextGroup = {
  conflictId: string;
  kind: 'assertion_conflict' | 'relationship_conflict' | 'scope_ambiguity' | 'identity_conflict';
  members: CandidateReference[];
  presentation:
    | 'needs_user_decision'
    | 'historical_change'
    | 'multiple_valid_scopes'
    | 'uncertain';
  trustLabel: 'conflicted' | 'historical' | 'uncertain';
};
```

### 15.1 Case matrix

| Case | Behaviour |
| --- | --- |
| Two trusted current assertions in conflict | **include grouped conflict evidence** (`needs_user_decision`) |
| Current vs historical versions | **include historical comparison** when query historical or correction; else current + optional notice |
| Superseded facts | **exclude** as current; include as historical when requested |
| Uncertain plans | **include** with `uncertain` label; not settled |
| Conditional facts | **include** with modality label |
| Relationship `conflict_open` | **include grouped** with conflict badge; supporting assertions eligible_conflicted |
| Multiple possible entities | **return ambiguity to caller** / pack ambiguity notice; **require user clarification** if answer depends on it |
| Multiple projects same label | **return ambiguity**; never silent select |

Do **not** rely on negative score alone.

The model must not receive two contradictory records formatted as two equally settled facts. Pack a `conflict_notice` record plus member records labeled `conflicted` / `historical` / `uncertain`.

---

## 16. Temporal and modality handling

| Plan mode | Prefer | Exclude as settled current |
| --- | --- | --- |
| `current_state` | `temporal_phase=current`, in-window | historical/ended/expired-as-present, prospective-as-present |
| `historical` | historical/ended + superseded as history | — |
| `prospective` | prospective/planned | — |
| `uncertain_or_options` | uncertain/conditional/hypothetical/planned | presenting them as asserted |
| mixed / unknown | current primary; historical secondary | silent collapse |

Labels on `ContextRecord`: `temporalLabel`, `trustLabel`.

---

## 17. Entity and relationship retrieval

Answers Stage 11 handoff questions:

1. **Blend without trust laundering:** graph/entity channels contribute ranks + features; eligibility still assertion-canonical; Final score cannot mark candidate trusted.  
2. **Historical vs current episodes:** list separately with temporal labels; never collapse multi-period series.  
3. **Disclosure-denied neighbourhoods:** supporting assertions failing disclosure become `local_only` / dropped from provider pack; entity metadata alone does not ship content.  
4. **Unresolved mentions:** assertion text channels only.  
5. **Multi-entity packing:** pack by Final utility under entity/relationship group budget; conflict/ambiguity notices reserved.  
6. **Ambiguous project:** pack `ambiguity_notice`; do not bind `projectEntityIds`.

---

## 18. Project retrieval

1. Session binding or explicit reference → resolve.  
2. `ambiguous` → ambiguity group.  
3. Resolved → filter/boost via `project_entity_id`.  
4. Active vs ended distinguished by linked assertion/episode temporal class.  
5. Never ACL.

---

## 19. Document retrieval

1. Require ready + ownership + fingerprint.  
2. Semantic + FTS + exact filename.  
3. Summarization mode: section diversity objective inside document cap.  
4. Q&A mode: precision chunks.  
5. Overlap merge rules §14.  
6. Document instructions quoted as document content (`untrustedData: true`).

---

## 20. Conversation history

### 20.1 Replace “last 10 messages”

**Stage 12 decision:** History is selected as **complete eligible turns**, not arbitrary messages.

### 20.2 Turn eligibility

Include only turns where:

- `user_id` matches  
- State is successfully completed (`replied` or product-equivalent)  
- Both user and assistant message ids present when the turn claims a reply  
- Not `denied` / `failed` / incomplete / orphan user message without assistant  
- Not conflicted fingerprint retries left incomplete  

### 20.3 Budget and pairing

| Decision | Choice |
| --- | --- |
| Recent complete turns always included? | **Yes, within reserved history budget** |
| History vs memory competition | History has **reserved** tokens; surplus history competes in fill phase |
| Older turns | Semantic recall when `conversation_recall` or explicit reference; else optional derived summary |
| Assistant messages | Included as part of complete turns |
| Unresolved user instructions | Prefer keep latest open instruction turns in reserve |
| Tool/system messages | Deferred until product supports tools; if present later, include only completed tool results as untrusted data |
| Session boundary | Default history = current session; cross-session only on conversation_recall / explicit |
| Derived summaries | Optional rolling summary candidates; **never** auto-trusted memory; must carry provenance; invalidate on new turns / edits; disclosure applies |

### 20.4 Worked sketch

Long thread 40 turns, budget 1200 history tokens:

1. Reserve 800 tokens for most recent complete turns (newest first until reserve fills).  
2. If `conversation_recall`, retrieve older matching turns into secondary fill (max 400).  
3. Else if summary exists and disclosure allows, pack one summary record ≤ 300 tokens in secondary.  
4. Orphan failed user turn excluded.

---

## 21. Identity retrieval

| Question | Decision |
| --- | --- |
| Always available locally | `display_name`, `persona` (and self entity id) |
| Enter provider request | When `intentMode=identity` or plan requires personal identity/style; else optional low priority |
| Deterministic direct answer | Name (and narrowly scoped identity) when no conflicting trusted assertion |
| Bypass expensive retrieval | Allowed on clean direct identity hit |
| Profile vs memory conflict | Conflict group; no silent single truth |

---

## 22. Disclosure-aware planning

### 22.1 Circular dependency resolution

Approaches:

| Option | Idea | Verdict |
| --- | --- | --- |
| A | Select provider first, discard denied context | Rejected — may pick incompatible provider and drop best evidence |
| **B** | Sensitivity/disclosure summary → compatible provider → pack | **Selected** |
| C | Multiple full context plans per provider class | Deferred — costly; B sufficient for v1 |

### 22.2 Order of operations

1. Candidate retrieval (channels may use embeddings only if `allow_embedding` for those items — embedding disclosure enforced at index build time per Stages 9–10; query embed uses non-secret query text).  
2. Local eligibility (including `local_only`).  
3. **Disclosure summary:** sensitivity classes + flags among finalists.  
4. Provider/model selection constrained by disclosure compatibility + capability metadata.  
5. Disclosure filtering for selected provider.  
6. Context packing to model window.  
7. Inference.

### 22.3 Flags

| Flag | Meaning |
| --- | --- |
| `allow_inference` | May enter provider prompt for chat inference |
| `allow_embedding` | May be embedded externally (index build; not Stage 12 write path) |
| `allow_external_index` | May sync to external index |
| BYOK | User-supplied keys still require disclosure flags; BYOK does not bypass user policy (**Assumption** aligned with Stage 7/9) |

### 22.4 Outcomes

| Situation | Behaviour |
| --- | --- |
| Best evidence cannot disclose to any available provider | Prefer local-only / direct deterministic answer if possible; else answer with reduced context + user-visible withhold notice |
| Compatible alternative provider exists | Router may prefer disclosure-compatible provider |
| Provider-restricted assertion | `local_only` or filter out for incompatible provider |
| Highly sensitive | Same; stricter defaults |
| User told of withhold? | **Yes** — user-facing explanation; not raw secret content |
| No-context fallback | General knowledge / clarify / ask user; never fail-open secrets |

---

## 23. Token-budget calculation

```ts
type ContextBudget = {
  modelContextWindowTokens: number;
  reservedOutputTokens: number;
  reservedSystemPolicyTokens: number;
  reservedCurrentUserTokens: number;
  availableContextTokens: number;
};
```

### 23.1 Sources

- Model capability metadata (registry) supplies `modelContextWindowTokens`.  
- `reservedOutputTokens`: conservative default **1024** or model-specific.  
- System policy estimate from renderer template.  
- Current user message tokenized.

\[
available = window - reservedOutput - reservedSystem - reservedCurrentUser
\]

### 23.2 Conservative behaviour

| Uncertainty | Behaviour |
| --- | --- |
| Tokenization unavailable | Use conservative char≈token ratio **1 token / 3 chars** for CJK-agnostic safety floor (**calibration**); prefer under-fill |
| Model metadata uncertain | Assume small window (**8192**) unless registry says otherwise |
| Estimator error | Leave **10%** safety margin inside availableContextTokens |

Character count is **not** authoritative.

---

## 24. Context packing

### 24.1 Packing alternatives

| Strategy | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Fixed channel quotas | Simple | Wastes budget; inflexible | Rejected as sole |
| Fully score-driven heap | Flexible | History/profile starvation risk | Rejected as sole |
| **Hierarchical reserve-then-fill** | Protects essentials; then utility fill | Slightly more complex | **Selected** |
| Knapsack utility/token | Optimal-ish | Heavier; similar to fill phase | Used inside fill |

### 24.2 Groups (priority order for reserves)

| # | Group | Min reserve (share of available) | Max share | Notes |
| --- | --- | --- | --- | --- |
| 1 | System + safety policy | accounted outside available | — | Separate |
| 2 | Current user message | accounted outside available | — | Separate |
| 3 | Essential recent conversation turns | 15% | 35% | Complete turns |
| 4 | Directly requested document evidence | 10% if document_focused else 0% | 40% | |
| 5 | Directly relevant trusted assertions | 20% if personal else 0% | 45% | |
| 6 | Entity/relationship evidence | 0–5% | 15% | |
| 7 | Project context | 0–5% | 10% | |
| 8 | Optional identity/style | 0–3% | 8% | Not always-on |
| 9 | Historical/secondary | 0% | 15% | |
| 10 | Conflict/ambiguity notes | 2% | 10% | Protected reserve |
| 11 | Provenance/citation labels | 1% | 5% | |

Unused reserve rolls into global fill by Final utility per token.

### 24.3 Utility per token

\[
U(c) = \frac{\mathrm{Final}(c) + \gamma \cdot \mathbf{1}_{essential}}{1 + tokens(c)}
\]

\(\gamma=0.1\) for items marked essential by plan (explicit doc request, conflict notice, etc.).

### 24.4 Truncation rules

| Kind | Truncation |
| --- | --- |
| Memory assertion | **No meaning-changing truncation.** If record exceeds remaining group budget, **skip** (drop with reason `budget_exceeded_atomic`) rather than cut mid-claim. Prefer shorter alternate candidate. |
| Document chunk | May truncate with explicit ellipsis marker at sentence boundary; or merge adjacent then truncate once |
| Conversation turn | Prefer whole turn; if too large, keep user side + shortened assistant with notice; never orphan partial user instruction silently |
| Identity persona | Hard cap (e.g. 120 tokens) |
| Conflict notice | Must fit; if not, drop lower-priority evidence first |

### 24.5 Edge cases

| Case | Behaviour |
| --- | --- |
| Essential item > group budget | Promote to fill using global budget; if still impossible, drop with user-visible limitation notice |
| No evidence fits | Empty retrieval context; answer generally / ask clarification |
| Very small window models | Raise similarity floor; keep conflict notices + top 1–2 assertions; shrink history aggressively |
| Very large windows | Still enforce diversity caps; do not dump entire vault |
| Tie-break | Higher WRRF, then exact match, then newer `last_confirmed_at`, then stable id |

Prevents: profile monopolies, one long memory crowding atomics, overlapping chunk floods, history monopolies, low-value graph displacing direct evidence, ignoring metadata overhead (citation labels counted).

---

## 25. Untrusted context rendering

### 25.1 Formatting options

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| One textual block | Simple | Weak typing | Fallback only |
| XML-like typed records | Clear boundaries | Model-dependent | Adapter OK |
| JSON records | Structured | Some models weaker | Adapter OK |
| Tool/result messages | Strong separation where supported | Not universal | Optional adapter |
| **Canonical structured package + adapters** | One internal truth | Need adapters | **Selected** |

```ts
type ContextRecord = {
  recordId: string;
  kind:
    | 'memory'
    | 'document'
    | 'identity'
    | 'conversation'
    | 'relationship'
    | 'conflict_notice'
    | 'ambiguity_notice';
  content: string;
  trustLabel: 'trusted' | 'historical' | 'uncertain' | 'conflicted' | 'local_only_notice';
  temporalLabel?: string;
  citationLabel: string; // e.g. "[M1]", "[D2]"
  sourceLabel?: string;  // user-facing, not DB jargon
  untrustedData: true;
  modalityLabel?: string;
};

type ContextPackage = {
  retrievalPolicyVersion: string;
  queryPlanSummary: {
    intentMode: IntentMode;
    temporalModes: TemporalMode[];
    ambiguityFlags: string[];
  };
  systemPolicyRef: string; // separate — not mixed into records
  records: ContextRecord[];
  conflictGroups: ConflictContextGroup[];
  degradation: RetrievalDegradation[];
  withheldNotices: Array<{ code: string; userMessage: string }>;
};
```

### 25.2 Rules

1. System policy remains separate from retrieved data.  
2. Retrieved text is data, never instructions.  
3. Document instructions are quoted as document content.  
4. Imperative memory text does not receive system authority.  
5. Provider tool-result roles may improve separation but are not required for correctness.  
6. Plain-text fallback remains safe and explicit (`UNTRUSTED_CONTEXT_DATA` fences + labels).  
7. Filenames, titles, aliases, metadata are untrusted strings.  
8. Avoid raw internal DB jargon in model-facing text.

**Formatting alone does not eliminate prompt injection.** Residual risk remains; Stage 15 must run adversarial tests (malicious PDF, malicious memory, filename injection, conflict distraction).

---

## 26. Provider / model interaction

1. DisclosureContextPlanner selects compatible provider class.  
2. Model registry supplies context window + capabilities.  
3. ContextPacker packs to that window.  
4. ContextRenderer adapts `ContextPackage` to provider message schema.  
5. Inference runs.  
6. InfluenceRecorder persists what was **actually sent**.

Routing may prefer disclosure-compatible providers. Framework/provider choice cannot redefine retrieval semantics (Invariant 26).

---

## 27. Provenance and explainability

Starting from Stage 9 `response_influence_records`.

### 27.1 Persist

**Stage 12 decision:** Persist **selected records** + **final budget drops** of finalists + **conflict/ambiguity groups**. Optionally persist aggregated metrics for lower-ranked candidates (counts by channel/reason) without raw text.

Do **not** store raw provider prompts for debugging by default.

### 27.2 Fields per influence row / snapshot

| Field | Required |
| --- | --- |
| turn_id, assistant_message_id, user_id | Yes |
| assertion_id + revision_id / document_chunk_id / identity_field / turn_ids | As applicable |
| channel(s), channel ranks, fused rank | Yes (snapshot JSONB) |
| score features (compact) | Yes for selected + budget drops |
| eligibility snapshot | Yes |
| retrieval_policy_version | Yes |
| embedding space/version | When used |
| query-plan mode | Yes |
| selected / dropped | Yes |
| drop reason | When dropped |
| context tokens consumed | Yes for selected |
| provider disclosure decision | Yes |
| citation label | Yes for selected |
| conflict group id | When applicable |

### 27.3 User-facing explanations (conceptual)

- “You saved this.”  
- “Relevant to Project Atlas.”  
- “Mentioned in your document.”  
- “This was true in 2024.”  
- “Two saved facts conflict.”  
- “This context stayed private and was not sent to this model.”  
- “This older conversation was not included because of the context limit.”  

Correction entry points: Vault assertion, conflict decision, document open — UI deferred.

### 27.4 Integrity rules

- Every actually sent evidence record has an influence record.  
- No influence record claims selected evidence that was not sent.  
- Thinking UI must be able to consume influence records (closes Stage 5 gap; UI implementation Deferred).

---

## 28. Failure and degradation model

### 28.1 Latency budget (conceptual)

| Phase | Budget |
| --- | --- |
| Planning | 50 ms deterministic; + optional assist timeout 200 ms |
| Channels | parallel; 250 ms soft each |
| Global retrieval | 800 ms soft |
| Fusion/pack | 50 ms |

### 28.2 Channel classes

| Class | Meaning |
| --- | --- |
| required | Failure → degraded turn marker; may continue with others if policy allows (PostgreSQL canonical channels preferred) |
| optional | Failure → degrade marker; continue |
| degraded channel | Ran partially / timed out |
| failed turn | Only when canonical path cannot guarantee safety/isolation — not merely empty recall |

### 28.3 Degradation behaviours

| Failure | Behaviour |
| --- | --- |
| Embedding provider outage | FTS + exact + entity/project/history; mark `embeddings_unavailable` |
| Stale embeddings | Exclude stale hits; FTS/exact remain |
| External index timeout | Ignore channel; PostgreSQL only |
| Graph `rebuild_pending` | Skip graph channel; mark `graph_incomplete` |
| Reranker outage | No-op rerank |
| Document search outage | Skip documents |
| Partial results | Pack what is eligible; record degradation |
| Observability | Metrics + codes; **no raw private content** |

Degradation must **not** fail-open ownership, trust, or disclosure.

Reusable query embedding: one per space per turn; never duplicate for memory+document in same space.

---

## 29. Security analysis

| # | Threat | Structural protection | Service protection | Residual risk | Stage 15 test | Blocks Stage 12 acceptance? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Cross-user candidate retrieval | RLS + user_id filters | Explicit userId on all ports | Miswritten DEFINER | Cross-user retrieval empty | No (design specifies) |
| 2 | Cross-user entity expansion | Composite FKs Stage 11 | EntityQueryPort user checks | Bug in port | Cross-user entity list fails | No |
| 3 | Workspace access widening | No workspace ACL on memory | Ignore membership | Future feature creep | Workspace member cannot read | No |
| 4 | External stale/unmapped hits | Reconcile gate; no remote text | Drop + stale mark | Provider lies ids | Deleted id dropped | No |
| 5 | Indirect prompt injection | Untrusted records; separate policy | Renderer labels | Model noncompliance | Malicious doc/memory suite | No |
| 6 | Malicious memory text | UntrustedData | Same | Model follows imperative | Imperative memory test | No |
| 7 | Malicious document text | UntrustedData | Same | Same | Ignore-previous-instructions PDF | No |
| 8 | Malicious filename/metadata | Treat as untrusted strings | Sanitize display | Model confusion | Filename injection | No |
| 9 | Retrieval score manipulation | Eligibility hard gate | Pin≠force | User pins spam | Pin irrelevant excluded/budgeted | No |
| 10 | Pin abuse | Pin boost only | Diversity caps | Noise | Pin flood test | No |
| 11 | Huge-vault DoS | Channel limits + deadlines | Timeouts | Resource cost | 100k assertion soak | No |
| 12 | Large-document flooding | Chunk caps + overlap | Doc max shares | — | Large PDF pack test | No |
| 13 | History flooding | Turn eligibility + reserve | Caps | — | Long thread test | No |
| 14 | Conflict suppression | Conflict groups required | Packing reserve for notices | UI omission | Dual manager test | No |
| 15 | Historical as current | Temporal gate + labels | Plan modes | Classifier error | Before-Athens test | No |
| 16 | Uncertain as fact | Modality gate + labels | — | Classifier error | Plan uncertainty test | No |
| 17 | Sensitive→wrong provider | Disclosure planner Option B | Filter before pack | Router bug | Sensitive withhold test | No |
| 18 | Provider-restricted embedded externally | allow_embedding separate | Index workers | Worker bug | Restricted not externalized | No |
| 19 | Missing provenance | Influence required for sent | Completion TX | Partial write | Influence completeness | No |
| 20 | Stale revision retrieval | Revision match gate | stale_index | Race | Stale embed drop | No |
| 21 | Stale entity redirect | resolveEntityId follow | — | Lag | Redirect follow test | No |
| 22 | Incomplete relationship projection | series_state gate | graph_incomplete | — | rebuild_pending skipped | No |
| 23 | Ambiguous project silent select | ambiguous_scope | Ambiguity notice | Caller ignore | Dual Atlas test | No |
| 24 | Score leakage UI | User explanations not raw internals | Redact features | Debug UI | UI redaction test | No |
| 25 | Raw private content in logs | ids/codes only | Log policy | Accidental log | Log scrub test | No |
| 26 | Reranker/model outage | Optional no-op | Fallback B | Quality drop | Reranker down test | No |
| 27 | Token-estimation error | Safety margin | Conservative ratio | Overfill | Estimator stress | No |
| 28 | Context-window metadata error | Default 8192 conservative | Registry validation | Underuse | Bad metadata test | No |
| 29 | Policy-version drift | Pin version on turn | Influence stores version | Replay mismatch | Version pin test | No |
| 30 | Non-deterministic reranking | Default identity; pin if enabled | — | Optional model | Determinism test rp-v1 | No |
| 31 | Influence claims unsent evidence | Record after pack/render | selected⇔sent invariant | Bug | Sent≡influence | No |
| 32 | Truncated assertion meaning change | No meaning-changing truncation | Drop atomic instead | Packer bug | Atomic skip test | No |

None of these block **Stage 12 document acceptance**; all require Stage 15 coverage before implementation sign-off.

---

## 30. Service interfaces

Conceptual TypeScript only — **not** production code.

Shared credentials: user-scoped reads via authenticated context / RLS; service_role only for worker paths that Stage 12 does not invent. Retrieval for chat uses the requesting user’s identity. Transactions: read-mostly; influence write participates in turn completion TX (Stage 9). Forbidden data: raw secrets, other users’ rows, remote external text as authority, embedding vectors in logs/command results.

### 30.1 Core request types

```ts
type RetrievalRequest = {
  userId: string;
  turnId: string;
  sessionId?: string;
  rawQuery: string;
  attachmentDocumentIds?: string[];
  selectionKey?: string;          // model selection hint, not final
  interface: 'think' | 'chat' | 'api' | 'other';
  clientTurnKey: string;
};

type RetrievalDegradation = {
  code:
    | 'embeddings_unavailable'
    | 'fts_unavailable'
    | 'document_search_unavailable'
    | 'external_index_timeout'
    | 'graph_incomplete'
    | 'reranker_unavailable'
    | 'channel_timeout'
    | 'partial_results'
    | 'tokenizer_unavailable'
    | 'model_metadata_uncertain';
  channel?: RetrievalChannel;
  detailCode?: string;
};

type FusedCandidate = RetrievalCandidate & {
  wrrfScore: number;
  policyScore: number;
  finalScore: number;
  fusedRank: number;
};

type ContextPackingDecision = {
  budget: ContextBudget;
  includedRecordIds: string[];
  dropped: Array<{ candidateId: string; reason: string }>;
  tokensByGroup: Record<string, number>;
  retrievalPolicyVersion: string;
};

type InfluenceRecord = {
  userId: string;
  turnId: string;
  assistantMessageId: string;
  canonicalKind: CanonicalKind;
  assertionId?: string;
  assertionRevisionId?: string;
  documentChunkId?: string;
  identityField?: string;
  turnIds?: string[];
  channel: string;
  eligibilitySnapshot: Record<string, unknown>;
  scoreSnapshot: Record<string, unknown>;
  relevance?: number;
  selected: boolean;
  dropReason?: string;
  citationLabel?: string;
  tokensConsumed?: number;
  disclosureDecision: string;
  retrievalPolicyVersion: string;
  conflictGroupId?: string;
};
```

### 30.2 Interfaces

#### `RetrievalPlanner`

| | |
| --- | --- |
| Input | `RetrievalRequest` + optional session bindings |
| Output | `RetrievalQueryPlan` |
| Owner | Retrieval / Turn Orchestrator |
| Credential | user |
| TX | none required |
| Allowed | query text, attachment ids, prior snapshot ids |
| Forbidden | granting trust; selecting ambiguous entity/project |
| Failure | medium/low confidence broad plan |
| Idempotency | same turn fingerprint → same plan under planner version |
| Current code | replaces ad hoc intent+always retrieve in Think/Chat |
| Stage 9/11 | consumes entity/project resolvers |

#### `HybridCandidateRetriever`

| | |
| --- | --- |
| Input | `RetrievalQueryPlan` |
| Output | `RetrievalCandidate[]` stubs + `RetrievalDegradation[]` |
| Owner | Retrieval |
| Credential | user |
| TX | read snapshots |
| Allowed | ids, ranks, scores |
| Forbidden | remote authoritative text; cross-user |
| Failure | per-channel degrade |
| Relationship | wraps EmbeddingIndexPort, FTS, Document retriever, EntityQueryPort, ExternalMemoryIndexPort |

#### `CanonicalEligibilityService`

| | |
| --- | --- |
| Input | candidate stubs |
| Output | candidates with `EligibilityDecision` |
| Owner | Memory CAS + Disclosure |
| Credential | user |
| TX | consistent read of assertion+disclosure+revision |
| Failure | default deny (`ineligible`) |
| Relationship | Stage 8 gate; Stage 9 fields; Stage 11 redirects |

#### `CandidateFusionService`

| | |
| --- | --- |
| Input | eligible candidates |
| Output | `FusedCandidate[]` |
| Owner | Retrieval |
| Failure | empty list |
| Reproducibility | pinned `rp-v1.0` |

#### `RetrievalReranker`

| | |
| --- | --- |
| Input | top finalists |
| Output | reordered finalists |
| Owner | Retrieval optional |
| v1 | identity / no-op |
| Failure | skip; keep fused order |
| Forbidden | changing eligibility/disclosure |

#### `CandidateDeduplicator`

| | |
| --- | --- |
| Input | fused candidates |
| Output | deduped + penalties applied |
| Owner | Retrieval |
| Failure | conservative keep-separate on uncertainty |

#### `ConflictContextService`

| | |
| --- | --- |
| Input | deduped candidates + plan |
| Output | `ConflictContextGroup[]` + annotated candidates |
| Owner | Retrieval + memory conflict links / Stage 11 episodes |
| Failure | mark needs_user_decision rather than silent merge |

#### `ConversationHistorySelector`

| | |
| --- | --- |
| Input | plan + session + budget hint |
| Output | conversation turn candidates |
| Owner | Conversation / Turn store |
| Relationship | Stage 9 `conversation_turns` |
| Failure | empty history + degrade |

#### `DisclosureContextPlanner`

| | |
| --- | --- |
| Input | finalists + available provider classes + model capabilities |
| Output | selected provider class constraints + filtered candidates + withhold notices |
| Owner | Disclosure + Routing |
| Failure | prefer safer provider / reduced context |

#### `ContextPacker`

| | |
| --- | --- |
| Input | filtered candidates, conflicts, budget inputs |
| Output | `ContextPackingDecision` + ordered records content refs |
| Owner | Retrieval |
| Failure | empty pack + notice |

#### `ContextRenderer`

| | |
| --- | --- |
| Input | `ContextPackage` + provider capabilities |
| Output | provider-specific messages **without** merging into system policy authority |
| Owner | Inference adapters |
| Current code | replaces `buildSystemPrompt` interpolation pattern |
| Failure | plain-text safe fallback |

#### `InfluenceRecorder`

| | |
| --- | --- |
| Input | packing decision + rendered sent set + conflicts |
| Output | `InfluenceRecord[]` persisted |
| Owner | Explainability / Turn completion |
| TX | with `complete_replied_turn` |
| Forbidden | raw prompt dumps; other users’ data |
| Relationship | Stage 9 `response_influence_records` (+ amendment snapshot fields) |

---

## 31. Amendment requests

Do **not** edit Stage 9 or Stage 11 documents. Requests below are for owners to approve later.

### 31.1 Stage 9 amendment request — Influence explainability snapshot

| | |
| --- | --- |
| Missing capability | `response_influence_records` lacks explicit fields for fused rank, multi-channel ranks, score features, drop reason, tokens consumed, disclosure decision, citation label, policy version, conflict group id, identity/history targeting |
| Why insufficient | Stage 12 must explain ranking, eligibility, dedupe, conflicts, budget drops; current columns (`channel`, `eligibility_snapshot`, `relevance`, `selected`) are too narrow if interpreted strictly |
| Smallest compatible change | Extend `eligibility_snapshot` usage **or** add `explainability_snapshot jsonb` + widen `channel` check to include `conversation` / `relationship` / `conflict` / `ambiguity`; add `selected` already exists — use `selected=false` for budget drops; add `retrieval_policy_version text` on turn or influence row |
| Proceed without it? | **Yes** for design; implementation needs the JSONB snapshot convention |
| Security/privacy | Snapshot must remain ids/flags/scores/codes — no raw private content |
| Approval | Stage 9 owner |

### 31.2 Stage 9 amendment request — Conversation turn eligibility for history

| | |
| --- | --- |
| Missing capability | History selection needs stable complete-turn states and exclusion of denied/failed/orphan turns; `conversation_turns.state` exists but product mapping for “eligible history” should be explicit |
| Why insufficient | Without normative eligible-history states, Stage 12 implementers may reintroduce message-count history |
| Smallest compatible change | Document/normalize eligible states = `{replied}` (and explicit list); ensure failed/denied/incomplete cannot be selected; optional `history_eligible boolean` generated column **or** query convention only |
| Proceed without it? | **Yes** — Stage 12 defines convention `state='replied'` + both message ids present |
| Security/privacy | Prevents leaking failed prompt fragments |
| Approval | Stage 9 owner |

### 31.3 Stage 9 amendment request — Document chunk lexical index

| | |
| --- | --- |
| Missing capability | Stage 9 defines `document_chunk_embeddings` but not an explicit chunk FTS table |
| Why insufficient | Hybrid document channel wants FTS/lexical alongside vectors |
| Smallest compatible change | Add derived `document_chunk_fts_documents` analogous to `memory_fts_documents`, **or** confirm ILIKE/exact filename + vector-only for v1 |
| Proceed without it? | **Yes** — v1 may use filename exact + semantic only; FTS marked optional channel |
| Security/privacy | Same ownership RLS |
| Approval | Stage 9 owner |

### 31.4 Stage 9 amendment request — Retrieval policy version on turn

| | |
| --- | --- |
| Missing capability | `conversation_turns.retrieval_snapshot` is jsonb ids/scores/codes; policy version not named |
| Why insufficient | Reproducibility/audit of packing requires pinned policy version |
| Smallest compatible change | Store `retrieval_policy_version` inside `retrieval_snapshot` JSON **without new table** |
| Proceed without it? | **Yes** |
| Security/privacy | None |
| Approval | Stage 9 owner |

### 31.5 Stage 11 amendment request — None blocking

Stage 11 query contracts are sufficient for Stage 12 consumption. No blocking Stage 11 schema amendment.

**Clarifications Stage 12 adopts without amending Stage 11:**

- Unresolved mentions → assertion text only.  
- Ambiguous projects → ambiguity notices.  
- `rebuild_pending` → graph channel degrade.  
- Hop depth → zero default / one bounded for entity/relationship modes.

| | |
| --- | --- |
| Optional non-blocking | If explain APIs should return packing-oriented “supporting assertion ids only” views, add a thin convenience method later |
| Proceed without it? | **Yes** |
| Approval | Stage 11 owner if convenience method desired |

### 31.6 Already-known prior amendments (not reopened)

Stage 10/11 already requested Stage 9 processing-run tables, entity tables, etc. Stage 12 depends on those existing as designed; it does not re-specify them.

---

## 32. Worked scenarios

Format per scenario: plan → channels → candidates → eligibility → fusion → dedupe/conflict → disclosure → packing → representation → influence → degradation.

### 32.1 “What is my name?”

- **Plan:** `identity`, temporal `[current]`, `directAnswerHint=identity_name`, `requiresPersonalContext=true`, expensive channels optional off if no conflict.  
- **Channels:** identity; light memory_exact for conflicting identity assertions.  
- **Eligibility:** display_name allowlisted; conflicting trusted identity assertion → cancel short-circuit.  
- **Path:** clean → deterministic answer; influence records identity field; no LLM required.  
- **Conflict path:** conflict group identity_conflict; pack both labeled conflicted; no single settled name.

### 32.2 “Where do I live now?”

- **Plan:** `current_state` + `personal_recall`, temporal `[current]`.  
- **Channels:** memory semantic/FTS/exact; entity self; no historical boost.  
- **Eligibility:** only current trusted residence; historical city → temporal_mode_mismatch or eligible_historical excluded from settled.  
- **Pack:** top residence assertion(s); if two current conflict → conflict group.

### 32.3 “Where did I live before Athens?”

- **Plan:** `historical`, temporal `[historical,ended]`.  
- **Channels:** memory + entity place.  
- **Eligibility:** historical/superseded residence eligible_historical; current Athens may appear as comparison anchor.  
- **Presentation:** historical_change, not current.

### 32.4 “What medication do I take?”

- **Plan:** `current_state`, personal; sensitivity likely highly_sensitive.  
- **Eligibility + disclosure:** may be `local_only` / provider_restricted.  
- **Disclosure planner:** pick compatible provider or withhold with notice.  
- **Pack:** trusted current meds only; uncertain plans labeled.

### 32.5 “What projects am I currently working on?”

- **Plan:** `project_scoped` / `current_state`, graph optional.  
- **Channels:** project entity list via Stage 11 + assertions.  
- **Eligibility:** active projects; ended excluded as current.  
- **Ambiguity:** none unless labels collide in answer set — list distinct project entities.

### 32.6 “What did we decide for Project Atlas?”

- **Plan:** `project_scoped` + `conversation_recall` + personal.  
- **Resolve project:** if unique Atlas → bind; if ambiguous → §32.7.  
- **Channels:** project assertions, relationship/decision episodes, conversation turns.  
- **Pack:** decisions as assertions; conversation turns supporting; conflict_open marked.

### 32.7 Two Project Atlas entities under different organisations

- **resolveProjectScopeLabel → ambiguous**.  
- **Plan flags:** `ambiguous_project`; `projectEntityIds=[]`.  
- **Behaviour:** ambiguity_notice; require clarification; **do not** merge evidence across both as one project.

### 32.8 “Who is my manager?”

- **Plan:** `relationship_focused` + `current_state`.  
- **Channels:** relationship series/episodes `reports_to`/`managed_by` (types per Stage 11), supporting assertions.  
- **One hop** to supporting assertions.  
- **Pack:** current episode supporting assertions; not graph edge as truth.

### 32.9 Current and former managers

- **Plan:** may include historical if asked “current and former”; else current primary.  
- **Episodes:** separate episodes; labels current vs historical.  
- **Never collapse**.

### 32.10 Conflicting current managers

- **conflict_open** episode and/or assertion conflict links.  
- **Presentation:** needs_user_decision conflict group; both supporting assertions conflicted labels.

### 32.11 Returning to a previous employer

- **Multiple episodes** same series different periods.  
- **Pack:** distinct temporal labels; not one employment fact.

### 32.12 “What do I know about Sarah?”

- **Plan:** `entity_focused`.  
- **Resolve entity:** if one Sarah → bind; if two → ambiguity.

### 32.13 Two people named Sarah

- **ambiguous_entity** notice; ask which Sarah; do not blend assertions.

### 32.14 “Summarise this PDF.”

- **Plan:** `document_focused`; `requiresDocumentEvidence=true`.  
- **Channels:** document semantic diversity across sections; ready required.  
- **Pack:** max chunks/doc with section diversity; untrusted document records.

### 32.15 “What does the PDF say about cancellation?”

- **Document Q&A precision:** semantic+FTS on chunks; filename boost if referenced.

### 32.16 Same fact as memory and document

- **Dedupe:** prefer trusted assertion for personal fact; optional one citation chunk if document asked; else drop duplicate chunk.

### 32.17 Three overlapping document chunks

- **Overlap penalties + merge adjacent;** pack ≤2/section.

### 32.18 “What is the capital of France?”

- **Plan:** `general`, `requiresPersonalContext=false`.  
- **Channels:** skip memory/doc/graph; minimal history if needed.  
- **Pack:** empty personal context.

### 32.19 “What did we discuss earlier?”

- **Plan:** `conversation_recall`.  
- **Channels:** history semantic + recent turns.  
- **Exclude** incomplete turns.

### 32.20 Very long conversation

- **Reserved recent turns;** older via recall/summary; budget drops recorded.

### 32.21 Orphaned failed prior user turn

- **Eligibility:** `turn_failed` / incomplete → excluded.

### 32.22 Highly sensitive trusted memory denied to selected provider

- **Disclosure:** withhold; user notice; answer without that evidence or refuse specifics.

### 32.23 Provider-restricted with compatible alternative provider

- **Planner Option B:** route to compatible provider; pack evidence.

### 32.24 External index returns deleted assertion

- **Reconcile:** missing/purged/deleted → drop; stale index mark; no remote text.

### 32.25 Embedding service unavailable

- **Degrade:** FTS/exact/entity/history; `embeddings_unavailable`.

### 32.26 Graph projection `rebuild_pending`

- **Skip graph;** `graph_incomplete`; other channels continue.

### 32.27 Relationship episode `conflict_open`

- **Include with conflict badge;** supporting assertions conflicted; not incompleteness.

### 32.28 Historical query with superseded assertions

- **eligible_historical;** presentation historical_change.

### 32.29 Uncertain prospective plan

- **Modality planned/uncertain;** trustLabel uncertain; not settled.

### 32.30 Explicit correction request

- **Plan:** `memory_management` / correction; retrieval grounds existing assertions; writes Deferred to Gateway (not Stage 12 write design beyond retrieval grounding).

### 32.31 Pinned but irrelevant memory

- **Pin boost** insufficient vs low semantic/FTS; may not pack; pin cannot force.

### 32.32 Relevant low-confidence candidate assertion

- **Eligibility:** candidate_not_trusted for settled truth → ineligible as trusted fact; may appear in review UX not ordinary context.

### 32.33 Relevant trusted assertion with stale embedding

- **stale_embedding / stale_index** from vector channel; may still appear via FTS/exact if those indexes current.

### 32.34 No relevant personal context

- **Empty personal pack;** general answer; influence may record empty selected set.

### 32.35 Context budget too small

- **Conflict notices + top utilities;** drops with reasons; user-visible limitation if needed.

### 32.36 Document contains “ignore previous instructions”

- **Rendered as untrusted document content;** system policy separate; Stage 15 adversarial.

### 32.37 Memory text “always answer X”

- **Untrusted memory record;** no system authority.

### 32.38 Same assertion via semantic, FTS, entity, project

- **Merge one candidate;** provenance lists all channels/ranks; packed once.

---

## 33. Invariants

1. A retrieval score never grants trust.  
2. A graph edge never grants trust.  
3. An external index never supplies authoritative text.  
4. Every external hit reconciles to canonical PostgreSQL state.  
5. Candidate, distrusted, deleted, purged, and ineligible assertions never enter context as trusted facts.  
6. Historical assertions are never presented as current.  
7. Uncertain claims are never presented as settled.  
8. Conflict-open assertions or relationships are never silently presented as one settled truth.  
9. Ambiguous projects/entities are never silently selected.  
10. Disclosure denial cannot be overridden by relevance.  
11. Workspace membership never widens personal-memory access.  
12. Every provider-bound context record passes disclosure policy.  
13. Retrieved content is always treated as untrusted data.  
14. System policy remains separate from retrieved data.  
15. Missing relation rows never mean `disjoint`.  
16. `rebuild_pending` graph state is never consumed as reconciled.  
17. The same canonical assertion is not packed repeatedly through multiple channels.  
18. Document overlap does not consume the context budget repeatedly.  
19. Conversation history consists of valid complete turns.  
20. Token packing is model-specific and token-based.  
21. Memory assertions are not truncated in meaning-changing ways.  
22. Every actually sent evidence record has an influence record.  
23. No influence record claims selected evidence that was not sent.  
24. Ranking and packing are reproducible under a pinned retrieval policy version.  
25. Failure of an optional channel causes explicit degradation, not a policy fail-open.  
26. Provider/framework choice cannot redefine retrieval semantics.

---

## 34. Risks and tradeoffs

| Risk | Mitigation |
| --- | --- |
| WRRF misses nuanced semantic ordering | Optional later reranker; Stage 15 calibration |
| Near-paraphrase threshold errors | Conservative keep-separate when uncertain; calibrate |
| Planner misclassification | Low-confidence broad recall; ambiguity flags |
| Under-filling due to atomic no-truncate rule | Prefer more short atomics; Stage 15 measure |
| Complexity vs current thin pipeline | Modular interfaces; feature flags Deferred to implementation stages |
| Influence storage growth | Selected + budget drops + aggregates only |

---

## 35. Deferred decisions

| Item | Owner stage |
| --- | --- |
| Stage 13 framework/vendor selection | 13 |
| Cross-encoder reranker choice | 13 / later |
| Empirical weight calibration | 15 |
| Full Thinking provenance UI | implementation / product |
| Tool message history rules | when tools ship |
| Rolling summary generation algorithm | 10/16 |
| Feedback-based ranking signals | product / 15 |
| Multiple parallel provider context plans (Option C) | later if needed |
| Exact near-paraphrase model | 15 |
| Chunk header/footer detector | 16 |
| Commercial implications of withhold notices | product |

---

## 36. Unknowns

| Unknown | Why open |
| --- | --- |
| Live latency of parallel channels at vault scale | Needs Stage 15 soak |
| Optimal λ and channel weights | Calibration |
| How often identity short-circuit conflicts with memories | Telemetry |
| Tokenizer variance across providers | Capability matrix |
| User comprehension of conflict notices in prompt | UX / 15 |
| Whether document FTS table is worth v1 | Amendment 31.3 |

---

## 37. Acceptance assessment

| # | Criterion | Status |
| --- | --- | --- |
| 1 | What retrieval channels exist? | **Met** — §8 |
| 2 | Which channels authoritative? | **Met** — §6.2 |
| 3 | How is query classified? | **Met** — §7 |
| 4 | Ambiguous entities/projects? | **Met** — §7, §15, §18 |
| 5 | Canonical reconciliation? | **Met** — §9 |
| 6 | Exact eligibility gate? | **Met** — §10 |
| 7 | Candidate representation? | **Met** — §11 |
| 8 | Fusion/reranking design? | **Met** — §12 Option B |
| 9 | Initial weights/thresholds/limits/version? | **Met** — §13 `rp-v1.0` |
| 10 | Hard filters vs ranking features? | **Met** — §12.2 |
| 11 | Signal combination? | **Met** — WRRF + policy |
| 12 | Dedup? | **Met** — §14 |
| 13 | Contradictions? | **Met** — §15 |
| 14 | Temporal/uncertain separation? | **Met** — §16 |
| 15 | Relationship episodes without independent truth? | **Met** — §8.D, §17 |
| 16 | Document overlaps? | **Met** — §14.3, §19 |
| 17 | Conversation history? | **Met** — §20 |
| 18 | Token budget? | **Met** — §23 |
| 19 | Allocation/packing? | **Met** — §24 |
| 20 | Assertion truncation safety? | **Met** — §24.4 |
| 21 | Data vs instructions? | **Met** — §25 |
| 22 | Indirect injection reduced? | **Met** — §25, §29 |
| 23 | Provider disclosure? | **Met** — §22 |
| 24 | Model context size packing? | **Met** — §23–24 |
| 25 | Degradation? | **Met** — §28 |
| 26 | Selected/dropped explained? | **Met** — §27 |
| 27 | Influence data persisted? | **Met** — §27 |
| 28 | Amendments? | **Met** — §31 |
| 29 | Explicitly deferred? | **Met** — §35 |
| 30 | Stage 13 needs? | **Met** — §38 |
| 31 | Stage 15 needs? | **Met** — §39 |
| 32 | Provider-independent? | **Met** |
| 33 | User isolation? | **Met** |
| 34 | No production implementation? | **Met** |
| 35 | Exact enough for 14–17? | **Met** |

**Stage 12 internally complete:** Yes.  
**Ready for architecture review:** Yes.  
**Stage 13 may begin after review:** Yes (evaluation only; no implementation).

---

## 38. Stage 13 handoff

Stage 13 must evaluate frameworks/vendors **against** this retrieval architecture without changing semantics:

1. Can a candidate framework act as **ExternalMemoryIndexPort** (IDs only) without becoming text authority?  
2. Does it support pinned embedding spaces and forbid cross-space compares?  
3. Can optional rerankers plug into `RetrievalReranker` without being required?  
4. Does adoption preserve PostgreSQL canonicality, disclosure flags, and influence recording?  
5. Latency/cost vs Option B baseline.  
6. Failure behaviour when external service down (must match §28).  

Stage 13 must **not** redefine eligibility, trust, conflict packing, or untrusted rendering.

---

## 39. Stage 15 handoff

Evaluate at least:

1. All §29 threats with automated/adversarial tests.  
2. Calibration of §13 constants on labeled personal-query sets.  
3. Scenarios §32.1–32.38 as golden decision traces.  
4. Determinism under `rp-v1.0`.  
5. Injection suites (PDF, memory, filename).  
6. Disclosure routing correctness.  
7. History eligibility (orphans excluded).  
8. Influence sent≡recorded invariant.  
9. Graph rebuild_pending / conflict_open behaviours.  
10. Token estimator under/over-flow tests.  
11. Ambiguous Atlas / dual Sarah tests.  
12. External deleted-id tests.  
13. Embedding outage FTS fallback quality.

---

## 40. Files and questions for later stages

### Files to keep in view

- This document  
- `05-retrieval-context-audit.md`  
- `07-target-architecture.md`  
- `08-memory-model.md`  
- `09-technical-design.md`  
- `11-entity-relationship-design.md`  
- Current: `orchestration/chat.ts`, `ai/context.ts`, `documents/retrieve.ts`, `memory/*`, `inference/router.ts`

### Questions for Stage 14 (red-team)

1. Can WRRF+policy be gamed by bulk pinned paraphrases?  
2. Are conflict notices sufficient to stop model side-taking?  
3. Is Option B disclosure order attackable via sensitivity flooding?  
4. Any amendment missing for safe implementation?

### Questions for Stage 16/17

1. First vertical slice: eligibility gate + stop profile always-inject + influence snapshot?  
2. Migration coexistence with `match_memories` / `message_context`?  
3. Feature flag strategy without changing semantics?

---

## 41. Disagreements with prior artifacts

| Item | Disposition |
| --- | --- |
| `00-roadmap.md` stale statuses | Stages 1–11 treated complete; roadmap **not** edited |
| Current Mem0 remote-text fallback | **Superseded** by IDs-only reconcile (Stage 7/9 binding; Stage 12 normative) |
| Current always-inject profile memories | **Superseded** by relevance + identity channel rules (Stage 7) |
| Current `contextChars` as budget | **Superseded** by token `ContextBudget` |
| Current message-count history | **Superseded** by complete-turn history |
| Stage 5 documents failures | Addressed by design; code unchanged |
| Stage 9 influence columns narrow | **Amendment request** §31.1 — not silent rewrite |
| Stage 11 hop depth deferred | **Closed** here: zero default / one bounded |

No disagreement that PostgreSQL is canonical or that Stages 8–11 eligibility/graph rules bind.

---

## 42. Final checklist

- [x] Only documentation for Stage 12 retrieval/context design  
- [x] No production implementation  
- [x] Stages 0–11 not edited  
- [x] Stage 13–17 not started  
- [x] Option B selected with constants versioned  
- [x] Eligibility/disclosure/packing/graph/history/rendering specified  
- [x] Amendments recorded  
- [x] 38 scenarios traced  
- [x] 26 invariants listed  
- [x] Acceptance criteria assessed  

---

*End of Stage 12 — Hybrid Retrieval, Reranking, and Context Design.*
