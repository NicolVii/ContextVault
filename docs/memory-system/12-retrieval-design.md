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

Cortaix’s target retrieval architecture is **Option B — multi-channel candidate generation, weighted reciprocal-rank fusion (WRRF), then bounded multiplicative policy adjustment (±15%)**, followed by **canonical reconciliation-first eligibility**, **conflict-safe grouping**, **hierarchical reserve-then-fill token packing**, and **structured untrusted context rendering**.

PostgreSQL remains the sole authority for memory assertions, ownership, trust, lifecycle, disclosure, entity identity, relationship user decisions, and operational coordination. Embeddings, FTS documents, graph projections, and external indexes are **derived and rebuildable**. Every search hit reconciles to current canonical state before ranking. Ranking never grants trust. Disclosure never yields to relevance. Retrieved text is always **untrusted data**, never system instructions.

### Why Option B

| Need | Option A linear hybrid | **Option B WRRF × policy** | Option C cross-encoder | Option D LLM judge |
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
 Local deterministic query-policy scan
        │
        ▼
 QueryDisclosureDecision (before any external call)
        │
        ▼
 RetrievalPlanner → RetrievalQueryPlan (once; primaryIntentMode + intentFacets)
        │
        ▼
 HybridCandidateRetriever (only permitted channels; shared query embedding if allowed)
        │
        ▼
 CanonicalEligibilityService (reconcile + gate; scores cannot override)
        │
        ▼
 CandidateFusionService (WRRF × bounded policy) → optional rerank → Deduplicator → ConflictContextService
        │
        ▼
 Evidence DisclosureContextPlanner (sensitivity summary → compatible provider class)
        │
        ▼
 ContextPacker (model-specific token budget, hierarchical reserve-then-fill)
        │
        ▼
 ContextRenderer (structured ContextPackage → provider adapter)
        │
        ▼
 InfluenceRecorder (sent + budget-drop + disclosure-withheld + conflict/ambiguity + direct-answer)
```

### Headline Stage 12 decisions

1. **Architecture:** Option B WRRF × deterministic bounded policy; optional reranker interface unused for correctness.  
2. **Policy version:** `retrieval_policy_version = "rp-v1.0"`. Final score is multiplicative: `Final = WRRF × (1 + λ_policy × Policy)` with `λ_policy = 0.15`, so policy adjusts fusion by at most ±15% and cannot dominate or invent candidates.  
3. **Query plan:** `primaryIntentMode` + deterministic `intentFacets`; optional structured model assistance cannot grant trust, widen ownership, bypass disclosure, or silently pick ambiguous entities/projects.  
4. **Query disclosure preflight:** Local scan produces `QueryDisclosureDecision` **before** any external embedding, external-index, planner-model, or reranker call.  
5. **Graph expansion v1:** **Zero-hop default**; **one bounded hop** only for `entity_focused` / `relationship_focused` via Stage 11 contracts to supporting assertions — never friend-of-friend.  
6. **Evidence disclosure order:** Option B — build evidence disclosure summary → select compatible provider/model → pack to that window (after query preflight and retrieval).  
7. **Packing:** Hierarchical reserve-then-fill with group minima/maxima and utility-per-token fill; whole-document summarisation uses an explicit coverage decision tree, not the Q&A chunk cap.  
8. **History:** Complete eligible turns with reserved recent-turn budget; no orphan/failed turns; optional derived summaries never become trusted memory.  
9. **Identity:** Not unconditional inject-everything; deterministic short-circuit only after a complete canonical identity consistency check (not lexical absence-of-conflict).  
10. **External indexes:** IDs only → canonical map → eligibility; **no remote-text fallback**; query text still requires query disclosure.  
11. **Influence:** Persist sent, budget-dropped, disclosure-withheld finalists, conflict/ambiguity notices, and direct-answer identity fields.  
12. **Amendments:** Compact JSONB expansions on `response_influence_records` and `conversation_turns.retrieval_snapshot`; explicit final-state vocabulary beyond a single `selected` boolean.

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

### 5.2 Option B — Rank fusion + bounded multiplicative policy (**selected**)

Each channel produces an independent ranked list. Fuse with **weighted reciprocal-rank fusion**, then apply a **bounded multiplicative** policy adjustment (`Final = WRRF × (1 + λ_policy × Policy)`, `λ_policy = 0.15`), then diversity and conflict grouping.

| Criterion | Assessment |
| --- | --- |
| Correctness | Strong for multi-channel recall without forcing score commensurability |
| Determinism | High under pinned `retrieval_policy_version` |
| Explainability | Channel ranks + fused rank + bounded policy multiplier |
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
| `CandidateFusionService` | Retrieval | WRRF × bounded policy score |
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

### 7.0 Query disclosure preflight (normative, before external calls)

Stored-record disclosure flags do **not** authorize disclosure of the user’s current query. Before any external embedding, external-index search, optional planner-model assist, or optional reranker call:

```ts
type QueryDisclosureDecision = {
  /** Raw user text stays local by default. */
  rawQueryLocalOnly: true;
  externalSemanticAllowed: boolean;
  externalIndexSearchAllowed: boolean;
  plannerModelAllowed: boolean;
  rerankerModelAllowed: boolean;

  /** Optional redacted query for external semantic use only when lossless for intent. */
  safeSemanticQueryText?: string;
  reasonCodes: Array<
    | 'allowed'
    | 'forbidden_secret_detected'
    | 'provider_restricted_query'
    | 'highly_sensitive_query'
    | 'user_policy_denied'
    | 'redaction_not_lossless'
  >;
};
```

**Required sequence:**

```text
Raw user query
  → local deterministic query-policy scan
  → safe local query plan skeleton
  → QueryDisclosureDecision
  → permitted candidate channels only
  → candidate reconciliation
  → evidence disclosure summary
  → compatible provider selection
  → provider-specific filtering
  → packing
```

**Rules:**

1. `rawQuery` remains local unless query disclosure explicitly allows an external purpose.  
2. Query text containing forbidden secrets must not be sent to external embedding, external index, planner-model, or reranker services.  
3. A locally produced redacted `safeSemanticQueryText` may be used only when redaction preserves retrieval intent.  
4. If safe redaction is impossible, disable external semantic/index/model-assisted channels.  
5. Continue with local FTS, exact matching, canonical entity/project queries, and eligible conversation history.  
6. `allow_embedding` on stored assertions does **not** authorize embedding the current query.  
7. BYOK does **not** automatically bypass query-disclosure policy.  
8. Record explicit degradation and withholding codes **without** storing the secret query in logs.  
9. Do **not** send raw query text to an external index merely because the index returns IDs only.  
10. Optional reranking must receive only disclosure-approved candidate text and query representation.

### 7.1 `RetrievalQueryPlan`

Produced **once per user turn**. Provider-independent. Multi-intent is representable without compound string invention.

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

type DocumentRetrievalScope =
  | 'targeted_passage'
  | 'section'
  | 'whole_document';

type RetrievalQueryPlan = {
  userId: string;
  turnId: string;
  rawQuery: string;

  /** Dominant retrieval and packing strategy. */
  primaryIntentMode: IntentMode;
  /**
   * Additional modes. Must not duplicate primaryIntentMode.
   * Deterministic ascending enum-name order after construction.
   */
  intentFacets: IntentMode[];

  requestedTemporalModes: TemporalMode[];

  /** Resolved only — never guessed from ambiguous labels. */
  projectEntityIds: string[];
  entityIds: string[];
  relationshipTypes: string[];
  documentIds: string[];
  referencedFilenames: string[];
  /** Set when requiresDocumentEvidence; default targeted_passage. */
  documentRetrievalScope?: DocumentRetrievalScope;

  lexicalQueries: string[];
  /**
   * Text used for local semantic/FTS planning. For external semantic calls,
   * use QueryDisclosureDecision.safeSemanticQueryText when present and allowed.
   */
  semanticQueryText: string;
  embeddingSpace?: string; // pinned space id when embeddings used

  requiresPersonalContext: boolean;
  requiresConversationHistory: boolean;
  requiresDocumentEvidence: boolean;
  requiresGraphEvidence: boolean;

  disclosurePurpose: 'chat_inference';
  queryDisclosure: QueryDisclosureDecision;

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

**Intent semantics:**

1. `primaryIntentMode` controls the dominant retrieval and packing strategy.  
2. `intentFacets` contains zero or more additional modes.  
3. The primary mode must **not** be duplicated in `intentFacets`.  
4. Facet ordering is deterministic (stable sort by `IntentMode` enum name).  
5. Unknown classification uses a primary fallback plus explicit facets — never invent compound strings such as `"current_state+personal_recall"`.  
6. Provider/model assistance may propose facets but cannot change ownership, trust, disclosure, or ambiguity decisions.

### 7.2 How the plan is produced

**Stage 12 decision — hybrid deterministic planner with optional structured assist:**

0. **Query disclosure first** (§7.0): if external assist/embedding/index denied, planner stays local-only.  
1. **Deterministic rules (required):**
   - Identity patterns (“what is my name”, “who am I”) → `primaryIntentMode='identity'`, `directAnswerHint='identity_name'`.  
   - Temporal cues (“before”, “used to”, “in 2024”, “previously”) → `primaryIntentMode` or facet `historical`; `requestedTemporalModes` include `historical` / `ended`.  
   - Prospective cues → facet or primary `prospective`.  
   - Uncertainty cues → facet or primary `uncertain_or_options`.  
   - Explicit document/filename references → `primaryIntentMode='document_focused'` (or facet), populate ids/filenames; set `documentRetrievalScope` (`whole_document` for summarise-this-file; else `targeted_passage` / `section`).  
   - “What did we discuss / decide” → facet or primary `conversation_recall`.  
   - Project + decision questions → e.g. `primaryIntentMode='project_scoped'`, `intentFacets=['conversation_recall']` (sorted).  
   - Current personal state → e.g. `primaryIntentMode='current_state'`, `intentFacets=['personal_recall']`.  
   - Explicit memory commands → `primaryIntentMode='memory_management'`; correction grounding may add facet `personal_recall`.  
   - General knowledge with no personal markers and `requiresPersonalContext=false` → `primaryIntentMode='general'`.  
2. **Existing references:** attachment document ids, session project bindings, prior turn entity ids in `retrieval_snapshot`.  
3. **Stage 11 resolution:** `resolveEntityId`, `resolveProjectScopeLabel` — on `ambiguous`, set ambiguity flag and **do not** invent ids.  
4. **Optional structured model assistance:** may propose `primaryIntentMode` / `intentFacets`, lexical expansions, entity mention strings — **only if** `queryDisclosure.plannerModelAllowed`. **Forbidden:** granting trust, widening `userId`, setting disclosure true, selecting among ambiguous projects/entities, injecting remote facts, changing ambiguity outcomes.  
5. **Model-free fallback:** if assist fails or `planConfidence='low'`, use `primaryIntentMode='personal_recall'` with facets as needed, `requestedTemporalModes` including `current` (+ `unknown`), enable local memory+document+history channels, keep graph optional.

### 7.3 Uncertain classification

When intent is uncertain:

- Prefer **recall over silence** for personal questions (`requiresPersonalContext=true`) with medium channel limits: `primaryIntentMode='personal_recall'`, optional facets `current_state` / `uncertain_or_options`.  
- Prefer **no personal retrieval** for clear general-knowledge questions (`primaryIntentMode='general'`).  
- Never silently bind ambiguous entities/projects; return ambiguity groups to packing.  
- Temporal uncertainty → include `current` and allow historical as secondary (lower policy weight unless cues present).

### 7.4 Direct identity short-circuit

**Stage 12 decision:** Deterministic direct answers for allowlisted identity fields (display name, and narrowly scoped persona questions where product policy allows) may **bypass expensive multi-channel / external retrieval** while still recording influence for the identity field used (`used_in_deterministic_local_answer`).

**Before short-circuit, run a complete canonical identity consistency check** (local PostgreSQL / Stage 11 only — not `memory_exact` absence-of-hit):

1. Account profile field (e.g. `display_name`).  
2. Self entity (follow redirects; reject if unresolved).  
3. Eligible trusted **current** identity assertions grounded to self.  
4. Relevant succession / conflict state among those assertions.  
5. Current revision and disclosure-safe local metadata.  
6. Canonical alias / primary-name contract from Stage 11 when present.

**Short-circuit may proceed only when the check is complete and unambiguous.**

**Disable the shortcut when any of:**

```text
identity assertions are conflicted
self entity is unresolved or rebuild-pending
identity projection is stale
multiple current names require interpretation
canonical identity lookup fails
```

On disable: run ordinary local retrieval (and permitted channels), emit conflict/ambiguity groups as needed — **do not** treat exact lexical search as proof that no conflict exists.  
**Do not** require external semantic retrieval merely to answer a clean name question.

---

## 8. Retrieval channels

Channels run **independently** and preferably **in parallel**. Each returns ranked candidate stubs (ids + channel scores/ranks). Private text is loaded after eligibility when possible.

### 8.0 Shared rules

| Rule | Decision |
| --- | --- |
| Query disclosure gate | Channels that need external query text/embeddings run only if `QueryDisclosureDecision` permits that purpose |
| Parallelism | All **permitted** channels start together |
| Shared embedding | Exactly **one** query embedding per `(turnId, embeddingSpace)` reused by memory + document semantic channels **when** `externalSemanticAllowed` (or local embedder); never embed forbidden raw query externally |
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

**Modes** (driven by `documentRetrievalScope` on the plan):

- `targeted_passage` (normal Q&A): top chunks by fusion under ordinary per-document caps.  
- `section`: ordered, adjacent, deduplicated chunks from the identified section under a section-specific budget.  
- `whole_document` (e.g. “summarise this PDF”): follow the honest whole-document decision tree in §19 — **not** the Q&A chunk cap alone.  
- Filename targeting: boost that `documentId`.

**Limits:** semantic **24**, FTS **24**; see §13 for `normal_q_and_a_max_chunks_per_document` vs whole-document coverage policy.

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

Conflicts between profile fields and trusted identity assertions → conflict group, not silent profile win. Short-circuit requires the **complete canonical identity consistency check** (§7.4), not a light `memory_exact` search. Current code’s structured-identity preference is preserved only when that check is complete and unambiguous.

### 8.H External derived indexes

1. Channel runs only if `queryDisclosure.externalIndexSearchAllowed`.  
2. Even then, send only disclosure-approved query representation (`safeSemanticQueryText` or denied) — **never** raw secret query merely because hits are IDs.  
3. External service returns **IDs only** (+ opaque remote score for channel rank).  
4. Map via `external_memory_index_entries` → `assertion_id` / `revision_id`.  
5. Reload canonical assertion + eligibility.  
6. Unmapped / wrong user / deleted → drop; mark stale index.  
7. **No remote-text fallback** (closes current Mem0 gap).  
8. Timeout or query-disclosure denial → degrade to PostgreSQL channels (`external_index_timeout` or `query_disclosure_denied`).  
9. No cross-embedding-space comparison.

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

**Revision vs historical fact (normative):** A prior revision is **provenance**, not automatically a historical fact. Reconciliation binds candidates to the **current revision** of each eligible canonical assertion. Historical meaning comes from temporal phase, succession links, distinct period assertions, or Stage 11 episodes — not from arbitrary earlier wording revisions (see §14.1, §16).

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
8. Succession valid for requested temporal mode (superseded head → not current; may be `eligible_historical` **only** when succession semantics authorize historical use of that **assertion**, not merely because an older revision string exists).  
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
- Candidates bind to the **current** revision of each eligible assertion; revision advance invalidates stubs keyed to stale `assertionRevisionId`.  
- Earlier revisions are **not** separate historical candidates (see §16).  
- Selected text loaded after finalist IDs when feasible; operational logs store ids/scores/codes only.

---

## 12. Hybrid fusion and reranking

### 12.1 Method (exact v1)

**Stage 12 decision — WRRF with bounded multiplicative policy:**

1. Per channel, keep top-N candidates that are not `ineligible` / `stale_index` (conflicted/historical/local_only retained with flags).  
2. A candidate **must** have at least one retrieval-channel rank. Policy cannot create a candidate from zero retrieval evidence (`WRRF = 0` ⇒ `Final = 0`).  
3. Compute **Weighted Reciprocal Rank Fusion**:

\[
\mathrm{WRRF}(c) = \sum_{ch \in channels(c)} w_{ch} \cdot \frac{1}{k + r_{ch}(c)}
\]

where \(r_{ch}(c)\) is 1-based rank in channel `ch`, \(k=60\) (standard RRF constant), \(w_{ch}\) from §13.

4. Compute **policy raw and clipped policy**:

\[
\mathrm{PolicyRaw}(c) =
  b_{pin} + b_{confirm} + b_{source} + b_{temporal} + b_{project} + b_{entity} + b_{session}
  - p_{dup} - p_{conflict} - p_{overlap} - p_{sensitive} - p_{prev}
  + 0.05 \cdot \mathrm{confidenceWeak}
\]

\[
\mathrm{Policy}(c) = \mathrm{clip}(\mathrm{PolicyRaw}(c), -1.0, +1.0)
\]

5. **Final score (bounded multiplicative — policy cannot dominate fusion):**

\[
\mathrm{Final}(c) = \mathrm{WRRF}(c) \times \bigl(1 + \lambda_{\mathrm{policy}} \cdot \mathrm{Policy}(c)\bigr)
\]

with \(\lambda_{\mathrm{policy}} = 0.15\). Therefore policy may adjust fusion by **at most ±15%** and cannot replace channel relevance.

**Numerical example — rank-1 exact-only candidate** (\(w_{exact}=1\)):

```text
WRRF = 1 / 61 ≈ 0.01639

Policy = +1:
Final = 0.01639 × 1.15 ≈ 0.01885

Policy = -1:
Final = 0.01639 × 0.85 ≈ 0.01393
```

(Contrast with the rejected additive form `WRRF + 0.15 × Policy`, where policy ±0.15 would dwarf `WRRF ≈ 0.016`.)

6. Clarify relevance-only signals: pinning, confirmation, source authority, confidence, recency, entity overlap, and project match **modify relevance only**. None grant eligibility or trust.  
7. Optional `RetrievalReranker` may reorder within the top **M=40** finalists **after** this deterministic score and **without** changing eligibility or disclosure. Default = identity. Reranker inputs require query + candidate disclosure approval (§7.0).  
8. Apply diversity / dedupe / conflict grouping (§14–15).  
9. Select top finalists for packing (not yet token-truncated).  
10. **Tie-breaking remains deterministic:** higher `Final`, then higher `WRRF`, then exact-match presence, then newer `last_confirmed_at`, then stable `candidateId`.

### 12.2 Hard filters vs ranking features

| Signal | Role |
| --- | --- |
| Ownership, trust, retention, organisation, disclosure, ready doc, revision match | **Hard filter** |
| Temporal/modality mismatch vs plan | **Hard filter** (or route to historical/conflicted outcome) |
| Semantic, FTS, exact, entity overlap, project match, pin, confirmation, recency, confidence | **Boost / weak boost** (relevance only; enter `Policy` / channel ranks) |
| Duplicate, overlap, conflict-as-settled attempt, same-source spam | **Penalty** |
| Pin, confidence, similarity, graph edge | **Must never grant trust or eligibility** |
| Any score / policy multiplier | **Must never override disclosure** |
| Policy with `WRRF=0` | **No candidate** — cannot invent evidence |

### 12.3 Calibration

All numeric weights in §13 are **initial calibration constants**, versioned under `retrieval_policy_version`, changeable without changing canonical memory semantics. Stage 15 owns empirical calibration of channel weights, \(\lambda_{\mathrm{policy}}\) (must remain a **multiplicative** bound unless the formula is explicitly version-bumped), pin boost, and thresholds — and must verify that policy still cannot dominate fusion under the pinned formula.

### 12.4 Special ranking rules

- Recency must **not** bury durable identity / standing preferences: identity/preference kinds receive `b_source` floor when temporally compatible.  
- When plan requests historical, do **not** apply current-phase penalty to historical candidates; use `historicalRelevance`.  
- Pin boosts rank but **cannot force inclusion** if ineligible or crowded out by higher-utility diverse evidence under packing minima.  
- Policy multiplier cannot promote a non-retrieved id into the candidate set.

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
| `lambda_policy` | 0.15 | Multiplicative bound: `Final = WRRF × (1 + λ × Policy)`; ±15% max |
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
| `normal_q_and_a_max_chunks_per_document` | 4 | Diversity for `targeted_passage` Q&A only |
| `max_chunks_per_section` | 2 | Section / Q&A diversity |
| `whole_document_coverage_policy` | see §19 | Prefer complete ordered coverage after overlap removal when it fits; else derived summary or partial/clarify — **not** four-chunk “full” summary |
| `whole_document_summary_max_source_sections` | Stage 15 calibration | Cap on distinct sections used when packing a labelled partial/derived whole-document summary |
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

Similarity floor, near-paraphrase threshold, channel weights, multiplicative `λ_policy` (keep ±15% unless version bump), pin boost, Q&A chunk maxima, whole-document summary section caps, and latency deadlines. Stage 15 must include a regression that additive policy domination cannot reappear under `rp-v1.0`.

---

## 14. Deduplication and diversity

### 14.1 Assertion-level

| Case | Policy |
| --- | --- |
| Same assertion, many channels | Merge to one candidate |
| Multiple revisions | Retrieve the **current revision** of each eligible canonical assertion. Earlier revisions remain **provenance-only** unless an explicit canonical assertion/succession structure (or Stage 11 episode) represents historical truth — not merely older wording |
| Merged assertions | Follow survivor id |
| Superseded | Exclude as current; may be `eligible_historical` only via succession semantics authorizing historical use of that assertion |
| Near-paraphrase (sim ≥ 0.92, same kind, overlapping temporal) | Keep highest Final; others penalty / drop from pack |
| Distinct scopes or temporal periods | **Do not merge** |

**Duplicate key (exact):** `assertion:{assertionId}:{assertionRevisionId}` (revision id is the **current** eligible revision)  
**Family key:** `assertion_family:{rootAssertionId or assertionId}`  

**Normative:** A prior revision is provenance, not automatically a historical fact. Do not key separate “historical” candidates from arbitrary earlier revisions of the same assertion.

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

| Plan mode (primary or facet) | Prefer | Exclude as settled current |
| --- | --- | --- |
| `current_state` | `temporal_phase=current`, in-window | historical/ended/expired-as-present, prospective-as-present |
| `historical` | assertions with historical/ended phase; superseded assertions when succession authorizes historical use; distinct period assertions; Stage 11 episodes for distinct periods | Arbitrary earlier wording revisions; edit/normalization-only revisions; distrusted prior content; corrected-false revisions unless succession/trust explicitly authorizes historical truth |
| `prospective` | prospective/planned | — |
| `uncertain_or_options` | uncertain/conditional/hypothetical/planned | presenting them as asserted |
| mixed / unknown | current primary; historical secondary | silent collapse |

**Historical retrieval may use:**

1. A canonical assertion whose temporal phase is historical or ended.  
2. A superseded assertion linked through explicit succession semantics and still eligible for historical use.  
3. A separate assertion representing a prior real-world period.  
4. Stage 11 relationship episodes representing distinct periods.

**Historical retrieval must not use:**

1. Arbitrary earlier wording revisions.  
2. A revision replaced because of spelling, formatting, normalization, or editing.  
3. A corrected false revision unless explicit trust/succession state authorizes it as historical truth.  
4. Distrusted prior content.

Revision IDs remain in provenance and influence records for the **current** revision of each packed assertion; revision history is not factual history.

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
2. Semantic + FTS + exact filename (subject to query disclosure for external embeds).  
3. Scope from plan: `targeted_passage` | `section` | `whole_document`.  
4. Overlap merge rules §14.  
5. Document instructions quoted as document content (`untrustedData: true`).

### 19.1 `targeted_passage`

Use normal semantic/FTS/exact retrieval and `normal_q_and_a_max_chunks_per_document` (4).

### 19.2 `section`

Use ordered, adjacent, deduplicated chunks from the identified section under a section-specific budget (`max_chunks_per_section` and section token reserve).

### 19.3 `whole_document` — honest summarisation decision tree

Ordinary one-pass Q&A caps are **not** sufficient to claim a complete document summary.

1. Confirm **one** resolved, ready, user-owned target document.  
2. Build an ordered section/chunk coverage map.  
3. If the complete useful document representation fits the available context, pack **complete ordered coverage** after overlap removal.  
4. Otherwise, use a **derived document summary** only if:
   - it is explicitly marked derived,
   - it has complete chunk/section provenance,
   - it is current for the document fingerprint,
   - disclosure permits it,
   - it is **never** treated as trusted memory.  
5. If no current derived summary exists and complete coverage does not fit, ordinary one-pass retrieval **must not** claim to provide a complete summary.  
6. Return one of:
   - a clearly labelled **partial** summary,
   - a scoped **section** summary,
   - a limitation/clarification response,
   - or a request for a staged hierarchical summarisation workflow.  
7. A staged hierarchical summarisation workflow may be specified conceptually; **implementation remains deferred to Stages 16–17**.  
8. **Do not** silently summarize a long PDF from four top-ranked chunks.

Constants: `normal_q_and_a_max_chunks_per_document`, `whole_document_coverage_policy`, `whole_document_summary_max_source_sections` (§13). Influence records must label partial vs derived vs complete coverage.

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
| Enter provider request | When `primaryIntentMode='identity'` or identity/style facets require it; else optional low priority |
| Deterministic direct answer | Only after complete canonical identity consistency check (§7.4) is complete and unambiguous |
| Bypass expensive / external retrieval | Allowed on clean short-circuit; still no external call required for a clean name question |
| Proof of non-conflict | Canonical self-grounded trusted current identity assertions + succession/conflict — **not** `memory_exact` miss |
| Disable short-circuit | Conflicted identity, unresolved/rebuild-pending self, stale identity projection, multiple current names, lookup failure |
| Profile vs memory conflict | Conflict group; no silent single truth; record influence for fields considered |

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

1. **Query disclosure preflight** (§7.0) — before any external query-processing call.  
2. Candidate retrieval on **permitted** channels only. Stored `allow_embedding` governs whether an assertion may have been indexed externally historically; it does **not** authorize embedding the current query.  
3. Local eligibility (including `local_only`).  
4. **Evidence disclosure summary:** sensitivity classes + flags among finalists.  
5. Provider/model selection constrained by disclosure compatibility + capability metadata.  
6. Disclosure filtering for selected provider (withheld finalists recorded — §27).  
7. Context packing to model window.  
8. Inference (or deterministic local answer).

### 22.3 Flags

| Flag | Meaning |
| --- | --- |
| `allow_inference` | May enter provider prompt for chat inference (evidence) |
| `allow_embedding` | Stored assertion may be embedded externally (index **build**; not authorization to embed the live query) |
| `allow_external_index` | Stored assertion may sync to external index |
| QueryDisclosureDecision | Live-query purposes: external semantic / index search / planner / reranker |
| BYOK | User-supplied keys still require both query and evidence disclosure; BYOK does not bypass (**Assumption** aligned with Stage 7/9) |

### 22.4 Outcomes

| Situation | Behaviour |
| --- | --- |
| Best evidence cannot disclose to any available provider | Prefer local-only / direct deterministic answer if possible; else answer with reduced context + user-visible withhold notice backed by influence rows |
| Compatible alternative provider exists | Router may prefer disclosure-compatible provider |
| Provider-restricted assertion | `local_only` or filter out for incompatible provider; persist `drop_reason` |
| Highly sensitive | Same; stricter defaults |
| Query disclosure denies external channels | Local FTS/exact/entity/history only; degradation codes; no secret query in logs |
| User told of withhold? | **Yes** — user-facing explanation; not raw secret content; **must** have corresponding influence/snapshot record |
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
| `whole_document` scope | Follow §19.3; may exceed Q&A chunk cap when packing complete ordered coverage that fits; never claim completeness from four chunks |
| Tie-break | Higher `Final`, then higher WRRF, then exact match, then newer `last_confirmed_at`, then stable `candidateId` |

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
    primaryIntentMode: IntentMode;
    intentFacets: IntentMode[];
    temporalModes: TemporalMode[];
    documentRetrievalScope?: DocumentRetrievalScope;
    ambiguityFlags: string[];
    queryDisclosureReasonCodes: string[];
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

1. Query disclosure already constrained which external retrieval/planning/rerank calls ran.  
2. Evidence DisclosureContextPlanner selects compatible provider class for inference.  
3. Model registry supplies context window + capabilities.  
4. ContextPacker packs to that window; disclosure-withheld finalists are not sent.  
5. ContextRenderer adapts `ContextPackage` to provider message schema.  
6. Inference runs (or deterministic local answer).  
7. InfluenceRecorder persists sent, withheld, budget-dropped, notices, and direct-answer fields (§27).

Routing may prefer disclosure-compatible providers. Framework/provider choice cannot redefine retrieval semantics (Invariant 26). Optional rerankers receive only disclosure-approved query representation and candidate text.

---

## 27. Provenance and explainability

Starting from Stage 9 `response_influence_records`.

### 27.1 Persist

**Stage 12 decision — persist:**

1. Every record **actually sent** to a provider (`sent_to_provider`).  
2. Every finalist dropped because of token budget (`dropped_for_budget`).  
3. Every finalist withheld because of provider disclosure incompatibility (`withheld_before_pack`).  
4. Every rendered conflict or ambiguity notice.  
5. Every identity field used in a deterministic direct answer (`used_in_deterministic_local_answer`).  
6. Aggregated counts for lower-ranked candidates that never became finalists (no raw text).

Do **not** store raw provider prompts, raw private evidence text, or secret raw query content for debugging by default.

### 27.2 Final-state vocabulary (required in JSONB snapshot)

A single ambiguous `selected` boolean is **insufficient** unless the snapshot carries exact final states:

```text
selected_for_pack
sent_to_provider
used_in_deterministic_local_answer
withheld_before_pack
dropped_for_budget
```

For disclosure-withheld finalists:

```text
selected = false
drop_reason ∈ {
  disclosure_denied,
  provider_restricted,
  no_compatible_provider,
  query_disclosure_denied
}
```

Also record: canonical IDs only; eligibility/disclosure codes; provider class considered; `retrieval_policy_version`; whether a user-visible withholding notice was shown. **A user-facing claim that context was withheld must have a corresponding influence/snapshot record.**

### 27.3 Fields per influence row / snapshot

| Field | Required |
| --- | --- |
| turn_id, assistant_message_id, user_id | Yes |
| assertion_id + **current** revision_id / document_chunk_id / identity_field / turn_ids | As applicable |
| channel(s), channel ranks, WRRF, Final, fused rank | Yes for finalists (snapshot JSONB) |
| score features (compact) | Yes for sent, budget drops, disclosure-withheld |
| eligibility snapshot | Yes |
| retrieval_policy_version | Yes |
| embedding space/version | When used |
| primaryIntentMode + intentFacets | Yes |
| documentRetrievalScope | When document evidence |
| queryDisclosure reason codes (not raw query) | Yes |
| final_state (vocabulary above) | Yes |
| selected boolean | Compatible with Stage 9; interpret via final_state |
| drop_reason | When not sent |
| context tokens consumed | Yes when sent / packed |
| provider disclosure decision + provider class | Yes for finalists |
| citation label | Yes when sent |
| conflict group id | When applicable |
| user_visible_withhold_notice | Boolean when withheld |
| document coverage label | `complete` / `partial` / `derived_summary` / `section` when docs |

### 27.4 User-facing explanations (conceptual)

- “You saved this.”  
- “Relevant to Project Atlas.”  
- “Mentioned in your document.”  
- “This was true in 2024.”  
- “Two saved facts conflict.”  
- “This context stayed private and was not sent to this model.” ← requires withheld influence row  
- “This older conversation was not included because of the context limit.” ← requires budget-drop row  
- “This is a partial summary of the document; full coverage did not fit.” ← coverage label  

Correction entry points: Vault assertion, conflict decision, document open — UI deferred.

### 27.5 Integrity rules

- Every actually sent evidence record has an influence record with `sent_to_provider`.  
- No influence record claims `sent_to_provider` for evidence that was not sent.  
- Every privacy-withholding explanation has a withheld influence/snapshot record.  
- Direct identity answers record `used_in_deterministic_local_answer` for fields used.  
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
| Query disclosure denies external semantic/index/planner/reranker | Local FTS/exact/entity/project/history only; mark `query_disclosure_denied`; never log secret query |
| Embedding provider outage | FTS + exact + entity/project/history; mark `embeddings_unavailable` |
| Stale embeddings | Exclude stale hits; FTS/exact remain |
| External index timeout | Ignore channel; PostgreSQL only |
| Identity short-circuit disabled | Full local retrieval path; conflict/ambiguity as needed |
| Whole-document coverage does not fit and no derived summary | Labelled partial / section / clarify / request staged workflow — never silent four-chunk “full” summary |
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
| 15a | Old wording revision treated as historical fact | Revision≠history rule §16 | Current revision only; succession/phase for history | Misread revisions | Revision-vs-history test | No |
| 16 | Uncertain as fact | Modality gate + labels | — | Classifier error | Plan uncertainty test | No |
| 17 | Sensitive→wrong provider | Evidence disclosure planner Option B | Filter before pack; influence withheld rows | Router bug | Sensitive withhold test | No |
| 17a | Secret query→external embed/index | QueryDisclosureDecision preflight | Deny external channels; local-only continue | Detector miss | Forbidden-secret query never leaves | No |
| 17b | allow_embedding on assertion misused as query auth | Explicit separation in §7.0 / §22 | Preflight ignores stored allow_embedding for live query | Confusion | Query embed denied while assertion embed allowed | No |
| 17c | External index search with raw secret query despite ID-only hits | Rule: query disclosure required | Block channel | Implementer shortcut | Index search denied for secret query | No |
| 17d | Withhold UI without influence row | Persist withheld finalists | Integrity check | Bug | Withhold notice⇔influence | No |
| 17e | Four-chunk fake full PDF summary | §19.3 decision tree | Coverage labels | Product pressure | Whole-doc honesty test | No |
| 17f | Identity short-circuit via memory_exact miss | Canonical consistency check §7.4 | Disable on conflict/stale/self issues | Shortcut regression | Dual-name short-circuit disabled | No |
| 17g | Additive policy domination revived | Multiplicative Final formula | Version pin rp-v1.0 | Formula drift | Policy ±15% math test | No |
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
    | 'model_metadata_uncertain'
    | 'query_disclosure_denied'
    | 'identity_short_circuit_disabled'
    | 'whole_document_coverage_incomplete';
  channel?: RetrievalChannel;
  detailCode?: string;
};

type FusedCandidate = RetrievalCandidate & {
  wrrfScore: number;
  policyRaw: number;
  policyScore: number; // clipped [-1,1]
  finalScore: number;  // WRRF × (1 + λ_policy × Policy)
  fusedRank: number;
};

type ContextPackingDecision = {
  budget: ContextBudget;
  includedRecordIds: string[];
  dropped: Array<{ candidateId: string; reason: string }>;
  tokensByGroup: Record<string, number>;
  retrievalPolicyVersion: string;
};

type InfluenceFinalState =
  | 'selected_for_pack'
  | 'sent_to_provider'
  | 'used_in_deterministic_local_answer'
  | 'withheld_before_pack'
  | 'dropped_for_budget';

type InfluenceRecord = {
  userId: string;
  turnId: string;
  assistantMessageId: string;
  canonicalKind: CanonicalKind;
  assertionId?: string;
  assertionRevisionId?: string; // current revision of packed assertion
  documentChunkId?: string;
  identityField?: string;
  turnIds?: string[];
  channel: string;
  eligibilitySnapshot: Record<string, unknown>;
  scoreSnapshot: Record<string, unknown>; // includes wrrf, policy, final
  relevance?: number;
  /** Stage 9 column; interpret with finalState. */
  selected: boolean;
  finalState: InfluenceFinalState;
  dropReason?:
    | 'disclosure_denied'
    | 'provider_restricted'
    | 'no_compatible_provider'
    | 'query_disclosure_denied'
    | 'budget_exceeded_atomic'
    | 'budget_dropped'
    | 'deduped'
    | string;
  citationLabel?: string;
  tokensConsumed?: number;
  disclosureDecision: string;
  providerClassConsidered?: string;
  userVisibleWithholdNotice?: boolean;
  documentCoverageLabel?: 'complete' | 'partial' | 'derived_summary' | 'section';
  retrievalPolicyVersion: string;
  primaryIntentMode: IntentMode;
  intentFacets: IntentMode[];
  queryDisclosureReasonCodes?: string[];
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
| Failure | medium/low confidence broad plan; primary + facets |
| Idempotency | same turn fingerprint → same plan under planner version |
| Current code | replaces ad hoc intent+always retrieve in Think/Chat |
| Stage 9/11 | consumes entity/project resolvers; runs after query disclosure; identity short-circuit uses canonical consistency check |

#### `HybridCandidateRetriever`

| | |
| --- | --- |
| Input | `RetrievalQueryPlan` |
| Output | `RetrievalCandidate[]` stubs + `RetrievalDegradation[]` |
| Owner | Retrieval |
| Credential | user |
| TX | read snapshots |
| Allowed | ids, ranks, scores |
| Forbidden | remote authoritative text; cross-user; external calls when query disclosure denies |
| Failure | per-channel degrade |
| Relationship | wraps EmbeddingIndexPort, FTS, Document retriever, EntityQueryPort, ExternalMemoryIndexPort; respects QueryDisclosureDecision |

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
| Reproducibility | pinned `rp-v1.0`; multiplicative Final formula |
| Invariant | Policy cannot invent candidates; |Final − WRRF| ≤ 0.15 × WRRF |

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

#### `QueryDisclosureService`

| | |
| --- | --- |
| Input | rawQuery + user policy |
| Output | `QueryDisclosureDecision` |
| Owner | Disclosure |
| Failure | deny external purposes (fail closed for external; continue local) |
| Forbidden | logging secret query text |

#### `DisclosureContextPlanner`

| | |
| --- | --- |
| Input | finalists + available provider classes + model capabilities + queryDisclosure |
| Output | selected provider class constraints + filtered candidates + withhold notices + influence stubs for withheld |
| Owner | Disclosure + Routing |
| Failure | prefer safer provider / reduced context; persist withhold reasons |

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

#### `IdentityConsistencyChecker`

| | |
| --- | --- |
| Input | userId + identity field hint |
| Output | `{ ok: true, value }` or `{ ok: false, reason }` |
| Owner | Identity / Stage 11 self entity + CAS |
| Failure | disable short-circuit |
| Forbidden | using memory_exact miss as proof of no conflict |

#### `InfluenceRecorder`

| | |
| --- | --- |
| Input | packing decision + rendered sent set + withheld finalists + budget drops + conflicts + direct-answer fields |
| Output | `InfluenceRecord[]` persisted with finalState vocabulary |
| Owner | Explainability / Turn completion |
| TX | with `complete_replied_turn` |
| Forbidden | raw prompt dumps; secret raw query; other users’ data |
| Relationship | Stage 9 `response_influence_records` (+ amendment snapshot fields) |
| Integrity | withhold UI ⇒ withheld row; sent ⇒ sent_to_provider |

---

## 31. Amendment requests

Do **not** edit Stage 9 or Stage 11 documents. Requests below are for owners to approve later.

### 31.1 Stage 9 amendment request — Influence explainability snapshot

| | |
| --- | --- |
| Missing capability | `response_influence_records` lacks explicit fields for fused rank, WRRF/Final, multi-channel ranks, score features, drop reason, tokens consumed, disclosure decision, citation label, policy version, conflict group id, identity/history targeting, and **final-state vocabulary** beyond a single `selected` boolean (sent / withheld / budget-drop / deterministic local answer) |
| Why insufficient | Stage 12 must explain ranking, eligibility, dedupe, conflicts, budget drops, and **disclosure-withheld** finalists; user-facing withhold claims require durable rows; `selected` alone cannot distinguish `sent_to_provider` vs `withheld_before_pack` vs `dropped_for_budget` vs `used_in_deterministic_local_answer` |
| Smallest compatible change | Add `explainability_snapshot jsonb` (or extend eligibility_snapshot) carrying finalState, drop_reason (`disclosure_denied` / `provider_restricted` / `no_compatible_provider` / `query_disclosure_denied` / budget codes), WRRF/Final, provider class, queryDisclosure reason codes (not raw query), user_visible_withhold_notice; widen `channel` check; keep `selected=false` for non-sent rows; store `retrieval_policy_version` on turn or influence |
| Proceed without it? | **Yes** for design; implementation needs the JSONB snapshot convention |
| Security/privacy | Snapshot must remain ids/flags/scores/codes — no raw private content, no secret raw query |
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

Format per scenario: plan (`primaryIntentMode` + `intentFacets`) → query disclosure → channels → candidates → eligibility → fusion (`Final = WRRF × (1+λPolicy)`) → dedupe/conflict → evidence disclosure → packing → representation → influence (finalState) → degradation.

### 32.1 “What is my name?”

- **Plan:** `primaryIntentMode='identity'`, `intentFacets=[]`, temporal `[current]`, `directAnswerHint='identity_name'`, `requiresPersonalContext=true`.  
- **Query disclosure:** local-only fine; no external required.  
- **Short-circuit gate:** canonical identity consistency check (profile + self entity + trusted current self-grounded identity assertions + succession/conflict + current revision + Stage 11 primary-name) — **not** `memory_exact`.  
- **Clean path:** deterministic answer; influence `used_in_deterministic_local_answer` for display_name; no LLM / no expensive retrieval.  
- **Disable path:** conflicted/stale/unresolved self/multiple names → `identity_short_circuit_disabled`; full local retrieval; conflict group; no single settled name.

### 32.2 “Where do I live now?”

- **Plan:** `primaryIntentMode='current_state'`, `intentFacets=['personal_recall']`, temporal `[current]`.  
- **Channels:** memory semantic/FTS/exact (if query disclosure allows semantic); entity self.  
- **Eligibility:** only current trusted residence; historical city → temporal_mode_mismatch or excluded from settled (`eligible_historical` only if separately authorized as historical assertion — not an old revision of the current home assertion).  
- **Pack:** top residence assertion(s); if two current conflict → conflict group.

### 32.3 “Where did I live before Athens?”

- **Plan:** `primaryIntentMode='historical'`, `intentFacets=['personal_recall']`, temporal `[historical,ended]`.  
- **Channels:** memory + entity place.  
- **Eligibility:** historical/ended-phase assertions; superseded assertions via succession; distinct period assertions; **not** earlier wording revisions of the Athens assertion.  
- **Presentation:** historical_change, not current.

### 32.4 “What medication do I take?”

- **Plan:** `primaryIntentMode='current_state'`, `intentFacets=['personal_recall']`; highly_sensitive likely.  
- **Query disclosure:** may deny external semantic/index if query itself highly sensitive / restricted → local channels only.  
- **Evidence disclosure:** may be `local_only` / provider_restricted.  
- **Withhold path:** influence `withheld_before_pack` + `drop_reason=disclosure_denied|provider_restricted|no_compatible_provider` + user notice.  
- **Pack:** trusted current meds only when disclosable; uncertain plans labeled.

### 32.5 “What projects am I currently working on?”

- **Plan:** `primaryIntentMode='project_scoped'`, `intentFacets=['current_state']`, graph optional.  
- **Channels:** project entity list via Stage 11 + assertions.  
- **Eligibility:** active projects; ended excluded as current.

### 32.6 “What did we decide for Project Atlas?”

- **Plan:** `primaryIntentMode='project_scoped'`, `intentFacets=['conversation_recall','personal_recall']` (sorted).  
- **Resolve project:** if unique Atlas → bind; if ambiguous → §32.7.  
- **Channels:** project assertions, relationship/decision episodes, conversation turns.  
- **Pack:** decisions as assertions; conversation turns supporting; conflict_open marked.

### 32.7 Two Project Atlas entities under different organisations

- **resolveProjectScopeLabel → ambiguous**.  
- **Plan:** `primaryIntentMode='project_scoped'`, facets as needed; flags `ambiguous_project`; `projectEntityIds=[]`.  
- **Behaviour:** ambiguity_notice; require clarification; influence records notice; **do not** merge.

### 32.8 “Who is my manager?”

- **Plan:** `primaryIntentMode='relationship_focused'`, `intentFacets=['current_state']`.  
- **Channels:** relationship series/episodes; one hop to supporting assertions.  
- **Pack:** current episode supporting assertions; not graph edge as truth.

### 32.9 Current and former managers

- **Plan:** `primaryIntentMode='relationship_focused'`, `intentFacets=['current_state','historical']` when both asked.  
- **Episodes:** separate; labels current vs historical; never collapse; not revision archaeology.

### 32.10 Conflicting current managers

- **conflict_open** / assertion conflicts → needs_user_decision group; influence conflict notice.

### 32.11 Returning to a previous employer

- **Multiple Stage 11 episodes** / distinct period assertions; distinct temporal labels.

### 32.12 “What do I know about Sarah?”

- **Plan:** `primaryIntentMode='entity_focused'`, `intentFacets=['personal_recall']`.  
- **Resolve:** one Sarah → bind; two → §32.13.

### 32.13 Two people named Sarah

- **ambiguous_entity** notice; ask which Sarah.

### 32.14 “Summarise this PDF.”

- **Plan:** `primaryIntentMode='document_focused'`, `intentFacets=[]`, `documentRetrievalScope='whole_document'`, `requiresDocumentEvidence=true`.  
- **Decision tree §19.3:** complete ordered coverage if fits; else current derived summary if eligible; else labelled partial / section / clarify / request staged workflow.  
- **Forbidden:** claiming full summary from four top chunks (`normal_q_and_a_max_chunks_per_document`).  
- **Influence:** documentCoverageLabel `complete`|`partial`|`derived_summary`.

### 32.15 “What does the PDF say about cancellation?”

- **Plan:** `primaryIntentMode='document_focused'`, `documentRetrievalScope='targeted_passage'`.  
- **Q&A caps apply;** semantic+FTS; filename boost.

### 32.16 Same fact as memory and document

- **Dedupe** across channels; prefer trusted assertion for personal fact unless document-focused citation needed.

### 32.17 Three overlapping document chunks

- **Overlap penalties + merge;** pack ≤ `max_chunks_per_section`.

### 32.18 “What is the capital of France?”

- **Plan:** `primaryIntentMode='general'`, `intentFacets=[]`, `requiresPersonalContext=false`.  
- **Skip** personal/doc/graph; empty personal pack.

### 32.19 “What did we discuss earlier?”

- **Plan:** `primaryIntentMode='conversation_recall'`, `intentFacets=[]`.  
- **Eligible complete turns only.**

### 32.20 Very long conversation

- **Reserved recent turns;** older via recall/summary; influence `dropped_for_budget` for truncated history.

### 32.21 Orphaned failed prior user turn

- **Excluded** (`turn_failed` / incomplete).

### 32.22 Highly sensitive trusted memory denied to selected provider

- **Evidence disclosure withhold;** user notice; influence `withheld_before_pack` + drop_reason; no raw text in logs.

### 32.23 Provider-restricted with compatible alternative provider

- **Route** to compatible provider; pack evidence; influence sent_to_provider.

### 32.24 External index returns deleted assertion

- Runs only if `externalIndexSearchAllowed`; reconcile drop; no remote text; never send secret raw query.

### 32.25 Embedding service unavailable **or** query disclosure denies embedding

- **Degrade:** FTS/exact/entity/history; `embeddings_unavailable` or `query_disclosure_denied`.

### 32.26 Graph projection `rebuild_pending`

- **Skip graph;** `graph_incomplete`.

### 32.27 Relationship episode `conflict_open`

- Include with conflict badge; not incompleteness.

### 32.28 Historical query with superseded assertions

- Superseded assertion via succession → `eligible_historical`; **not** prior wording revision of current assertion.

### 32.29 Uncertain prospective plan

- **Plan:** `primaryIntentMode='prospective'`, `intentFacets=['uncertain_or_options']`; trustLabel uncertain.

### 32.30 Explicit correction request

- **Plan:** `primaryIntentMode='memory_management'`, `intentFacets=['personal_recall']`, `memoryManagementAction='correct'`; retrieval grounds existing assertions.

### 32.31 Pinned but irrelevant memory

- Pin multiplies Final by at most 1.15 over WRRF; low channel rank stays low; cannot force pack; cannot grant trust.

### 32.32 Relevant low-confidence candidate assertion

- Hard eligibility: `candidate_not_trusted` for settled truth.

### 32.33 Relevant trusted assertion with stale embedding

- Vector hit `stale_index`; may still appear via FTS/exact current indexes.

### 32.34 No relevant personal context

- Empty personal pack; influence may record empty sent set.

### 32.35 Context budget too small

- Conflict notices + top utilities; `dropped_for_budget` rows.

### 32.36 Document contains “ignore previous instructions”

- Untrusted document content; system policy separate.

### 32.37 Memory text “always answer X”

- Untrusted memory; no system authority.

### 32.38 Same assertion via semantic, FTS, entity, project

- One candidate; WRRF sums channel terms; policy multiplies once; packed once; influence lists channels.

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
22. Every actually sent evidence record has an influence record with `sent_to_provider`.  
23. No influence record claims `sent_to_provider` for evidence that was not sent.  
24. Ranking and packing are reproducible under a pinned retrieval policy version.  
25. Failure of an optional channel causes explicit degradation, not a policy fail-open.  
26. Provider/framework choice cannot redefine retrieval semantics.  
27. `Final(c) = WRRF(c) × (1 + λ_policy × Policy(c))` with `λ_policy = 0.15`; policy adjusts fusion by at most ±15% and cannot dominate or invent candidates (`WRRF=0` ⇒ `Final=0`).  
28. Query disclosure preflight completes before any external embedding, external-index, planner-model, or reranker call; stored `allow_embedding` does not authorize embedding the live query.  
29. A prior assertion revision is provenance, not automatically a historical fact.  
30. Whole-document summarisation must not claim complete coverage from ordinary Q&A chunk caps.  
31. Identity short-circuit requires a complete canonical consistency check; `memory_exact` miss is not proof of non-conflict.  
32. Every user-visible privacy-withholding explanation has a corresponding disclosure-withheld influence/snapshot record.  
33. `primaryIntentMode` is unique; `intentFacets` never duplicates the primary and is deterministically ordered.

---

## 34. Risks and tradeoffs

| Risk | Mitigation |
| --- | --- |
| WRRF misses nuanced semantic ordering | Optional later reranker; Stage 15 calibration |
| Near-paraphrase threshold errors | Conservative keep-separate when uncertain; calibrate |
| Planner misclassification | Low-confidence broad recall; ambiguity flags |
| Under-filling due to atomic no-truncate rule | Prefer more short atomics; Stage 15 measure |
| Complexity vs current thin pipeline | Modular interfaces; feature flags Deferred to implementation stages |
| Influence storage growth | Sent + budget drops + disclosure-withheld + aggregates; still no raw text |
| Additive scoring accidentally revived | Normative multiplicative formula + Stage 15 math regression |
| Fake full-doc summaries | §19.3 decision tree + coverage labels |

---

## 35. Deferred decisions

| Item | Owner stage |
| --- | --- |
| Stage 13 framework/vendor selection | 13 |
| Cross-encoder reranker choice | 13 / later |
| Empirical weight calibration | 15 |
| Full Thinking provenance UI | implementation / product |
| Tool message history rules | when tools ship |
| Rolling conversation summary generation algorithm | 10/16 |
| Staged hierarchical whole-document summarisation workflow implementation | 16–17 |
| Derived document summary materialization pipeline | 10/16 |
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
| Optimal multiplicative λ_policy and channel weights | Calibration (keep ±15% bound unless version bump) |
| How often identity consistency check disables short-circuit | Telemetry |
| Tokenizer variance across providers | Capability matrix |
| User comprehension of conflict notices in prompt | UX / 15 |
| Whether document FTS table is worth v1 | Amendment 31.3 |

---

## 37. Acceptance assessment

| # | Criterion | Status |
| --- | --- | --- |
| 1 | What retrieval channels exist? | **Met** — §8 |
| 2 | Which channels authoritative? | **Met** — §6.2 |
| 3 | How is query classified (multi-intent)? | **Met** — §7 primary+facets |
| 4 | Ambiguous entities/projects? | **Met** — §7, §15, §18 |
| 5 | Canonical reconciliation? | **Met** — §9 |
| 6 | Exact eligibility gate? | **Met** — §10 |
| 7 | Candidate representation? | **Met** — §11 |
| 8 | Fusion/reranking design? | **Met** — §12 Option B multiplicative policy |
| 9 | Initial weights/thresholds/limits/version? | **Met** — §13 `rp-v1.0` |
| 10 | Hard filters vs ranking features? | **Met** — §12.2 |
| 11 | Signal combination? | **Met** — WRRF × (1+λPolicy); policy ≤±15% |
| 12 | Dedup? | **Met** — §14 |
| 13 | Contradictions? | **Met** — §15 |
| 14 | Temporal/uncertain separation? | **Met** — §16 (revision≠history) |
| 15 | Relationship episodes without independent truth? | **Met** — §8.D, §17 |
| 16 | Document overlaps / whole-doc honesty? | **Met** — §14.3, §19.3 |
| 17 | Conversation history? | **Met** — §20 |
| 18 | Token budget? | **Met** — §23 |
| 19 | Allocation/packing? | **Met** — §24 |
| 20 | Assertion truncation safety? | **Met** — §24.4 |
| 21 | Data vs instructions? | **Met** — §25 |
| 22 | Indirect injection reduced? | **Met** — §25, §29 |
| 23 | Query + evidence disclosure? | **Met** — §7.0, §22 |
| 24 | Model context size packing? | **Met** — §23–24 |
| 25 | Degradation? | **Met** — §28 |
| 26 | Sent/withheld/budget-dropped explained? | **Met** — §27 finalState |
| 27 | Influence data persisted (incl. withheld)? | **Met** — §27 |
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
7. External query calls must honour QueryDisclosureDecision.  
8. Must not redefine Final = WRRF × (1+λPolicy) semantics.  

Stage 13 must **not** redefine eligibility, trust, conflict packing, or untrusted rendering.

---

## 39. Stage 15 handoff

Evaluate at least:

1. All §29 threats with automated/adversarial tests (including 17a–17g, 15a).  
2. Calibration of §13 constants on labeled personal-query sets.  
3. Scenarios §32.1–32.38 as golden decision traces with valid `primaryIntentMode`/`intentFacets`.  
4. Determinism under `rp-v1.0`.  
5. **Math regression:** multiplicative policy cannot dominate (rank-1 exact ±Policy examples); additive domination must fail the test.  
6. Injection suites (PDF, memory, filename).  
7. Query disclosure preflight: forbidden-secret query never reaches external embed/index/planner/reranker; `allow_embedding` on assertions ≠ query auth.  
8. Evidence disclosure routing + withheld influence rows ↔ user notices.  
9. History eligibility (orphans excluded).  
10. Influence `sent_to_provider` ≡ actually sent; withhold explanations require rows.  
11. Graph rebuild_pending / conflict_open behaviours.  
12. Token estimator under/over-flow tests.  
13. Ambiguous Atlas / dual Sarah tests.  
14. External deleted-id tests; no raw secret query to index.  
15. Embedding outage / query-disclosure-denied FTS fallback quality.  
16. Revision-vs-history: older wording revision not treated as historical fact.  
17. Whole-document honesty: four-chunk path cannot claim complete summary.  
18. Identity short-circuit: dual current names / conflicted identity disables shortcut; clean name does not require external semantic.  
19. Pin/policy relevance-only: cannot grant eligibility/trust; cannot create zero-WRRF candidates.

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

1. Can WRRF×policy (±15%) be gamed by bulk pinned paraphrases?  
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
| Earlier Stage 12 draft: additive `Final = WRRF + λ·Policy` | **Superseded** — multiplicative `Final = WRRF × (1+λ·Policy)` so policy cannot dominate |
| Earlier Stage 12 draft: single `intentMode` | **Superseded** — `primaryIntentMode` + `intentFacets` |
| Earlier Stage 12 draft: disclosure only after retrieval | **Superseded** — query disclosure preflight before external calls |
| Earlier Stage 12 draft: older revision as eligible_historical | **Superseded** — revision is provenance; history via phase/succession/episodes |
| Earlier Stage 12 draft: summarise via Q&A chunk cap | **Superseded** — whole_document decision tree §19.3 |
| Earlier Stage 12 draft: identity short-circuit via memory_exact | **Superseded** — canonical identity consistency check |
| Earlier Stage 12 draft: influence = selected + budget drops only | **Superseded** — includes disclosure-withheld + finalState vocabulary |

No disagreement that PostgreSQL is canonical or that Stages 8–11 eligibility/graph rules bind.

---

## 42. Final checklist

- [x] Only documentation for Stage 12 retrieval/context design  
- [x] No production implementation  
- [x] Stages 0–11 not edited  
- [x] Stage 13–17 not started  
- [x] Option B selected with multiplicative policy constants versioned  
- [x] Multi-intent plans (`primaryIntentMode` + `intentFacets`)  
- [x] Query disclosure preflight before external calls  
- [x] Revision≠history; whole-doc decision tree; identity consistency gate  
- [x] Influence finalState incl. disclosure-withheld  
- [x] Eligibility/disclosure/packing/graph/history/rendering specified  
- [x] Amendments recorded  
- [x] 38 scenarios traced with valid plans  
- [x] Invariants listed (incl. 27–33)  
- [x] Acceptance criteria assessed  

---

*End of Stage 12 — Hybrid Retrieval, Reranking, and Context Design.*
