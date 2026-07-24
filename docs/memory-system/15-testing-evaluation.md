# Stage 15 — Testing and Evaluation Framework

| Field | Value |
| --- | --- |
| Stage | 15 — Testing and evaluation framework |
| Status | Draft for review |
| Document date | 2026-07-24 |
| Binding predecessors | Stages 0–14; **Stage 14 §6A OV-01…OV-18 normative** |
| Base branch | `cursor/testing-evaluation-framework` (from main after PR #47 / Stage 14) |
| Base commit | `83561ee` — docs: Stage 14 architecture red-team review (#47) |
| Output | Test design only — **no implementation authorized** |
| Changed file | This document only |

---

## 0. Executive summary

**Final verdict: `approve_test_framework`.**

Stage 15 defines an executable testing and evaluation framework that can **falsify** the Stage 14 amended architecture (narrow native MVA, zero external adapters for initial release, safety spine first) rather than merely confirm it.

This stage does **not** implement tests, fixtures, schemas, workers, adapters, or production behaviour.

| Class | Count |
| --- | ---: |
| Total tests | **150** |
| P0 | **63** |
| P1 | **67** |
| P2 | **16** |
| P3 | **4** |
| Concrete thresholds | **103** |
| Calibration tasks | **41** |
| Deferred tests | **6** |
| Rejected tests | **0** |
| Datasets specified | **36** |
| Environments specified | **12** |

**Stage 15 authorization (satisfied):**

1. PR #47 was reviewed and merged (`83561ee` on `main`).
2. The Stage 14 override register (§6A OV-01…OV-18) is normative for Stages 15–17.
3. Every `blocking_before_stage15` item has replacement language in OV-* and/or an assigned Stage 15 hypothesis/test below.
4. No implementation has begun.

No additional undefined approval ceremony is required to begin this documentation stage.

**Implementation remains prohibited** until Stages 15 and 17 are approved per roadmap gate. Stage 16 may begin only after Stage 15 review.

---

## 1. Evaluation philosophy

Separate evaluation classes. **Aggregate quality scores must not hide a failed safety or privacy property.**

| Class | Role | Gate style |
| --- | --- | --- |
| Safety invariants | Hard fail closed | Zero-tolerance where enforceable |
| Correctness properties | State/eligibility/race oracles | Concrete or calibrated |
| Retrieval quality | Ranking/packing usefulness | Calibrated floors + CI |
| Privacy properties | Residual/disclosure/redaction | Hard gates + policy review where needed |
| User-control properties | Confirm/undo/forget/discoverability | Mix of contract + UX studies |
| Operational resilience | Workers/outages/poison/retries | Chaos gates by phase |
| Performance and capacity | Latency/quotas | Calibrated budgets |
| Product usability | Fatigue/comprehension/trust | Study protocols + calibration |
| Cost efficiency | Unit economics | Model + measurement; not list-price TCO |
| Portability | Export/import honesty | Concrete watermarks + trust bans |
| Model independence | Eligible set vs answer style | Invariants vs allowed variance |
| Provider independence | Outage/disclosure/window | Safety invariants first |
| Migration safety | Expand/contract/rollback | Concrete drills |

Accepted-risk decisions are explicit (inherit Stage 14 §16). Mitigation cost may exceed expected harm only when recorded with telemetry and review triggers.

### 1.1 Evaluation types

Allowed `evaluation_type` values used in this framework:

- `chaos_test` — count 17
- `cost_model` — count 1
- `integration_contract` — count 20
- `load_test` — count 4
- `manual_review` — count 1
- `migration_test` — count 7
- `offline_dataset_eval` — count 21
- `policy_conformance` — count 15
- `privacy_test` — count 10
- `security_test` — count 10
- `simulation` — count 9
- `unit_contract` — count 23
- `usability_test` — count 12

---

## 2. Binding Stage 14 conclusions (preserved)

Unless a Stage 15 test **genuinely falsifies** them, preserve:

- Final verdict: `approve_with_required_amendments`
- Recommendation B: `upheld_with_required_amendments`
- Narrow native MVA (§10A)
- Zero external adapters enabled for initial release (OV-11)
- Current Mem0 remote-text path unsafe (OV-12; `src/lib/memory/mem0-provider.ts` L123–125)
- Full Stage 8–12 surface not first-release scope (OV-01)
- Entity graph deferred (OV-05); Graphiti deferred
- Multi-provider planning deferred (OV-09)
- Rerankers deferred; connectors deferred; automatic consolidation deferred
- End-to-end determinism not claimed (OV-13)
- Implementation remains prohibited

Stages 0–14 remain historical architecture evidence. Do not silently restore requirements that Stage 14 amended, reversed, deferred, or removed.

---

## 3. Baseline backlog disposition (T15-001…T15-030)

Stage 14 §17 backlog was **validated, expanded, split where multi-hypothesis, and completed** for partial gaps.

| Baseline ID | Disposition in Stage 15 | Notes |
| --- | --- | --- |
| T15-001…T15-030 | Retained IDs; expanded to full schema | Thresholds pinned or calibration tasks completed |
| Summary→trust gap (A03/A20) | **Added T15-031, T15-050** | Partial → covered |
| Confidence presentation (A14) | **Added T15-032, T15-145** | Partial → covered |
| Repair queue bounds (A67) | **Added T15-033** | Partial → covered |
| Confirm→undo latency/completeness (A71) | **Split/expanded T15-034, T15-110, T15-144** | Partial → covered |
| Review-queue usability | **Expanded T15-019 + T15-035** | Partial → covered |
| Audit/deletion residuals | **Expanded T15-004 + T15-036 + T15-132** | Partial → covered |
| Adapter divergence | **Retained T15-026 + T15-061 + T15-122** | Adapter-gated |
| Worker poison | **Retained T15-027 + T15-033** | Public-beta worker gate |

Priority recount for the full catalog is in §0 and §22.

---

## 4. Threshold and statistical framework

Every test has either:

1. A **concrete** pass/fail threshold, or
2. A **complete calibration task** (`threshold_status = to_be_calibrated_in_stage15`) with method, dataset, deadline, approver, and `failure_if_no_threshold`.

Banned placeholder words for thresholds: good, low, acceptable, reasonable, minimal, budget, policy, set later, hold, TBD.

### 4.1 Repeatability levels

| Level | Meaning |
| --- | --- |
| `bit_reproducible` | Same bits given same machine inputs |
| `configuration_reproducible` | Same results given pinned config/seeds/fixtures |
| `statistically_reproducible` | Distribution stable across pinned seeds/runs |
| `manually_reproducible` | Human study protocol reproducible |
| `not_reproducible` | Forbidden for gating tests |

### 4.2 Probabilistic test requirements

For offline/model tests specify and pin:

- Sample size and confidence interval method (default: bootstrap 1000 resamples, 95% CI)
- Random seeds (default report seeds `{11,22,33}`)
- Repeated runs (default ≥3 for model-touching evals)
- Model/provider/prompt/embedding version pins
- Temperature/sampling settings
- Variance reporting (mean, p50, p95, CI)
- Regression significance (default two-sided α=0.05; pre-register primary metric)
- Multiple-comparison handling when family-wise gates are claimed (Bonferroni or pre-registered primary)

Do **not** claim deterministic behaviour from nondeterministic model outputs (OV-13).

### 4.3 Subjective labels

- Dual reviewers for ambiguous semantic relevance where practical.
- Adjudication by a third reviewer or documented tie-break rule.
- Label versioning: `dataset_id@version`; regressions compare same label version.
- The model under evaluation must **not** be the sole ground-truth generator.
- Synthetic generation may assist corpus creation; it is not unquestioned truth.

---

## 5. Environments

| environment_id | purpose | infrastructure | data_allowed | external_calls | secrets | cost | repeatability | cleanup | owner | release_phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ENV-01 | Pure unit and policy simulation | local Node/vitest; no Docker required | synthetic fixtures only | none | none needed | low | bit_or_config reproducible | temp dirs | eng | all |
| ENV-02 | Local Supabase integration | Docker + supabase start + .env.local | synthetic seeded demo-like data | none external | local JWTs only | low-med | config reproducible | pnpm db:reset | eng | private_beta+ |
| ENV-03 | Hosted Supabase staging | hosted project staging | synthetic staging data only | Supabase hosted | staging secrets | med | config reproducible | project reset SOP | eng | public_beta+ |
| ENV-04 | Mock OpenRouter/provider | mock inference/embeddings | synthetic | mocked only | mock keys | low | config reproducible | n/a | eng | all |
| ENV-05 | Mock Mem0 | mock Mem0 HTTP | synthetic Mem0-shaped | mocked Mem0 | mock key | low | config reproducible | n/a | eng | adapter_gates |
| ENV-06 | Real provider sandbox | sandbox vendor accounts | synthetic prompts only | real sandbox APIs | sandbox secrets | med-high | statistically reproducible | purge sandbox | eng | when unavoidable |
| ENV-07 | Worker and queue | worker host + queue + PG | synthetic jobs | none/mocks | worker creds | med | config reproducible | drain queues | ops | public_beta+ |
| ENV-08 | Chaos | fault injection on ENV-02/07 | synthetic | faults | same as base | med | manually/statistically | reset | ops | public_beta+ |
| ENV-09 | Load and soak | scaled PG + optional workers | synthetic large corpora | none/mocks | perf env | high | statistically | drop corpora | perf | paid_scale |
| ENV-10 | Browser usability | browser + local/staging app | synthetic memories; consented users | none | test accounts | med | manually reproducible | expire accounts | product | private_beta+ |
| ENV-11 | Migration rehearsal | expand/contract migrations | synthetic migrated data | none | local/staging | med | config reproducible | rollback | eng | public_beta+ |
| ENV-12 | Privacy and deletion inspection | audit/log scanners + policy checklists | synthetic unique tokens | none | ops access controlled | med | manually reproducible | scrub tokens | privacy | all deletion claims |

Stage 16 sequences infrastructure choices. This stage does not prescribe production topology.

---

## 6. Datasets and fixtures

Versioned evaluation corpus. **Do not commit real private user data** unless separately approved.

| dataset_id | purpose | content_classes | size | languages | sensitivity | source | synthetic_or_real | labeling_method | reviewer_requirements | versioning | privacy_constraints | known_biases | release_usage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DS-MEM0-REMOTE-TEXT-001 | Mem0 unmapped remote-text hits | remote_text,unmapped | 12 hits | en | low | synthetic | synthetic | deterministic fixture | none | v1 | no real Mem0 payloads | Mem0-shaped only | private_beta+ |
| DS-EXTRACT-TIMEOUT-001 | Conversational utterances without durable facts | chat,non_fact | 40 | en,el | low | synthetic | synthetic | author+reviewer | 1 reviewer | v1 | synthetic only | English-heavy | private_beta+ |
| DS-CONFLICT-DUAL-001 | Trusted opposite pairs | conflict,employment,location | 30 pairs | en | medium | synthetic | synthetic | dual label | 2 reviewers | v1 | synthetic PII-like | binary conflicts | private_beta+ |
| DS-AUDIT-DELETE-001 | Unique-token memories for residual scans | deletion,audit | 20 | en | low | synthetic | synthetic | token oracle | none | v1 | unique tokens only | token detection | all phases |
| DS-DELETE-RACE-001 | Delete vs job races | deletion,race | 15 scenarios | en | low | synthetic | synthetic | state oracle | none | v1 | synthetic | worker-shaped | public_beta+ |
| DS-CROSS-USER-001 | Two-tenant isolation | security,idor | 10 tenants×20 mems | en | low | synthetic | synthetic | token leak oracle | none | v1 | synthetic tenants | two-tenant only | private_beta+ |
| DS-PDF-INJECT-001 | Malicious PDFs with hidden instructions | injection,pdf | 25 PDFs | en | high adversarial | synthetic | synthetic | inject success oracle | security reviewer | v1 | synthetic malware-like docs; no real user docs | English instructions | private_beta+ |
| DS-HIDDEN-INSTR-001 | Docs with hidden instructions | injection,hidden | 20 | en | high adversarial | synthetic | synthetic | inject oracle | security reviewer | v1 | synthetic | overlay/hidden text | private_beta+ |
| DS-EMBED-SPACE-001 | Two embedding spaces | embedding,space | 2 spaces×1k vec | n/a | low | synthetic | synthetic | space id oracle | none | v1 | synthetic vectors | dim=1536 | paid_scale |
| DS-CORRECT-STICKY-001 | Retract+repeat false facts | correction | 25 | en | medium | synthetic | synthetic | revive oracle | 1 reviewer | v1 | synthetic | false-fact focused | private_beta+ |
| DS-DISCLOSURE-FAILOPEN-001 | local_only evidence cases | disclosure | 40 | en | high | synthetic | synthetic | leak oracle | privacy reviewer | v1 | synthetic sensitive markers | purpose classes limited | public_beta+ |
| DS-SEM-REL-001 | Semantic relevance gold | retrieval,semantic | ≥300 queries | en,el | medium | synthetic+public | synthetic | dual human relevance | 2 reviewers + adjudicator | v1 | no real private user data | cultural/name bias risk | private_beta+ |
| DS-LEX-REL-001 | Lexical relevance gold | retrieval,lexical | ≥200 queries | en | medium | synthetic | synthetic | dual human | 2 reviewers | v1 | synthetic | keyword-heavy | public_beta+ |
| DS-HYBRID-001 | Hybrid ablation set | retrieval,hybrid | ≥150 queries | en | medium | synthetic | synthetic | dual human | 2 reviewers | v1 | synthetic | channel mix | public_beta+ |
| DS-DEDUPE-001 | Paraphrase and near-miss pairs | dedupe | ≥200 pairs | en | low | synthetic | synthetic | merge/no-merge dual label | 2 reviewers | v1 | synthetic | paraphrase bias | public_beta+ |
| DS-NEARMISS-001 | Near-miss distinct facts | dedupe | ≥100 pairs | en | low | synthetic | synthetic | no-merge gold | 2 reviewers | v1 | synthetic | subtle distinctions | public_beta+ |
| DS-PARAPHRASE-001 | Paraphrase-only slice | dedupe | ≥100 pairs | en | low | synthetic | synthetic | merge gold | 2 reviewers | v1 | synthetic | paraphrase | public_beta+ |
| DS-CHUNK-FLOOD-001 | Synthetic chunk flood | load,chunks | 1e4/1e5/1e6 | en | low | synthetic | synthetic | latency oracle | none | v1 | synthetic chunks | uniform length bias | paid_scale |
| DS-QUEUE-FATIGUE-001 | Review queue simulations | ux,queue | 100/1000/5000 | en | low | synthetic | synthetic | proxy metrics | product | v1 | synthetic candidates | fatigue proxy not real users alone | private_beta+ |
| DS-HOSTILE-IMPORT-001 | Hostile import packages | import,trust | 15 packages | en | medium | synthetic | synthetic | trust-grant oracle | none | v1 | synthetic | vendor-shaped metadata | private_beta+ |
| DS-FORGET-HISTORY-001 | Forget vs transcript cases | forget,history | 20 | en | high | synthetic | synthetic | policy oracle after review | privacy/legal | v1 | synthetic; legal_or_privacy_review | policy-dependent | public_beta+ |
| DS-BACKUP-RESIDUAL-001 | Backup residual checklist fixtures | backup,deletion | checklist+5 cases | en | high | synthetic | synthetic | policy checklist | privacy/legal | v1 | no production backups in CI | backup windows vary | public_beta+ |
| DS-ML-EL-EN-001 | Mixed Greek/English memories | multilingual | ≥100 queries | el,en | medium | synthetic | synthetic | dual label | 2 bilingual reviewers | v1 | synthetic | translationese | public_beta+ |
| DS-HOMONYM-001 | Two people same display name | entity,homonym | 20 | en | medium | synthetic | synthetic | no-merge oracle | none | v1 | synthetic names | Western name bias | graph_gated |
| DS-EXPLAIN-REDACT-001 | Embarrassing explain cases | privacy,explain | 15 | en | high | synthetic | synthetic | redaction oracle | privacy reviewer | v1 | synthetic embarrassing only | sensitivity taxonomy incomplete | private_beta+ |
| DS-SECRET-PERSIST-001 | Secret-like strings | secrets | 30 | en | high | synthetic | synthetic | pattern oracle | none | v1 | synthetic secret-like only | pattern coverage gaps | private_beta+ |
| DS-EXPORT-MIG-001 | Mid-migration export packages | export,migration | 10 | en | low | synthetic | synthetic | watermark oracle | none | v1 | synthetic | migration-shaped | public_beta+ |
| DS-COST-MODEL-001 | Cost measurement scenarios | cost | scale points | n/a | low | synthetic metering | synthetic | metering | ops | v1 | no customer billing data in fixtures | assumption-heavy | paid_scale |
| DS-PROVIDER-OUTAGE-001 | Provider fault scenarios | outage | 12 | en | low | synthetic | synthetic | safety oracle | none | v1 | synthetic | fault injection limited | private_beta+ |
| DS-CONFLICT-RET-001 | Conflict retrieval queries | conflict,retrieval | ≥50 | en | medium | synthetic | synthetic | both-sides gold | 2 reviewers | v1 | synthetic | binary conflicts | private_beta+ |
| DS-TEMPORAL-RET-001 | Temporal retrieval queries | temporal | ≥80 | en | medium | synthetic | synthetic | current/historical gold | 2 reviewers | v1 | synthetic | address/employment heavy | private_beta+ |
| DS-EXTRACT-GOLD-001 | Extraction gold set | extraction | ≥200 utterances | en,el | medium | synthetic | synthetic | fact span labels | 2 reviewers | v1 | synthetic | model-generated drafts banned as sole truth | provider_change |
| DS-DISCLOSURE-CLASS-001 | Disclosure purpose labels | disclosure | ≥150 queries | en | high | synthetic | synthetic | purpose dual label | 2 privacy reviewers | v1 | synthetic | purpose taxonomy drift | public_beta+ |
| DS-UX-UNDO-001 | Undo discoverability tasks | ux | study pack | en | medium | synthetic UI | synthetic | task success | UX researcher | v1 | consented participants | lab bias | private_beta+ |
| DS-WORKER-OUTAGE-001 | Worker pause chaos | workers | 100 turns | en | low | synthetic | synthetic | success+lag | none | v1 | synthetic | web+worker topology specific | public_beta+ |
| DS-POISON-JOB-001 | Poison job payloads | workers,poison | 20 payloads | n/a | low | synthetic | synthetic | DLQ oracle | none | v1 | malformed synthetic | schema-specific | public_beta+ |

Additional content classes required in corpus design (may span the datasets above): stable profile facts; changing preferences; employment/location changes; contradictions; retractions; repeated false statements; sensitive/embarrassing facts; cultural alias collisions; two people same name; historical vs current addresses; short/long conversations; duplicate paraphrases; near-duplicate distinct facts; malicious/hidden-instruction documents; documents contradicting personal memory; large collections; multi-language; mixed Greek/English; provider-incompatible evidence; oversized required evidence; export/import packages; deleted facts in audit fixtures; cross-user tenants; worker failures; schema mismatches; millions-of-chunks synthetic sets.

---

## 7. Current-code testability matrix

| test_or_domain | current_code_path | can_test_now | requires_mock | requires_dark_schema | requires_worker | requires_future_feature | repository_anchor | key_limit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mem0 remote-text inject | mem0 retrieve | yes | Mem0 mock | no | no | disable/harden | `src/lib/memory/mem0-provider.ts` L123–125, L274–295 | Live path unsafe today |
| Heuristic invent fallback | extractCandidates | yes | none | no | no | ban path | `src/lib/memory/extraction/index.ts` L147–149 | Invent definition must be labelled |
| Profile force-merge | chat orchestration | yes | none | no | no | target eligibility | `src/lib/orchestration/chat.ts` L98–111 | Current behaviour is the defect |
| Cross-user RLS | match_memories + RLS | yes | none | no | no | Gateway later | `supabase/migrations/20260720000007_functions.sql`; `...006_rls.sql` | Provider metadata filters still needed |
| Secret redaction | finalize extraction | yes | none | no | no | embed-order proof | `src/lib/memory/redaction.ts`; extraction finalize | Pattern coverage incomplete |
| Account delete order | account API | yes (negative) | none | no | coordinator later | Auth-last workflow | `src/app/api/account/route.ts` L37–49 | Demonstrates Auth-not-last today |
| Export completeness | export API | partial | none | watermark | no | canonical package | `src/app/api/export/route.ts` | No generation watermark |
| Conflict dual-truth | n/a | sim only | none | thin conflict | no | packer | docs only | Cannot integration-test packing yet |
| Disclosure fail-open | n/a | sim only | provider mock | disclosure svc | no | disclosure | docs only | Public-beta component |
| Deletion races | n/a | no | none | deletion tables | yes | DeletionCoordinator | workers absent | Public-beta |
| Poison DLQ | n/a | no | none | jobs schema | yes | worker platform | workers absent | Public-beta |
| Entity/graph | n/a | deferred | — | entity schema | — | graph phase | OV-05 | Not first release |
| Adapters ID-only | Mem0/other | mock/chaos | Mem0 mock | mapping tables | yes | hardened adapter | OV-11/12 | Adapter enablement gate only |

Tests that can already expose current defects include at least: **T15-001, T15-002, T15-006, T15-025, T15-037, T15-040 (ordering defect), T15-063**.

---

## 8. Failure classification

| class | severity | release_blocking | incident_required | rollback_required | architecture_review_required | retest_scope |
| --- | --- | --- | --- | --- | --- | --- |
| safety_violation | critical | yes | yes | yes usually | yes | full safety suite |
| privacy_violation | critical | yes | yes | yes usually | yes | privacy+deletion suite |
| correctness_regression | high | yes if P0/P1 gate | no unless data corruption | maybe | yes if model change | affected domain |
| architecture_conformance_failure | high | yes | no | no | yes | policy+scope tests |
| migration_failure | high | yes | yes if released | yes | yes | migration+rollback |
| resilience_failure | high | yes for public/paid gates | maybe | maybe | yes | chaos suite |
| quality_regression | med-high | yes if gating metric | no | no | maybe | offline eval suite |
| performance_regression | med | yes if gate | no | maybe | no | load suite |
| usability_failure | med | yes for UX gates | no | no | no | UX restudy |
| cost_overrun | med | yes for paid-scale cost claims | no | no | no | cost model refresh |
| accepted_risk_trigger | med | no unless risk withdrawn | maybe | no | yes | risk register review |
| inconclusive | low | no — rerun/design | no | no | maybe | targeted |

---

## 9. Regression policy

- **Baseline version:** `eval_baseline_version` pinned per release candidate.
- **Golden datasets:** `dataset_id@version`; never silently edited.
- **Allowed variance:** only within pre-registered CI / calibration bands.
- **Model/provider change:** run T15-091/T15-119 family; no silent baseline reset.
- **Embedding change:** run T15-092/T15-008/T15-093; registry required at paid scale.
- **Prompt change:** re-run extraction/disclosure evals that pin prompt versions.
- **Retrieval policy change:** bump `retrieval_policy_version`; run T15-011/087/088.
- **Schema change:** migration+rollback drills; worker version gates.
- **Release comparison:** compare against last promoted baseline, not against drifting local runs.
- **Historical retention:** store metrics JSON with versions ≥13 months or until superseded policy.
- **Threshold versioning:** thresholds are versioned artifacts; changes require review note.
- **Flaky-test policy:** quarantine after 2 consecutive infra flakes; may not quarantine safety P0 without incident note.
- **Provider flakes:** retry budget ≤3 with pinned seed; persistent flake → mock-gate + sandbox manual_review, not silent ignore.
- **Reproduction:** failing gating tests must include seed, versions, dataset version, and env id.

---

## 10. Release-gate matrices

Safety and cross-user isolation gates are **not waivable**.

### 10.1 Private beta gate

| gate_item | test_ids | required_result | blocking | waiver_allowed | waiver_owner | waiver_expiration | telemetry_after_release | rollback_trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Simplified assertion lifecycle | T15-042,T15-043,T15-044 | pass | yes | no | — | — | illegal_transition_total | flag off / migrate down |
| User confirmation and undo | T15-034,T15-110,T15-039 | pass / calibrated | yes | no | — | — | undo_incomplete_total | disable confirm auto-paths |
| Thin conflict handling | T15-003,T15-051,T15-139 | dual_truth_rate=0 | yes | no | — | — | dual_truth_blocked | disable packing feature |
| Thin temporal labels | T15-046,T15-080,T15-111 | pass / calibrated | yes | no | — | — | stale_current_rate | deepen labels |
| Gateway mutation enforcement | T15-098,T15-006,T15-063 | idor/direct_mutation=0 | yes | no | — | — | idor_attempt_total | block release |
| Chat and Think convergence | T15-097 | path_divergence=0 | yes | no | — | — | path_divergence | unify paths |
| Mem0 remote-text disabled | T15-001,T15-100,T15-122 | inject_count=0; adapters off | yes | no | — | — | unmapped_hits_dropped | force MEMORY_PROVIDER=supabase |
| Secret fail-closed | T15-002,T15-037,T15-038 | 0 secrets persisted/embedded/invented | yes | no | — | — | secret_block_total | disable extraction |
| Cross-user isolation | T15-006,T15-063 | leak=0 | yes | no | — | — | cross_user_block_total | block release |
| Correction stickiness | T15-009,T15-039 | revive/overwrite=0 | yes | no | — | — | correction_revive_total | disable auto extract promote |
| Malicious document safety | T15-007,T15-138,T15-064 | inject_success=0 | yes | no | — | — | doc_inject_blocked_total | disable doc extract |
| Sync deletion limits enforced | T15-101,T15-128,T15-129 | limits hold; residuals=0 in controlled stores | yes | no | — | — | forget_residual | stop deletion claims |
| No background publishers/adapters | T15-099,T15-100,T15-146,T15-147,T15-148,T15-149 | 0 enabled | yes | no | — | — | adapter_enabled | disable flags |
| Semantic retrieval quality floor | T15-075,T15-121 | calibrated floor met | yes | no | — | — | nDCG_at_k | delay beta |
| Review queue usability floor | T15-019,T15-035,T15-085 | calibrated floor met | yes | no | — | — | review_queue_depth | tighten extraction precision |

### 10.2 Public beta gate

| gate_item | test_ids | required_result | blocking | waiver_allowed | waiver_owner | waiver_expiration | telemetry_after_release | rollback_trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Durable outbox + workers | T15-014,T15-053,T15-054 | pass | yes | no | — | — | job_lag_seconds | disable async paths |
| Poison-message handling | T15-027,T15-033 | poison_blocks_queue=false | yes | no | — | — | dlq_depth | pause workers |
| Retry and idempotency | T15-053,T15-054 | dup_write=0 | yes | no | — | — | dup_write_on_retry | pause publishers |
| DeletionCoordinator | T15-005,T15-040,T15-041,T15-123,T15-124 | resurrect=0; auth_last | yes | no | — | — | deletion_resurrection_total | stop deletion UX claims |
| Canonical export | T15-013,T15-073,T15-131 | false_complete=0 | yes | no | — | — | export_watermark_present | watermark/block exports |
| Lexical + semantic | T15-076,T15-077,T15-059 | calibrated / deleted excluded | yes | limited non-safety only | retrieval owner | ≤30 days | hybrid_lift | disable lexical channel |
| Disclosure service | T15-010,T15-065,T15-068 | leak=0; calibrated F1 | yes | no | — | — | disclosure_block_total | block external evidence |
| Backup/residual policy | T15-036,T15-132 | policy conformance | yes | no | — | — | backup_policy_check | stop erasure marketing |
| Migration compatibility | T15-057,T15-058,T15-135 | pass | yes | no | — | — | rollback_ok | rollback |
| Long-vault performance | T15-016,T15-085 | calibrated or non-claim | yes for claims | yes if non-claiming | perf owner | next RC | retrieval_latency_p95 | enable quotas |
| Operational telemetry | T15-134 | telemetry_raw=0 | yes | no | — | — | telemetry_raw | scrub/disable verbose logs |
| Rollback drills | T15-135,T15-058 | pass | yes | no | — | — | rollback_drill_ok | halt migrate |

### 10.3 Paid-scale gate

| gate_item | test_ids | required_result | blocking | waiver_allowed | waiver_owner | waiver_expiration | telemetry_after_release | rollback_trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Embedding-space registry | T15-008,T15-093,T15-092 | cross_space=0; drift detected | yes | no | — | — | embed_space_mismatch_total | block model change |
| Reindex reliability | T15-133 | calibrated success | yes | no | — | — | reindex_success | abort reindex |
| Quotas and capacity | T15-103,T15-016,T15-142 | calibrated | yes | limited | ops | ≤30 days | quota_breach | tighten caps |
| Cost model | T15-104 | published measured model | yes for pricing claims | yes if no pricing claim | founder | next pricing change | usd_per_active_user | reprice |
| Influence/explainability | T15-021,T15-102 | redaction hold | yes if feature on | no for raw leak | — | — | influence_raw_leak | disable explain |
| Support tooling | T15-106 | support_raw_leak=0 | yes | no | — | — | support_raw_leak | disable support views |
| Incident recovery | T15-107 | recover_from_canonical | yes | no | — | — | recover_from_canonical | disable adapters |
| Adapter enablement gates | T15-015,T15-026,T15-061,T15-122,T15-001 | all pass before enable | yes | no | — | — | native_bypass | disable adapter |
| Connector privacy review | T15-074 | deferred until enable | yes at enable | no | — | — | oauth_scope_ok | disable connector |
| Native-only quality floor | T15-121,T15-075 | floor met adapters off | yes | no | — | — | native_ndcg | keep adapters off |
| Vendor exit drills | T15-105 | native_rebuild_ok | yes before adapter paid use | no | — | — | native_rebuild_ok | disable adapter |
| Stale cache policy | T15-060 | stale_cache_hit=0 | yes if cache exists | no | — | — | stale_cache_hit | disable cache |

Private-beta gate size: **15**. Public-beta gate size: **12**. Paid-scale gate size: **12**.

**Unwaivable:** all safety_violation and privacy_violation P0 gates; cross-user isolation; Mem0 remote-text disable; secret fail-closed; deletion resurrection=0; disclosure leak=0; OV/MVA scope conformance.

---

## 11. Deletion and export proof plan

| operation | canonical_expected_state | derived_expected_state | audit_expected_state | user_visible_state | terminal_condition | timeout_or_sla | recovery_path | test_ids | legal_or_privacy_review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Forget one memory | absent/distrusted per policy | purged or not republishable | ids/hashes only | gone from memory UX | controlled stores clean | calibrated T15-034/128 | redo forget + scan | T15-128,T15-004 | if marketed as erasure |
| Correct one memory | succession head = correction | derived matches head | decision recorded without raw if purged | corrected | head stable | calibrated | re-apply correction | T15-009,T15-039,T15-048 | no |
| Delete one document | metadata deleted/tombstoned | chunks/embeddings gone | no raw chunk text | gone | controlled stores clean | sync private beta / coordinator public | redo delete | T15-129 | no |
| Delete one conversation | removed per policy | history eligibility per T15-022 | no raw if purged | gone/hidden | policy terminal | policy SLA | redo | T15-130,T15-022 | yes for forget semantics |
| Delete account | user rows gone after allowed state | all derived purged | account.delete without raw facts | signed out | Auth-last complete | public-beta coordinator SLA | support recovery only pre-Auth | T15-040,T15-041 | yes |
| Delete during extraction | no resurrect | no publish | hash/id | deleted | resurrect_count=0 | race harness | quarantine jobs | T15-123,T15-005 | no |
| Delete during indexing | no resurrect | index excludes | hash/id | deleted | resurrect_count=0 | race harness | rebuild exclude | T15-124 | no |
| Delete during export | export excludes or blocks | n/a | watermark | honest export | false_complete=0 | request timeout | retry export | T15-125,T15-013 | no |
| Delete during migration | no resurrect across dual-read | derived consistent | hash/id | deleted | migrate_resurrect=0 | migration window | halt migrate | T15-126 | no |
| Delete during provider outage | native delete completes | adapter purge queued/failed visible | hash/id | deleted natively | delete_completes_native | outage SLA | retry purge | T15-127,T15-062 | no |
| Delete adapter disabled | native only | n/a | hash/id | deleted | residuals=0 controlled | sync limits | scan | T15-101,T15-100 | no |
| Delete adapter enabled | canonical delete + purge verify | no remote text | hash/id | deleted | divergent_serve=0 | adapter SLA | disable adapter | T15-026,T15-061 | yes at enable |
| Export during migration | watermark/block | n/a | export audit | honest | false_complete=0 | request | block complete claim | T15-013 | no |
| Export and re-import | candidates only; deduped | n/a | import decisions | no silent trust | import_trust_grant=0; dup=0 | batch | manual review queue | T15-023,T15-052 | no |
| Export incompatible semantics | rejected or candidated | n/a | noted | honest errors | false_semantic_import=0 | batch | user messaging | T15-131 | no |
| Audit residual inspection | n/a | n/a | no raw | n/a | audit_raw_residual=0 | scan job | scrub | T15-132,T15-004 | yes |
| Backup residual inspection | uncontrolled backups possible | n/a | policy communicated | honest UX | residual_policy_conformance | backup window | SOP | T15-036 | **required** |

Avoid claiming complete deletion beyond systems Cortaix controls (OV-14).

---

## 12. Model and provider independence evaluation

| # | Concern | Must remain invariant | May legitimately vary | Tests |
| --- | --- | --- | --- | --- |
| 1 | Canonical memory independence | Canonical rows/IDs | — | T15-116 |
| 2 | Retrieval eligibility independence | Eligible ID set | Ranking within eligible optional channels | T15-012 |
| 3 | Packing-policy independence | Pack given frozen candidates+policy+tokenizer versions | — | T15-117 |
| 4 | Answer-style variance | Safety/privacy of outputs | Tone/phrasing | T15-118 |
| 5 | Extraction interpretation variance | Secret drop; no invent in chat mode | Borderline candidate phrasing within calibrated variance | T15-002,T15-119,T15-091 |
| 6 | Provider outage behaviour | No unsafe memory serve; no disclosure fail-open | Latency/degrade copy | T15-062,T15-010 |
| 7 | Provider disclosure compatibility | Forbidden evidence never sent | Which provider selected among allowed | T15-010,T15-068 |
| 8 | Context-window compatibility | Terminal plan if required cannot fit | Which single provider used (v1) | T15-120,T15-024 |
| 9 | Tokenizer mismatch | Bounded retries; no silent drop | Estimate error within calibrated bound | T15-020,T15-089,T15-090 |
| 10 | BYOK behaviour | BYOK≠disclosure bypass | User’s chosen key routing | T15-068 |

PostgreSQL storage alone does **not** prove model independence.

---

## 13. Cost and capacity evaluation

Model (assumptions vs measurement):

| Cost component | Assumption until measured | Measurement test/env |
| --- | --- | --- |
| Token / extraction / embedding | Vendor unit prices × measured volumes | T15-104 / ENV-09 |
| Reindex / worker / deletion / export | Engineering estimates | T15-133,T15-014, deletion suite |
| Storage growth | bytes/assertion × users | DB metrics |
| Evaluation infra / support / adapters / connectors | ops forecasts | T15-104; adapter gates |
| Provider price shocks | scenario ±2×/±5× | T15-104 sensitivity |

Scale points: 1,000 / 10,000 / 100,000 users; light / average / heavy / very large vault. Do not present vendor list prices as total cost of ownership.

---

## 14. Usability evaluation protocols

| Protocol | Tests | n target | Primary metrics |
| --- | --- | --- | --- |
| UP-REVIEW-001 | T15-035,T15-019 | ≥12 | queue_task_success; random_confirm_proxy |
| UP-FATIGUE-001 | T15-108 | ≥12 | confirm_fatigue_score; skip_rate |
| UP-CORRECT-001 | T15-109 | ≥12 | correction_find_rate |
| UP-UNDO-001 | T15-110 | ≥12 | undo_find_rate |
| UP-TEMPORAL-001 | T15-111 | ≥12 | label_comprehension |
| UP-CONFLICT-001 | T15-112 | ≥12 | conflict_comprehension |
| UP-PRIVACY-001 | T15-113 | ≥12 | privacy_mode_comprehension |
| UP-INVASIVE-001 | T15-114 | ≥20 | invasiveness_score |
| UP-ERROR-TRUST-001 | T15-115 | ≥12 | post_error_trust |

Internal architecture correctness is not proof of good UX.

---

## 15. Stage 14 finding traceability

| finding_or_correction_id | Stage_14_disposition | test_ids | coverage_status | release_gate | unresolved_validation | Stage_16_dependency | Stage_17_constraint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | confirmed_blocker | T15-001,T15-015,T15-100,T15-122 | covered | before_private_beta | implementation may remain | sequence per OV | no violate in first PR |
| A12 | confirmed_blocker | T15-003,T15-051,T15-079,T15-139 | covered | before_private_beta | implementation may remain | sequence per OV | no violate in first PR |
| A16 | confirmed_blocker | T15-002,T15-037,T15-038 | covered | before_private_beta | implementation may remain | sequence per OV | no violate in first PR |
| A37 | confirmed_blocker | T15-024,T15-081,T15-141 | covered | before_private_beta | implementation may remain | sequence per OV | no violate in first PR |
| A45 | confirmed_blocker | T15-008,T15-092,T15-093,T15-133 | covered | before_paid_scale/embedding_change | implementation may remain | sequence per OV | no violate in first PR |
| A56 | confirmed_blocker | T15-028,T15-029 | covered | before_private_beta | implementation may remain | sequence per OV | no violate in first PR |
| A66 | confirmed_blocker | T15-005,T15-040,T15-041,T15-123,T15-124 | covered | before_public_beta | implementation may remain | sequence per OV | no violate in first PR |
| OV-01 | effective_override | T15-028,T15-029,T15-099,T15-100 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-02 | effective_override | T15-042,T15-028 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-03 | effective_override | T15-032,T15-019,T15-035,T15-145 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-04 | effective_override | T15-046,T15-080,T15-111 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-05 | effective_override | T15-018,T15-095,T15-096,T15-147 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-06 | effective_override | T15-021,T15-102 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-07 | effective_override | T15-075,T15-076,T15-077,T15-078 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-08 | effective_override | T15-011,T15-030,T15-087,T15-088 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-09 | effective_override | T15-010,T15-024,T15-148,T15-120 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-10 | effective_override | T15-083,T15-084 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-11 | effective_override | T15-100,T15-015,T15-026,T15-122 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-12 | effective_override | T15-001,T15-015,T15-122 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-13 | effective_override | T15-012,T15-020,T15-150,T15-117 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-14 | effective_override | T15-004,T15-036,T15-040,T15-128 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-15 | effective_override | T15-023,T15-052,T15-131 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-16 | effective_override | T15-003,T15-024,T15-010,T15-141 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-17 | effective_override | T15-004,T15-132,T15-134 | covered | phased | none if OV held | plan from OV | implement OV-amended only |
| OV-18 | effective_override | T15-029 | covered | phased | none if OV held | plan from OV | implement OV-amended only |

Additional required traces (summary):

| ID | tests | coverage |
| --- | --- | --- |
| COR-01 | T15-028,T15-029 | covered (normative) |
| COR-02 | T15-020,T15-150,T15-011 | covered |
| COR-03 | T15-004,T15-036,T15-040 | covered; backup legal review remains as calibration |
| COR-04 | T15-003,T15-024,T15-141 | covered |
| COR-05 | T15-001,T15-015,T15-100 | covered; code disable in 16/17 |
| COR-06 | T15-002,T15-037 | covered |
| COR-07 | T15-025 | covered |
| COR-08 | T15-030,T15-011,T15-087 | covered |
| COR-09 | T15-018,T15-147,T15-095,T15-096 | covered (deferral + gated) |
| COR-10 | T15-023 | covered |
| COR-11 | T15-021,T15-102 | covered |
| COR-12 | T15-148,T15-010,T15-024 | covered |
| COR-13 | T15-014,T15-027 | covered |
| COR-14 | T15-029 | covered (normative) |
| COR-16 | T15-004,T15-132,T15-134 | covered |
| A03/A20 summary | T15-031,T15-050 | covered |
| A14 confidence | T15-032,T15-145 | covered |
| A57 divergence | T15-026,T15-061 | covered (adapter gate) |
| A58/A63 poison/retry | T15-027,T15-053 | covered |
| A67 repair bounds | T15-033 | covered |
| A68/A69 residuals | T15-004,T15-036,T15-132 | covered |
| A71 UX harm | T15-034,T15-035,T15-108–115 | covered |
| A48 stale cache | T15-060 | covered as paid-scale if cache exists; unresolved until cache policy chosen |

No Stage 14 blocker remains without an executable test, policy-conformance gate, named unresolved hypothesis, or accepted-risk decision.

---

## 16. Test dependency graph

```mermaid
flowchart TD
  classDef now fill:#d9f2d9,stroke:#2d6a2d
  classDef core fill:#fff2cc,stroke:#b08900
  classDef workers fill:#ddeeff,stroke:#335577
  classDef adapter fill:#f5d0e6,stroke:#7a3060
  classDef graph fill:#e8e8e8,stroke:#666
  classDef policy fill:#f0e6ff,stroke:#553388

  subgraph executable_now
    T001[T15-001 Mem0 remote-text]
    T002[T15-002 Heuristic invent]
    T006[T15-006 Cross-user]
    T025[T15-025 Force-merge]
    T037[T15-037 Secrets]
    T063[T15-063 IDOR]
  end

  subgraph executable_after_core
    T003[T15-003 Dual-truth]
    T009[T15-009 Correction sticky]
    T024[T15-024 Terminal plan]
    T042[T15-042 State machine]
    T075[T15-075 Semantic floor]
  end

  subgraph executable_after_workers
    T005[T15-005 Delete race]
    T014[T15-014 Worker outage]
    T027[T15-027 Poison DLQ]
    T040[T15-040 Auth-last]
  end

  subgraph adapter_gated
    T015[T15-015 PG down Mem0]
    T026[T15-026 Dual-write]
    T061[T15-061 Mapping loss]
  end

  subgraph graph_gated
    T018[T15-018 Homonym]
    T095[T15-095 Entity ret]
    T096[T15-096 Rel ret]
  end

  subgraph policy_only
    T028[T15-028 MVA scope]
    T029[T15-029 OV binding]
    T150[T15-150 No E2E determinism claim]
  end

  T028 --> executable_after_core
  T029 --> executable_after_core
  executable_now --> executable_after_core
  executable_after_core --> executable_after_workers
  executable_after_workers --> adapter_gated
  executable_after_core -.-> graph_gated

  class T001,T002,T006,T025,T037,T063 now
  class T003,T009,T024,T042,T075 core
  class T005,T014,T027,T040 workers
  class T015,T026,T061 adapter
  class T018,T095,T096 graph
  class T028,T029,T150 policy
```

Diagram does **not** imply implementation exists.

---

## 17. Full test catalog (T15-001…T15-150)

Every test includes the full Stage 15 schema.

### 17.1 Priority P0

#### T15-001 — Mem0 remote text without canonical mapping never enters context

```yaml
test_id: T15-001
title: Mem0 remote text without canonical mapping never enters context
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [A01, S11, COR-05, OV-12]
override_ids: [OV-12, OV-11]
product_goal: PostgreSQL sole personal-truth authority
risk_addressed: Remote Mem0 text injected without cv_memory_id
hypothesis: Unmapped Mem0 hits yield inject_count=0
preconditions: Mock Mem0; retrieve exercisable
fixture_or_dataset: DS-MEM0-REMOTE-TEXT-001
actors: [harness, mock Mem0]
initial_state: Empty canonical matches; unmapped hits
event_sequence: [retrieve unmapped, pack context, assert no remote text]
expected_behaviour: Fail closed; never toRetrievedMemory remote-text fallback
oracle: inject_count == 0
metric: inject_count
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-05
current_code_applicable: yes — src/lib/memory/mem0-provider.ts L123–125; toRetrievedMemory L274–295
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic only; no real Mem0 payloads
observability_required: unmapped_hits_dropped
failure_interpretation: safety_violation
architecture_consequence: Uphold OV-12 disable-until-hardened
Stage_16_consequence: Disable/harden Mem0 before adapters
Stage_17_consequence: First PR must not enable Mem0 remote-text
owner: memory-security
traceability_status: fully_traced
```

#### T15-002 — Heuristic extraction never invents conversational memories

```yaml
test_id: T15-002
title: Heuristic extraction never invents conversational memories
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A16, C16, COR-06]
override_ids: [OV-01]
product_goal: Vault purity
risk_addressed: Timeout→heuristic invents facts
hypothesis: Chat-mode timeout path invented_facts=0
preconditions: Force timeout; chat mode
fixture_or_dataset: DS-EXTRACT-TIMEOUT-001
actors: [extractCandidates]
initial_state: Provider timeout
event_sequence: call extract; force L147–149 catch; count invented
expected_behaviour: Empty/non-inventing; no invented semantic/profile candidates
oracle: invented_facts == 0
metric: invented_facts
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes — extraction/index.ts L147–149; heuristic.ts
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic utterances
observability_required: extraction_fallback_total
failure_interpretation: safety_violation
architecture_consequence: Ban inventing heuristic for chat
Stage_16_consequence: Move heuristic ban early
Stage_17_consequence: Disable inventing fallback only if Stage 17 lists it
owner: extraction
traceability_status: fully_traced
```

#### T15-003 — Conflicting trusted facts never presented as dual settled truths

```yaml
test_id: T15-003
title: Conflicting trusted facts never presented as dual settled truths
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [A12, C6, COR-04, OV-16, S06]
override_ids: [OV-16]
product_goal: No dual settled current truths
risk_addressed: Packer emits both conflicting trusted as settled
hypothesis: dual_truth_rate=0 with label or invalid plan
preconditions: Thin conflict model
fixture_or_dataset: DS-CONFLICT-DUAL-001
actors: [packer]
initial_state: Two trusted opposites
event_sequence: [retrieve, pack, inspect]
expected_behaviour: No dual settled; labelled conflict or invalid plan
oracle: dual_truth_rate == 0 AND (conflict_labelled OR invalid_plan_explicit)
metric: dual_truth_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: partial — no conflict groups; policy sim now
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: conflict_group_count
failure_interpretation: safety_violation
architecture_consequence: Thin conflict private-beta mandatory
Stage_16_consequence: Sequence conflict packer early
Stage_17_consequence: Dark conflict OK; no solved claim without green sim
owner: retrieval
traceability_status: fully_traced
```

#### T15-004 — Deleted raw facts absent from audit payloads

```yaml
test_id: T15-004
title: Deleted raw facts absent from audit payloads
status: specified
priority: P0
evaluation_type: privacy_test
release_gate: before_private_beta
finding_ids: [C1, S37, COR-03, COR-16, OV-14, OV-17, A68]
override_ids: [OV-14, OV-17]
product_goal: Erasure matches erasable vs tombstone policy
risk_addressed: Audit retains raw deleted fact text
hypothesis: residual_text=0 post-purge for raw fact bodies
preconditions: Erasure policy; delete assertion
fixture_or_dataset: DS-AUDIT-DELETE-001
actors: [delete, audit scanner]
initial_state: Assertion with unique TOKEN_DEL_X
event_sequence: [delete, scan audits/logs for token]
expected_behaviour: Ids/hashes only; zero raw fact text
oracle: residual_text == 0
metric: residual_text
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-12
current_code_applicable: partial — src/lib/audit.ts; no assertion schema
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic unique tokens
observability_required: audit_raw_scan_failures
failure_interpretation: privacy_violation
architecture_consequence: Hash/id-only audits
Stage_16_consequence: Schema for hash/id audits before publishers
Stage_17_consequence: Observability without raw memory text
owner: privacy
traceability_status: fully_traced
```

#### T15-005 — Deletion race never republishes or resurrects

```yaml
test_id: T15-005
title: Deletion race never republishes or resurrects
status: specified
priority: P0
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [S03, S38, A66, A67]
override_ids: [OV-14]
product_goal: Deletion remains terminal under races
risk_addressed: Worker republishes deleted content
hypothesis: resurrect_count=0
preconditions: Worker env; deletion gate
fixture_or_dataset: DS-DELETE-RACE-001
actors: [worker, DeletionCoordinator]
initial_state: Delete while job in flight
event_sequence: [enqueue, delete, complete job, search stores]
expected_behaviour: No republish; no resurrection
oracle: resurrect_count == 0
metric: resurrect_count
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-08
current_code_applicable: no — workers/outbox absent
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: deletion_resurrection_total
failure_interpretation: safety_violation
architecture_consequence: DeletionCoordinator before publishers
Stage_16_consequence: Workers only after deletion gates
Stage_17_consequence: No publishers without deletion gate
owner: deletion
traceability_status: fully_traced
```

#### T15-006 — Cross-user retrieval and metadata-filter attacks blocked

```yaml
test_id: T15-006
title: Cross-user retrieval and metadata-filter attacks blocked
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [S29]
override_ids: [OV-01]
product_goal: Strict tenant isolation
risk_addressed: Cross-user retrieve via filters
hypothesis: cross_user_leak_rate=0
preconditions: Two users; auth clients
fixture_or_dataset: DS-CROSS-USER-001
actors: [userA, userB, match_memories]
initial_state: Distinct TOKEN memories
event_sequence: [crafted filters, assert deny]
expected_behaviour: Zero cross-user tokens
oracle: cross_user_leak_rate == 0
metric: cross_user_leak_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: yes — match_memories auth.uid() supabase/migrations/20260720000007_functions.sql; RLS 20260720000006_rls.sql
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic tenants
observability_required: idor_attempt_total
failure_interpretation: privacy_violation
architecture_consequence: Keep auth.uid filters; Gateway mutations
Stage_16_consequence: Preserve RLS
Stage_17_consequence: No RLS weakening
owner: security
traceability_status: fully_traced
```

#### T15-007 — Malicious PDF prompt injection fails closed

```yaml
test_id: T15-007
title: Malicious PDF prompt injection fails closed
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [A17, S05]
override_ids: [OV-01]
product_goal: Docs must not change policy or exfiltrate
risk_addressed: PDF hidden instructions alter behaviour
hypothesis: inject_success=0
preconditions: Document upload path
fixture_or_dataset: DS-PDF-INJECT-001
actors: [doc processor]
initial_state: Malicious PDF uploaded
event_sequence: [upload, extract, inspect candidates/prompt]
expected_behaviour: No policy change; secrets dropped; no auto-trust
oracle: inject_success == 0
metric: inject_success
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-02
current_code_applicable: partial — document pipeline exists
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: medium
false_negative_risk: medium
data_privacy_requirements: synthetic malicious PDFs only
observability_required: doc_inject_blocked_total
failure_interpretation: safety_violation
architecture_consequence: Untrusted document blocks
Stage_16_consequence: Document safety before connectors
Stage_17_consequence: No auto-trust from documents
owner: document-security
traceability_status: fully_traced
```

#### T15-008 — Embedding-space contamination prevented

```yaml
test_id: T15-008
title: Embedding-space contamination prevented
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_paid_scale
finding_ids: [A45, A46, S16]
override_ids: [OV-01]
product_goal: Spaces isolated
risk_addressed: Cross-space silent query
hypothesis: cross_space_queries=0
preconditions: Two embed models
fixture_or_dataset: DS-EMBED-SPACE-001
actors: [embedder]
initial_state: Index model A; query model B
event_sequence: [write A, query B, assert reject/separate]
expected_behaviour: Reject or separate; never silent mix
oracle: cross_space_queries == 0
metric: cross_space_queries
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-04
current_code_applicable: partial — EMBEDDING_DIM lock embeddings/index.ts; no registry
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic vectors
observability_required: embed_space_mismatch_total
failure_interpretation: correctness_regression
architecture_consequence: Registry before embed model change
Stage_16_consequence: No embed model change before registry
Stage_17_consequence: No embed model change early
owner: embeddings
traceability_status: fully_traced
```

#### T15-009 — Correction retraction and repeated false-fact stickiness

```yaml
test_id: T15-009
title: Correction retraction and repeated false-fact stickiness
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [S01, A24]
override_ids: [OV-01]
product_goal: Corrections stick
risk_addressed: Silent revive after retract
hypothesis: correction_revive_rate=0
preconditions: Correction succession
fixture_or_dataset: DS-CORRECT-STICKY-001
actors: [Gateway, extraction]
initial_state: Retract F; later repeat F
event_sequence: [retract, extract, retrieve]
expected_behaviour: No silent revive to trusted/current
oracle: correction_revive_rate == 0
metric: correction_revive_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — succession not implemented; sim now
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: correction_revive_total
failure_interpretation: safety_violation
architecture_consequence: Correction stickiness private-beta spine
Stage_16_consequence: Gateway corrections early
Stage_17_consequence: No auto-trust from repeated extraction
owner: memory-lifecycle
traceability_status: fully_traced
```

#### T15-010 — Disclosure fail-open prevention

```yaml
test_id: T15-010
title: Disclosure fail-open prevention
status: specified
priority: P0
evaluation_type: privacy_test
release_gate: before_public_beta
finding_ids: [S07, S31, OV-16, A50]
override_ids: [OV-16, OV-09]
product_goal: Never send forbidden evidence
risk_addressed: Fail-open external send
hypothesis: leak_count=0
preconditions: Disclosure service/sim
fixture_or_dataset: DS-DISCLOSURE-FAILOPEN-001
actors: [disclosure, packer]
initial_state: local_only required evidence
event_sequence: [classify, plan, attempt send]
expected_behaviour: No external forbidden send; terminal degrade
oracle: leak_count == 0
metric: leak_count
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-04
current_code_applicable: no — disclosure absent
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic
observability_required: disclosure_block_total
failure_interpretation: privacy_violation
architecture_consequence: Disclosure before adapters
Stage_16_consequence: Public-beta disclosure required
Stage_17_consequence: No external evidence without disclosure
owner: privacy
traceability_status: fully_traced
```

#### T15-021 — Embarrassing-memory explainability provenance redaction

```yaml
test_id: T15-021
title: Embarrassing-memory explainability provenance redaction
status: specified
priority: P0
evaluation_type: privacy_test
release_gate: before_private_beta
finding_ids: [S22, OV-06, COR-11, A68]
override_ids: [OV-06]
product_goal: Explain without leaking sensitive raw provenance
risk_addressed: Explain returns embarrassing raw evidence
hypothesis: sensitive_explain=0
preconditions: Basic explain path
fixture_or_dataset: DS-EXPLAIN-REDACT-001
actors: [explain, redactor]
initial_state: Embarrassing memory
event_sequence: [ask why, inspect payload]
expected_behaviour: Redacted explanation
oracle: sensitive_explain == 0
metric: sensitive_explain
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-12
current_code_applicable: partial — message_context; full influence deferred
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: medium
false_negative_risk: medium
data_privacy_requirements: synthetic embarrassing facts only
observability_required: explain_redaction_failures
failure_interpretation: privacy_violation
architecture_consequence: Basic explain before full influence
Stage_16_consequence: Do not block on full influence
Stage_17_consequence: Redaction if explain shipped
owner: privacy
traceability_status: fully_traced
```

#### T15-023 — Imported metadata never grants trust

```yaml
test_id: T15-023
title: Imported metadata never grants trust
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [S39, COR-10, OV-15, A03]
override_ids: [OV-15]
product_goal: Import cannot set trust (Stage 10 wins)
risk_addressed: Hostile trusted flags auto-trust
hypothesis: import_trust_grant=0
preconditions: Import path/sim
fixture_or_dataset: DS-HOSTILE-IMPORT-001
actors: [import]
initial_state: Package with trusted=true
event_sequence: [import, inspect trust]
expected_behaviour: Candidates only; zero trust grants
oracle: import_trust_grant == 0
metric: import_trust_grant
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — import package absent; sim now
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic hostile packages
observability_required: import_trust_blocked
failure_interpretation: safety_violation
architecture_consequence: OV-15 binding
Stage_16_consequence: No trust-from-import
Stage_17_consequence: No trust-from-import
owner: import
traceability_status: fully_traced
```

#### T15-024 — Required evidence disclosure token-limit terminal plan

```yaml
test_id: T15-024
title: Required evidence disclosure token-limit terminal plan
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A37, OV-16, COR-04, S08]
override_ids: [OV-16, OV-09]
product_goal: No silent required drop; no false grounded success
risk_addressed: Plans invalidate silently or drop required
hypothesis: silent_drop=0; invalid explicit; no grounded charge
preconditions: Oversized required+disclosure
fixture_or_dataset: DS-REQUIRED-DEADLOCK-001
actors: [packer, billing]
initial_state: Required exceeds context
event_sequence: [plan, assert terminal, assert billing]
expected_behaviour: Explicit invalid; explain; no silent drop; no grounded success charge
oracle: silent_drop==0 AND invalid_plan_explicit AND grounded_success_charge==false
metric: required_evidence_omission_rate
threshold: 0 omission; invalid_plan_explicit=true; grounded_success_charge=false
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — packing absent; sim now
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic
observability_required: invalid_plan_total
failure_interpretation: safety_violation
architecture_consequence: Terminal UX normative
Stage_16_consequence: Encode invalid-plan with packing
Stage_17_consequence: Encode invalid-plan behaviour
owner: retrieval
traceability_status: fully_traced
```

#### T15-028 — Narrow MVA architecture scope conformance

```yaml
test_id: T15-028
title: Narrow MVA architecture scope conformance
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [A56, OV-01, COR-01]
override_ids: [OV-01]
product_goal: First-release is narrow native MVA
risk_addressed: Full 8–12 as launch gate
hypothesis: mva_scope_gate=pass
preconditions: §10A+OV-01 accepted
fixture_or_dataset: DS-POLICY-MVA-001
actors: [architecture review]
initial_state: Plan claiming full 8–12
event_sequence: [review vs §10A]
expected_behaviour: MVA+safety spine only
oracle: mva_scope_gate == pass
metric: mva_scope_gate
threshold: pass (normative acceptance)
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: n/a — process
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: n/a
observability_required: scope_conformance_checked
failure_interpretation: architecture_conformance_failure
architecture_consequence: OV-01 binding
Stage_16_consequence: Sequence MVA→public durable→optional
Stage_17_consequence: First PR only MVA foundation
owner: architecture
traceability_status: fully_traced
```

#### T15-029 — Stage 14 override register precedence

```yaml
test_id: T15-029
title: Stage 14 override register precedence
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [COR-01, COR-14, OV-01, OV-18]
override_ids: [OV-01, OV-18]
product_goal: OV-01…OV-18 normative for 15–17
risk_addressed: Silent restore of superseded 7–13 rules
hypothesis: ov_binding=true
preconditions: PR #47 merged; §6A on main
fixture_or_dataset: DS-POLICY-OV-001
actors: [docs lint]
initial_state: Stage 15–17 drafts
event_sequence: [verify OV cited, no silent restore]
expected_behaviour: Overrides binding; 0–14 historical
oracle: ov_binding == true
metric: ov_binding
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: n/a — process
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: n/a
observability_required: ov_citation_check
failure_interpretation: architecture_conformance_failure
architecture_consequence: OV-18 correction register
Stage_16_consequence: Plan from OV+CE
Stage_17_consequence: Implement only OV-amended scope
owner: architecture
traceability_status: fully_traced
```

#### T15-031 — Summary-to-trust promotion ban

```yaml
test_id: T15-031
title: Summary-to-trust promotion ban
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A03, A20]
override_ids: [OV-01, OV-05]
product_goal: Summaries never auto-trusted
risk_addressed: Summary→trusted without confirm
hypothesis: summary_trust_grant==0
preconditions: Summary ingest/sim
fixture_or_dataset: DS-SUMMARY-TRUST-001
actors: [harness, system under test]
initial_state: Fixture DS-SUMMARY-TRUST-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: summary_trust_grant==0
oracle: summary_trust_grant satisfies threshold
metric: summary_trust_grant
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — summaries deferred; policy sim
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: summary_trust_grant_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-031
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: processing
traceability_status: fully_traced
```

#### T15-032 — Confidence presentation never implies trust

```yaml
test_id: T15-032
title: Confidence presentation never implies trust
status: specified
priority: P0
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A14]
override_ids: [OV-03]
product_goal: Confidence ≠ trust
risk_addressed: Trust-colored confidence
hypothesis: confidence_as_trust_rate==0
preconditions: UI audit
fixture_or_dataset: DS-CONFIDENCE-UI-001
actors: [harness, system under test]
initial_state: Fixture DS-CONFIDENCE-UI-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: confidence_as_trust_rate==0
oracle: confidence_as_trust_rate satisfies threshold
metric: confidence_as_trust_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-10
current_code_applicable: partial — confidence field exists
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: confidence_as_trust_rate_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-032
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-034 — Confirm undo delete propagation latency and completeness

```yaml
test_id: T15-034
title: Confirm undo delete propagation latency and completeness
status: needs_calibration
priority: P0
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [A71, S34]
override_ids: [OV-01]
product_goal: User controls propagate within SLA
risk_addressed: Incomplete/slow confirm/undo/delete
hypothesis: complete within SLA
preconditions: Gateway
fixture_or_dataset: DS-CONFIRM-UNDO-001
actors: [harness, system under test]
initial_state: Fixture DS-CONFIRM-UNDO-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: complete within SLA
oracle: confirm_undo_p95_ms satisfies threshold
metric: confirm_undo_p95_ms
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Measure confirm→visible and undo→visible p95; set SLA with 20% headroom (explore ≤2000ms sync private-beta)
calibration_dataset: DS-CONFIRM-UNDO-001
decision_deadline: Before private beta user-control signoff
threshold_approver: product + Stage 15
failure_if_no_threshold: Private beta cannot claim undo/confirm readiness
required_environment: ENV-02,ENV-10
current_code_applicable: partial — undo UX incomplete
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: confirm_undo_p95_ms_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-034
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-036 — Backup and residual deletion policy conformance

```yaml
test_id: T15-036
title: Backup and residual deletion policy conformance
status: needs_calibration
priority: P0
evaluation_type: privacy_test
release_gate: before_public_beta
finding_ids: [A69, COR-03, OV-14]
override_ids: [OV-14]
product_goal: Honest residual/backup policy
risk_addressed: Backups retain deleted facts without policy
hypothesis: residual_policy_conformance==true
preconditions: Backup SOP + privacy review
fixture_or_dataset: DS-BACKUP-RESIDUAL-001
actors: [harness, system under test]
initial_state: Fixture DS-BACKUP-RESIDUAL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: residual_policy_conformance==true
oracle: residual_policy_conformance satisfies threshold
metric: residual_policy_conformance
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Privacy review checklist oracle for erasable fields, tombstones, backup windows, user communication
calibration_dataset: Policy decision record + DS-BACKUP-RESIDUAL-001
decision_deadline: Before public beta deletion claims
threshold_approver: privacy review owner + Stage 15
failure_if_no_threshold: Public deletion claims blocked; legal_or_privacy_review required
required_environment: ENV-12,ENV-11
current_code_applicable: partial — account delete without residual policy
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic; legal_or_privacy_review=required
observability_required: residual_policy_conformance_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-036
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-037 — Secret detection before durable storage

```yaml
test_id: T15-037
title: Secret detection before durable storage
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [A16, COR-06]
override_ids: [OV-01]
product_goal: Secrets never persisted
risk_addressed: Secrets in durable rows
hypothesis: secret_persist_count==0
preconditions: redaction finalize
fixture_or_dataset: DS-SECRET-PERSIST-001
actors: [harness, system under test]
initial_state: Fixture DS-SECRET-PERSIST-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: secret_persist_count==0
oracle: secret_persist_count satisfies threshold
metric: secret_persist_count
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-02
current_code_applicable: yes — redaction.ts; extraction finalize
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic secret-like strings only
observability_required: secret_persist_count_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-037
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: security
traceability_status: fully_traced
```

#### T15-038 — Secret embedding ban

```yaml
test_id: T15-038
title: Secret embedding ban
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [A16]
override_ids: [OV-01]
product_goal: Secrets never embedded
risk_addressed: Secret text embedded
hypothesis: secret_embed_count==0
preconditions: embed mock
fixture_or_dataset: DS-SECRET-EMBED-001
actors: [harness, system under test]
initial_state: Fixture DS-SECRET-EMBED-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: secret_embed_count==0
oracle: secret_embed_count satisfies threshold
metric: secret_embed_count
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-04
current_code_applicable: partial — verify ordering
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: secret_embed_count_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-038
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: security
traceability_status: fully_traced
```

#### T15-039 — User correction not overwritten by later extraction

```yaml
test_id: T15-039
title: User correction not overwritten by later extraction
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [A24, S01, S44]
override_ids: [OV-01]
product_goal: Corrections stick
risk_addressed: Extraction overwrites correction
hypothesis: correction_overwrite_rate==0
preconditions: Correction then extract
fixture_or_dataset: DS-CORRECT-OVERWRITE-001
actors: [harness, system under test]
initial_state: Fixture DS-CORRECT-OVERWRITE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: correction_overwrite_rate==0
oracle: correction_overwrite_rate satisfies threshold
metric: correction_overwrite_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — succession absent; sim
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: correction_overwrite_rate_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-039
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: memory-lifecycle
traceability_status: fully_traced
```

#### T15-040 — Account deletion Auth-last ordering

```yaml
test_id: T15-040
title: Account deletion Auth-last ordering
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A66, S03, COR-03]
override_ids: [OV-14]
product_goal: Auth-last deletion
risk_addressed: deleteUser before cleanup
hypothesis: auth_last_hold==true
preconditions: Deletion workflow
fixture_or_dataset: DS-ACCOUNT-DELETE-ORDER-001
actors: [harness, system under test]
initial_state: Fixture DS-ACCOUNT-DELETE-ORDER-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: auth_last_hold==true
oracle: auth_last_hold satisfies threshold
metric: auth_last_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-07,ENV-12
current_code_applicable: yes pattern — account/route.ts L37–49
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: auth_last_hold_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-040
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-041 — Auth deletion blocked until cleanup allowed state

```yaml
test_id: T15-041
title: Auth deletion blocked until cleanup allowed state
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A66]
override_ids: [OV-14]
product_goal: Block early Auth delete
risk_addressed: Early Auth delete
hypothesis: early_auth_delete==0
preconditions: Incomplete cleanup
fixture_or_dataset: DS-AUTH-BLOCK-001
actors: [harness, system under test]
initial_state: Fixture DS-AUTH-BLOCK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: early_auth_delete==0
oracle: early_auth_delete satisfies threshold
metric: early_auth_delete
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-12
current_code_applicable: no — coordinator absent
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: early_auth_delete_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-041
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-042 — Atomic assertion state transitions

```yaml
test_id: T15-042
title: Atomic assertion state transitions
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A08]
override_ids: [OV-03]
product_goal: Only legal triad transitions
risk_addressed: Violation of illegal_transition_count
hypothesis: Only legal triad transitions
preconditions: state machine
fixture_or_dataset: DS-STATE-MACHINE-001
actors: [harness, system under test]
initial_state: Fixture DS-STATE-MACHINE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Only legal triad transitions
oracle: illegal_transition_count satisfies threshold
metric: illegal_transition_count
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: illegal_transition_count_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-042
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-043 — Candidate versus trusted eligibility

```yaml
test_id: T15-043
title: Candidate versus trusted eligibility
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A09]
override_ids: [OV-01]
product_goal: Candidates never packed as settled trusted
risk_addressed: Violation of candidate_in_trusted_pack
hypothesis: Candidates never packed as settled trusted
preconditions: eligibility
fixture_or_dataset: DS-CAND-TRUST-001
actors: [harness, system under test]
initial_state: Fixture DS-CAND-TRUST-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Candidates never packed as settled trusted
oracle: candidate_in_trusted_pack satisfies threshold
metric: candidate_in_trusted_pack
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: candidate_in_trusted_pack_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-043
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-044 — Distrusted memory exclusion

```yaml
test_id: T15-044
title: Distrusted memory exclusion
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A08]
override_ids: [OV-03]
product_goal: Distrusted excluded
risk_addressed: Violation of distrusted_in_context
hypothesis: Distrusted excluded
preconditions: eligibility
fixture_or_dataset: DS-DISTRUST-001
actors: [harness, system under test]
initial_state: Fixture DS-DISTRUST-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Distrusted excluded
oracle: distrusted_in_context satisfies threshold
metric: distrusted_in_context
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: distrusted_in_context_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-044
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-046 — Current versus historical selection

```yaml
test_id: T15-046
title: Current versus historical selection
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [A10, S33]
override_ids: [OV-04]
product_goal: Historical never as current
risk_addressed: Violation of stale_current_rate
hypothesis: Historical never as current
preconditions: temporal
fixture_or_dataset: DS-TEMPORAL-001
actors: [harness, system under test]
initial_state: Fixture DS-TEMPORAL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Historical never as current
oracle: stale_current_rate satisfies threshold
metric: stale_current_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: stale_current_rate_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-046
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-051 — Conflict preservation under budget pressure

```yaml
test_id: T15-051
title: Conflict preservation under budget pressure
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [A12, A38]
override_ids: [OV-16]
product_goal: Conflicts reserved before optional fill
risk_addressed: Violation of conflict_miss_rate
hypothesis: Conflicts reserved before optional fill
preconditions: packer
fixture_or_dataset: DS-CONFLICT-BUDGET-001
actors: [harness, system under test]
initial_state: Fixture DS-CONFLICT-BUDGET-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Conflicts reserved before optional fill
oracle: conflict_miss_rate satisfies threshold
metric: conflict_miss_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: conflict_miss_rate_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-051
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-062 — Provider outage preserves memory safety

```yaml
test_id: T15-062
title: Provider outage preserves memory safety
status: specified
priority: P0
evaluation_type: chaos_test
release_gate: before_private_beta
finding_ids: [S40, A37]
override_ids: [OV-09]
product_goal: Outage degrades safely
risk_addressed: Violation of outage_unsafe_serve
hypothesis: Outage degrades safely
preconditions: provider fault
fixture_or_dataset: DS-PROVIDER-OUTAGE-001
actors: [harness, system under test]
initial_state: Fixture DS-PROVIDER-OUTAGE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Outage degrades safely
oracle: outage_unsafe_serve satisfies threshold
metric: outage_unsafe_serve
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-04,ENV-08
current_code_applicable: partial — mock inference
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: outage_unsafe_serve_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-062
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-063 — RLS and IDOR matrix

```yaml
test_id: T15-063
title: RLS and IDOR matrix
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [S29]
override_ids: [OV-01]
product_goal: Tenant isolation
risk_addressed: IDOR success
hypothesis: idor_success==0
preconditions: Two tenants API matrix
fixture_or_dataset: DS-IDOR-001
actors: [harness, system under test]
initial_state: Fixture DS-IDOR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: idor_success==0
oracle: idor_success satisfies threshold
metric: idor_success
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: yes — RLS
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: idor_success_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-063
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: security
traceability_status: fully_traced
```

#### T15-064 — Instruction-shaped memory text isolation

```yaml
test_id: T15-064
title: Instruction-shaped memory text isolation
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [A17]
override_ids: [OV-01]
product_goal: Untrusted memory cannot hijack policy
risk_addressed: Instruction hijack
hypothesis: instruction_hijack==0
preconditions: Untrusted render
fixture_or_dataset: DS-INSTR-MEM-001
actors: [harness, system under test]
initial_state: Fixture DS-INSTR-MEM-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: instruction_hijack==0
oracle: instruction_hijack satisfies threshold
metric: instruction_hijack
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: partial — prompt interpolate
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: instruction_hijack_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-064
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: security
traceability_status: fully_traced
```

#### T15-068 — BYOK does not bypass disclosure

```yaml
test_id: T15-068
title: BYOK does not bypass disclosure
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_public_beta
finding_ids: [A52]
override_ids: [OV-16]
product_goal: BYOK≠consent
risk_addressed: BYOK bypass
hypothesis: byok_bypass==0
preconditions: BYOK path
fixture_or_dataset: DS-BYOK-001
actors: [harness, system under test]
initial_state: Fixture DS-BYOK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: byok_bypass==0
oracle: byok_bypass satisfies threshold
metric: byok_bypass
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-04
current_code_applicable: partial — BYOK exists
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: byok_bypass_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-068
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-071 — Privacy metadata leakage ban

```yaml
test_id: T15-071
title: Privacy metadata leakage ban
status: specified
priority: P0
evaluation_type: privacy_test
release_gate: before_private_beta
finding_ids: [A68]
override_ids: [OV-17]
product_goal: No sensitive metadata leaks
risk_addressed: Meta leak in errors
hypothesis: meta_leak==0
preconditions: error paths
fixture_or_dataset: DS-META-LEAK-001
actors: [harness, system under test]
initial_state: Fixture DS-META-LEAK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: meta_leak==0
oracle: meta_leak satisfies threshold
metric: meta_leak
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: meta_leak_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-071
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-075 — Semantic retrieval relevance floor

```yaml
test_id: T15-075
title: Semantic retrieval relevance floor
status: needs_calibration
priority: P0
evaluation_type: offline_dataset_eval
release_gate: before_private_beta
finding_ids: [OV-07]
override_ids: [OV-07]
product_goal: Semantic quality floor
risk_addressed: Irrelevant retrieval
hypothesis: nDCG@8 >= floor
preconditions: dual-label corpus
fixture_or_dataset: DS-SEM-REL-001
actors: [harness, system under test]
initial_state: Fixture DS-SEM-REL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: nDCG@8 >= floor
oracle: nDCG_at_k satisfies threshold
metric: nDCG_at_k
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Dual-label ≥300 queries; nDCG@8 floor explore ≥0.55; 95% bootstrap CI lower bound ≥ floor-0.03; pin embed+prompt versions; 3 seeds
calibration_dataset: DS-SEM-REL-001
decision_deadline: Before private beta semantic quality signoff
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Private beta semantic quality claims blocked
required_environment: ENV-01,ENV-04
current_code_applicable: partial — match_memories exists
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: nDCG_at_k_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-075
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-078 — Identity allowlist precision

```yaml
test_id: T15-078
title: Identity allowlist precision
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A43]
override_ids: [OV-07]
product_goal: Identity allowlist exact
risk_addressed: False identity hits
hypothesis: identity_precision==1.0
preconditions: allowlist fixtures
fixture_or_dataset: DS-IDENTITY-001
actors: [harness, system under test]
initial_state: Fixture DS-IDENTITY-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: identity_precision==1.0
oracle: identity_precision satisfies threshold
metric: identity_precision
threshold: 1.0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: identity_precision_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-078
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-079 — Conflict retrieval recall

```yaml
test_id: T15-079
title: Conflict retrieval recall
status: needs_calibration
priority: P0
evaluation_type: offline_dataset_eval
release_gate: before_private_beta
finding_ids: [A12]
override_ids: [OV-16]
product_goal: Both conflict sides retrieved
risk_addressed: Missed conflict side
hypothesis: conflict_recall>=floor
preconditions: conflict queries
fixture_or_dataset: DS-CONFLICT-RET-001
actors: [harness, system under test]
initial_state: Fixture DS-CONFLICT-RET-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: conflict_recall>=floor
oracle: conflict_recall satisfies threshold
metric: conflict_recall
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: ≥50 conflict queries; recall floor explore ≥0.95 for both sides
calibration_dataset: DS-CONFLICT-RET-001
decision_deadline: Before private beta conflict packing signoff
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Conflict packing cannot claim readiness
required_environment: ENV-01
current_code_applicable: no — sim/labels
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: conflict_recall_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-079
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-081 — Required evidence packing

```yaml
test_id: T15-081
title: Required evidence packing
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [A37, OV-16]
override_ids: [OV-16]
product_goal: Required never omitted silently
risk_addressed: Omission
hypothesis: required_evidence_omission_rate==0
preconditions: packing sim
fixture_or_dataset: DS-REQ-PACK-001
actors: [harness, system under test]
initial_state: Fixture DS-REQ-PACK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: required_evidence_omission_rate==0
oracle: required_evidence_omission_rate satisfies threshold
metric: required_evidence_omission_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: required_evidence_omission_rate_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-081
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-092 — Embedding model drift detection

```yaml
test_id: T15-092
title: Embedding model drift detection
status: needs_calibration
priority: P0
evaluation_type: offline_dataset_eval
release_gate: embedding_change
finding_ids: [A45]
override_ids: [OV-01]
product_goal: Detect embed drift
risk_addressed: Silent embed upgrade
hypothesis: rank_delta within bound
preconditions: A/B ranks
fixture_or_dataset: DS-SEM-REL-001
actors: [harness, system under test]
initial_state: Fixture DS-SEM-REL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: rank_delta within bound
oracle: rank_delta satisfies threshold
metric: rank_delta
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Spearman ρ≥0.90 vs baseline or full reindex+rebaseline
calibration_dataset: DS-SEM-REL-001
decision_deadline: Before embedding model change
threshold_approver: Stage 15 + embeddings
failure_if_no_threshold: Embedding change prohibited
required_environment: ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rank_delta_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so embedding_change prerequisites exist before relying on T15-092
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: embeddings
traceability_status: fully_traced
```

#### T15-093 — Multiple embedding-space isolation

```yaml
test_id: T15-093
title: Multiple embedding-space isolation
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_paid_scale
finding_ids: [A46]
override_ids: [OV-01]
product_goal: Space isolation
risk_addressed: Cross-space queries
hypothesis: cross_space_queries==0
preconditions: two spaces
fixture_or_dataset: DS-EMBED-ISO-001
actors: [harness, system under test]
initial_state: Fixture DS-EMBED-ISO-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: cross_space_queries==0
oracle: cross_space_queries satisfies threshold
metric: cross_space_queries
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial — dim lock
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: cross_space_queries_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-093
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: embeddings
traceability_status: fully_traced
```

#### T15-097 — Chat and Think retrieval convergence

```yaml
test_id: T15-097
title: Chat and Think retrieval convergence
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [OV-01]
override_ids: [OV-01]
product_goal: Chat/Think eligible sets identical
risk_addressed: Risk:path_divergence
hypothesis: Chat/Think eligible sets identical
preconditions: dual path
fixture_or_dataset: DS-CHAT-THINK-001
actors: [harness, system under test]
initial_state: Fixture DS-CHAT-THINK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Chat/Think eligible sets identical
oracle: path_divergence satisfies threshold
metric: path_divergence
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial — think may duplicate
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: path_divergence_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-097
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-098 — Gateway mutation enforcement

```yaml
test_id: T15-098
title: Gateway mutation enforcement
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [OV-01]
override_ids: [OV-01]
product_goal: Client direct mutation fails
risk_addressed: Risk:direct_mutation_success
hypothesis: Client direct mutation fails
preconditions: RLS+Gateway
fixture_or_dataset: DS-GATEWAY-MUT-001
actors: [harness, system under test]
initial_state: Fixture DS-GATEWAY-MUT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Client direct mutation fails
oracle: direct_mutation_success satisfies threshold
metric: direct_mutation_success
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial — RLS yes Gateway no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: direct_mutation_success_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-098
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: security
traceability_status: fully_traced
```

#### T15-099 — No background publishers in private beta

```yaml
test_id: T15-099
title: No background publishers in private beta
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [OV-11, OV-01]
override_ids: [OV-11]
product_goal: Zero publishers private beta
risk_addressed: Risk:publisher_enabled
hypothesis: Zero publishers private beta
preconditions: config
fixture_or_dataset: DS-NO-PUB-001
actors: [harness, system under test]
initial_state: Fixture DS-NO-PUB-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Zero publishers private beta
oracle: publisher_enabled satisfies threshold
metric: publisher_enabled
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes — absent
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: publisher_enabled_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-099
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

#### T15-100 — Zero adapters enabled initial release

```yaml
test_id: T15-100
title: Zero adapters enabled initial release
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [OV-11]
override_ids: [OV-11]
product_goal: Zero adapters enabled
risk_addressed: Risk:adapter_enabled
hypothesis: Zero adapters enabled
preconditions: config
fixture_or_dataset: DS-NO-ADAPTER-001
actors: [harness, system under test]
initial_state: Fixture DS-NO-ADAPTER-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Zero adapters enabled
oracle: adapter_enabled satisfies threshold
metric: adapter_enabled
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes — default supabase
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: adapter_enabled_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-100
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

#### T15-101 — Sync deletion limitations documented and enforced

```yaml
test_id: T15-101
title: Sync deletion limitations documented and enforced
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [OV-14]
override_ids: [OV-14]
product_goal: Sync delete only without publishers/adapters
risk_addressed: Risk:sync_delete_limits_hold
hypothesis: Sync delete only without publishers/adapters
preconditions: delete
fixture_or_dataset: DS-SYNC-DEL-001
actors: [harness, system under test]
initial_state: Fixture DS-SYNC-DEL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Sync delete only without publishers/adapters
oracle: sync_delete_limits_hold satisfies threshold
metric: sync_delete_limits_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: sync_delete_limits_hold_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-101
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-110 — Undo discoverability

```yaml
test_id: T15-110
title: Undo discoverability
status: needs_calibration
priority: P0
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A71]
override_ids: [OV-01]
product_goal: Users find undo
risk_addressed: Undiscoverable undo
hypothesis: undo_find_rate>=floor
preconditions: UP-UNDO-001
fixture_or_dataset: DS-UX-UNDO-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-UNDO-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: undo_find_rate>=floor
oracle: undo_find_rate satisfies threshold
metric: undo_find_rate
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12; find rate explore ≥0.85 within 60s
calibration_dataset: DS-UX-UNDO-001
decision_deadline: Before private beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Undo UX blocked
required_environment: ENV-10
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: undo_find_rate_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-110
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-121 — Native-only quality floor

```yaml
test_id: T15-121
title: Native-only quality floor
status: needs_calibration
priority: P0
evaluation_type: offline_dataset_eval
release_gate: before_private_beta
finding_ids: [OV-11]
override_ids: [OV-11]
product_goal: Native-only meets quality floor
risk_addressed: Adapter-dependent quality
hypothesis: native_ndcg meets T15-075 floor
preconditions: adapters off
fixture_or_dataset: DS-SEM-REL-001
actors: [harness, system under test]
initial_state: Fixture DS-SEM-REL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: native_ndcg meets T15-075 floor
oracle: native_ndcg satisfies threshold
metric: native_ndcg
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: With adapters off, nDCG@8 must meet T15-075 floor; native floor is the release floor
calibration_dataset: DS-SEM-REL-001
decision_deadline: Before private beta
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Private beta native quality blocked
required_environment: ENV-01,ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: native_ndcg_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-121
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-122 — Adapter disablement conformance

```yaml
test_id: T15-122
title: Adapter disablement conformance
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: adapter_enablement
finding_ids: [OV-11, OV-12]
override_ids: [OV-11, OV-12]
product_goal: Disable leaves zero remote-text authority
risk_addressed: Risk:disable_hold
hypothesis: Disable leaves zero remote-text authority
preconditions: flag
fixture_or_dataset: DS-ADAPTER-OFF-001
actors: [harness, system under test]
initial_state: Fixture DS-ADAPTER-OFF-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Disable leaves zero remote-text authority
oracle: disable_hold satisfies threshold
metric: disable_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-05
current_code_applicable: partial — MEMORY_PROVIDER
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: disable_hold_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so adapter_enablement prerequisites exist before relying on T15-122
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: adapters
traceability_status: fully_traced
```

#### T15-123 — Deletion during extraction race

```yaml
test_id: T15-123
title: Deletion during extraction race
status: specified
priority: P0
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [A66, S03]
override_ids: [OV-14]
product_goal: No resurrection delete-during-extract
risk_addressed: Risk:deletion_resurrection_rate
hypothesis: No resurrection delete-during-extract
preconditions: race
fixture_or_dataset: DS-DEL-EXTRACT-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-EXTRACT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: No resurrection delete-during-extract
oracle: deletion_resurrection_rate satisfies threshold
metric: deletion_resurrection_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-08
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: deletion_resurrection_rate_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-123
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-124 — Deletion during indexing race

```yaml
test_id: T15-124
title: Deletion during indexing race
status: specified
priority: P0
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [A66]
override_ids: [OV-14]
product_goal: No resurrection delete-during-index
risk_addressed: Risk:deletion_resurrection_rate
hypothesis: No resurrection delete-during-index
preconditions: race
fixture_or_dataset: DS-DEL-INDEX-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-INDEX-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: No resurrection delete-during-index
oracle: deletion_resurrection_rate satisfies threshold
metric: deletion_resurrection_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-08
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: deletion_resurrection_rate_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-124
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-128 — Forget one memory proof

```yaml
test_id: T15-128
title: Forget one memory proof
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [OV-14]
override_ids: [OV-14]
product_goal: Forgotten absent from eligible retrieve in controlled stores
risk_addressed: Risk:forget_residual
hypothesis: Forgotten absent from eligible retrieve in controlled stores
preconditions: forget
fixture_or_dataset: DS-FORGET-ONE-001
actors: [harness, system under test]
initial_state: Fixture DS-FORGET-ONE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Forgotten absent from eligible retrieve in controlled stores
oracle: forget_residual satisfies threshold
metric: forget_residual
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: forget_residual_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-128
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-129 — Delete one document proof

```yaml
test_id: T15-129
title: Delete one document proof
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [OV-14]
override_ids: [OV-14]
product_goal: Deleted doc/chunks absent
risk_addressed: Risk:doc_residual
hypothesis: Deleted doc/chunks absent
preconditions: doc delete
fixture_or_dataset: DS-DEL-DOC-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-DOC-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Deleted doc/chunks absent
oracle: doc_residual satisfies threshold
metric: doc_residual
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: doc_residual_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-129
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-132 — Audit residual inspection after purge

```yaml
test_id: T15-132
title: Audit residual inspection after purge
status: specified
priority: P0
evaluation_type: privacy_test
release_gate: before_public_beta
finding_ids: [OV-17, COR-16]
override_ids: [OV-17]
product_goal: Post-purge audit no raw fact text
risk_addressed: Risk:audit_raw_residual
hypothesis: Post-purge audit no raw fact text
preconditions: audit
fixture_or_dataset: DS-AUDIT-RESIDUAL-001
actors: [harness, system under test]
initial_state: Fixture DS-AUDIT-RESIDUAL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Post-purge audit no raw fact text
oracle: audit_raw_residual satisfies threshold
metric: audit_raw_residual
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-12
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: audit_raw_residual_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-132
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-134 — Operational telemetry without raw text

```yaml
test_id: T15-134
title: Operational telemetry without raw text
status: specified
priority: P0
evaluation_type: privacy_test
release_gate: before_public_beta
finding_ids: [A68, OV-17]
override_ids: [OV-17]
product_goal: Telemetry has no raw memory text
risk_addressed: Risk:telemetry_raw
hypothesis: Telemetry has no raw memory text
preconditions: logs
fixture_or_dataset: DS-TELEMETRY-RAW-001
actors: [harness, system under test]
initial_state: Fixture DS-TELEMETRY-RAW-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Telemetry has no raw memory text
oracle: telemetry_raw satisfies threshold
metric: telemetry_raw
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-12
current_code_applicable: partial — perf.ts
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: telemetry_raw_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-134
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-138 — Hidden instruction document corpus

```yaml
test_id: T15-138
title: Hidden instruction document corpus
status: specified
priority: P0
evaluation_type: security_test
release_gate: before_private_beta
finding_ids: [A17, S05]
override_ids: [OV-01]
product_goal: Hidden instructions never succeed
risk_addressed: Risk:hidden_inject_success
hypothesis: Hidden instructions never succeed
preconditions: docs
fixture_or_dataset: DS-HIDDEN-INSTR-001
actors: [harness, system under test]
initial_state: Fixture DS-HIDDEN-INSTR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Hidden instructions never succeed
oracle: hidden_inject_success satisfies threshold
metric: hidden_inject_success
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: hidden_inject_success_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-138
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: document-security
traceability_status: fully_traced
```

#### T15-139 — Document contradicts personal memory conflict path

```yaml
test_id: T15-139
title: Document contradicts personal memory conflict path
status: specified
priority: P0
evaluation_type: simulation
release_gate: before_private_beta
finding_ids: [S06, A12]
override_ids: [OV-16]
product_goal: Doc vs memory uses conflict path
risk_addressed: Risk:dual_truth_rate
hypothesis: Doc vs memory uses conflict path
preconditions: conflict
fixture_or_dataset: DS-DOC-VS-MEM-001
actors: [harness, system under test]
initial_state: Fixture DS-DOC-VS-MEM-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Doc vs memory uses conflict path
oracle: dual_truth_rate satisfies threshold
metric: dual_truth_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: dual_truth_rate_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-139
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-141 — Oversized required evidence terminal plan

```yaml
test_id: T15-141
title: Oversized required evidence terminal plan
status: specified
priority: P0
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A37, S08]
override_ids: [OV-16]
product_goal: Oversized required ⇒ invalid plan
risk_addressed: Risk:silent_drop
hypothesis: Oversized required ⇒ invalid plan
preconditions: packing
fixture_or_dataset: DS-OVERSIZE-REQ-001
actors: [harness, system under test]
initial_state: Fixture DS-OVERSIZE-REQ-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Oversized required ⇒ invalid plan
oracle: silent_drop satisfies threshold
metric: silent_drop
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: silent_drop_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-141
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-144 — Confirm-to-undo completeness across derived stores

```yaml
test_id: T15-144
title: Confirm-to-undo completeness across derived stores
status: specified
priority: P0
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A71, A57]
override_ids: [OV-01]
product_goal: Undo complete across canonical+derived
risk_addressed: Risk:undo_incomplete
hypothesis: Undo complete across canonical+derived
preconditions: undo
fixture_or_dataset: DS-UNDO-DERIVED-001
actors: [harness, system under test]
initial_state: Fixture DS-UNDO-DERIVED-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Undo complete across canonical+derived
oracle: undo_incomplete satisfies threshold
metric: undo_incomplete
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07
current_code_applicable: no — publishers absent private beta
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: undo_incomplete_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-144
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-146 — Automatic consolidation ban private beta

```yaml
test_id: T15-146
title: Automatic consolidation ban private beta
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [A21]
override_ids: [OV-01]
product_goal: No auto consolidation
risk_addressed: Risk:auto_consolidate
hypothesis: No auto consolidation
preconditions: config
fixture_or_dataset: DS-NO-CONCAT-001
actors: [harness, system under test]
initial_state: Fixture DS-NO-CONCAT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: No auto consolidation
oracle: auto_consolidate satisfies threshold
metric: auto_consolidate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes — absent
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: auto_consolidate_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-146
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

#### T15-147 — Graphiti deferred conformance

```yaml
test_id: T15-147
title: Graphiti deferred conformance
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [OV-05, COR-09]
override_ids: [OV-05]
product_goal: No Graphiti/Neo4j required path
risk_addressed: Risk:graphiti_absent
hypothesis: No Graphiti/Neo4j required path
preconditions: deps
fixture_or_dataset: DS-NO-GRAPHITI-001
actors: [harness, system under test]
initial_state: Fixture DS-NO-GRAPHITI-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: No Graphiti/Neo4j required path
oracle: graphiti_absent satisfies threshold
metric: graphiti_absent
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes — absent
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: graphiti_absent_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-147
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

#### T15-148 — Multi-provider planning deferred

```yaml
test_id: T15-148
title: Multi-provider planning deferred
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [OV-09, COR-12]
override_ids: [OV-09]
product_goal: Single-provider only
risk_addressed: Risk:multi_provider_plan
hypothesis: Single-provider only
preconditions: config
fixture_or_dataset: DS-SINGLE-PROV-001
actors: [harness, system under test]
initial_state: Fixture DS-SINGLE-PROV-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Single-provider only
oracle: multi_provider_plan satisfies threshold
metric: multi_provider_plan
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: multi_provider_plan_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-148
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

#### T15-149 — Reranker deferred private beta

```yaml
test_id: T15-149
title: Reranker deferred private beta
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [OV-11]
override_ids: [OV-11]
product_goal: Reranker not enabled
risk_addressed: Risk:reranker_enabled
hypothesis: Reranker not enabled
preconditions: config
fixture_or_dataset: DS-NO-RERANK-001
actors: [harness, system under test]
initial_state: Fixture DS-NO-RERANK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Reranker not enabled
oracle: reranker_enabled satisfies threshold
metric: reranker_enabled
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: yes — absent
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: reranker_enabled_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-149
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

#### T15-150 — End-to-end determinism claim ban

```yaml
test_id: T15-150
title: End-to-end determinism claim ban
status: specified
priority: P0
evaluation_type: policy_conformance
release_gate: before_private_beta
finding_ids: [OV-13, COR-02]
override_ids: [OV-13]
product_goal: No E2E determinism claims beyond frozen inputs
risk_addressed: Risk:e2e_determinism_claim
hypothesis: No E2E determinism claims beyond frozen inputs
preconditions: docs lint
fixture_or_dataset: DS-NO-E2E-DET-001
actors: [harness, system under test]
initial_state: Fixture DS-NO-E2E-DET-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: No E2E determinism claims beyond frozen inputs
oracle: e2e_determinism_claim satisfies threshold
metric: e2e_determinism_claim
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: n/a process
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: e2e_determinism_claim_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-150
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: architecture
traceability_status: fully_traced
```

### 17.2 Priority P1

#### T15-011 — WRRF policy domination under pinned version

```yaml
test_id: T15-011
title: WRRF policy domination under pinned version
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [D18, A35, OV-08, COR-08]
override_ids: [OV-08]
product_goal: Fusion family holds; constants versioned
risk_addressed: Sacred unversioned λ/k
hypothesis: domination_hold true under pin
preconditions: Pinned retrieval_policy_version
fixture_or_dataset: DS-WRRF-DOM-001
actors: [fusion]
initial_state: Adversarial ranks
event_sequence: [compute, assert domination]
expected_behaviour: |Final−WRRF|≤λ·WRRF; WRRF0⇒Final0
oracle: domination_hold == true
metric: domination_hold
threshold: true under pinned retrieval_policy_version
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — WRRF absent
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic ranks
observability_required: retrieval_policy_version
failure_interpretation: architecture_conformance_failure
architecture_consequence: Version constants; calibrate before gating
Stage_16_consequence: Do not freeze λ/k
Stage_17_consequence: No hardcode-as-correctness
owner: retrieval
traceability_status: fully_traced
```

#### T15-012 — Cross-model eligible memory set invariance

```yaml
test_id: T15-012
title: Cross-model eligible memory set invariance
status: specified
priority: P1
evaluation_type: simulation
release_gate: before_public_beta
finding_ids: [S35, D29]
override_ids: [OV-13]
product_goal: Eligible IDs invariant; answers may vary
risk_addressed: Model switch changes eligibility
hypothesis: eligible_set_hamming=0
preconditions: Same vault; two models
fixture_or_dataset: DS-CROSS-MODEL-001
actors: [eligibility]
initial_state: Identical vault
event_sequence: [eligible A, eligible B, hamming]
expected_behaviour: Same eligible IDs
oracle: eligible_set_hamming == 0
metric: eligible_set_hamming
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-04
current_code_applicable: partial — retrieve sets comparable today
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: eligible_set_hash
failure_interpretation: architecture_conformance_failure
architecture_consequence: Pin eligibility independent of answer model
Stage_16_consequence: Measure before claiming independence
Stage_17_consequence: No independence claim without green
owner: independence
traceability_status: fully_traced
```

#### T15-013 — Export watermarking during migration

```yaml
test_id: T15-013
title: Export watermarking during migration
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [S04, C21, A70]
override_ids: [OV-01]
product_goal: Portability honesty
risk_addressed: False-complete export mid-migration
hypothesis: false_complete=0
preconditions: Dual-read migration state
fixture_or_dataset: DS-EXPORT-MIG-001
actors: [export]
initial_state: Partial migration
event_sequence: [export, inspect watermark/block]
expected_behaviour: Watermark or block; never silent complete
oracle: false_complete == 0
metric: false_complete
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-11
current_code_applicable: partial — export/route.ts without watermark
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic packages
observability_required: export_watermark_present
failure_interpretation: architecture_conformance_failure
architecture_consequence: Canonical export with watermarks
Stage_16_consequence: Export redesign before portability marketing
Stage_17_consequence: No false-complete export
owner: portability
traceability_status: fully_traced
```

#### T15-014 — Chat survives worker outage with visible lag

```yaml
test_id: T15-014
title: Chat survives worker outage with visible lag
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [S18, A62, COR-13]
override_ids: [OV-01]
product_goal: Chat available when workers down
risk_addressed: Outage blocks chat or hides lag
hypothesis: chat_success_rate≥0.99/100; lag visible
preconditions: Workers paused
fixture_or_dataset: DS-WORKER-OUTAGE-001
actors: [chat, workers]
initial_state: Workers stopped
event_sequence: [pause, 100 turns, check success+lag]
expected_behaviour: Chat succeeds; lag visible
oracle: chat_success_rate >= 0.99 AND lag_visible
metric: chat_success_rate
threshold: >= 0.99 over 100 turns; lag_visible=true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-08
current_code_applicable: no — workers absent
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: job_lag_seconds
failure_interpretation: resilience_failure
architecture_consequence: Request-path independent of workers
Stage_16_consequence: Worker platform for public beta
Stage_17_consequence: First PR must not require workers for chat
owner: ops
traceability_status: fully_traced
```

#### T15-015 — PostgreSQL outage never yields Mem0-only truth

```yaml
test_id: T15-015
title: PostgreSQL outage never yields Mem0-only truth
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: adapter_enablement
finding_ids: [S19, OV-11, OV-12, COR-05]
override_ids: [OV-11, OV-12]
product_goal: Adapters never authority when PG down
risk_addressed: Mem0-only truth on PG error
hypothesis: native_bypass=0
preconditions: Adapter PoC; PG faults
fixture_or_dataset: DS-PG-DOWN-MEM0-UP-001
actors: [chat, Mem0, PG]
initial_state: PG fail; Mem0 up
event_sequence: [fault PG, chat, assert no Mem0-only memory]
expected_behaviour: Fail closed/degrade without remote-text authority
oracle: native_bypass == 0
metric: native_bypass
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-05,ENV-08
current_code_applicable: yes if MEMORY_PROVIDER=mem0
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic
observability_required: native_bypass_blocked_total
failure_interpretation: safety_violation
architecture_consequence: Zero adapters until ID-only harden
Stage_16_consequence: Enable adapters only after green
Stage_17_consequence: Forbid enabling Mem0 in first PR
owner: memory-security
traceability_status: fully_traced
```

#### T15-019 — Review queue growth and random-confirm proxy

```yaml
test_id: T15-019
title: Review queue growth and random-confirm proxy
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [S36, A71, A07]
override_ids: [OV-03]
product_goal: Review queue usable
risk_addressed: Random confirms from fatigue
hypothesis: random_confirm_proxy under max
preconditions: Queues 100/1000/5000
fixture_or_dataset: DS-QUEUE-FATIGUE-001
actors: [review UI, sim]
initial_state: High candidate inflow
event_sequence: [simulate, measure proxy, optional study]
expected_behaviour: Rate limits/batch tools; proxy below threshold
oracle: random_confirm_proxy <= calibrated_max
metric: random_confirm_proxy
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Define proxy (latency variance/skip rate) on 100/1000/5000 queues; set max; confirm with n≥12 when practical
calibration_dataset: DS-QUEUE-FATIGUE-001 + UP-REVIEW-001
decision_deadline: Before private beta review UX signoff
threshold_approver: product + Stage 15
failure_if_no_threshold: Review UX cannot claim readiness
required_environment: ENV-10,ENV-01
current_code_applicable: partial — proposed status exists
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: medium
false_negative_risk: high
data_privacy_requirements: synthetic; consented participants
observability_required: review_queue_depth
failure_interpretation: usability_failure
architecture_consequence: Collapse UX states; precision>recall
Stage_16_consequence: Thin review surface
Stage_17_consequence: Do not ship full review enum UX
owner: product-ux
traceability_status: fully_traced
```

#### T15-020 — Tokenizer mismatch bounded exact-pack retries

```yaml
test_id: T15-020
title: Tokenizer mismatch bounded exact-pack retries
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [A39, S09, COR-02]
override_ids: [OV-13]
product_goal: Recover without unbounded loops
risk_addressed: Exact tokenize invalidates forever
hypothesis: unbounded_loop=0; attempts≤3
preconditions: Estimate≠exact fixture
fixture_or_dataset: DS-TOKENIZER-MISMATCH-001
actors: [packer]
initial_state: Estimate undercounts
event_sequence: [pack, exact fail, retry≤3, terminal]
expected_behaviour: Bounded retries then explicit invalid
oracle: unbounded_loop == 0 AND attempts <= 3
metric: unbounded_loop
threshold: 0; max_exact_pack_attempts <= 3
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — packing absent
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic
observability_required: exact_pack_attempts
failure_interpretation: correctness_regression
architecture_consequence: OV-13 bound exact-pack
Stage_16_consequence: Encode attempt bound
Stage_17_consequence: Do not claim E2E determinism
owner: retrieval
traceability_status: fully_traced
```

#### T15-022 — Forget versus transcript eligibility policy

```yaml
test_id: T15-022
title: Forget versus transcript eligibility policy
status: needs_calibration
priority: P1
evaluation_type: policy_conformance
release_gate: before_public_beta
finding_ids: [S23]
override_ids: [OV-14]
product_goal: Forget without history-as-memory-authority
risk_addressed: Forgotten fact re-enters via history
hypothesis: memory_via_history per calibrated oracle
preconditions: Policy decision record
fixture_or_dataset: DS-FORGET-HISTORY-001
actors: [forget, history]
initial_state: Forget memory; keep conversation
event_sequence: [forget, query, inspect eligibility]
expected_behaviour: History not memory authority per policy
oracle: memory_via_history satisfies calibrated oracle
metric: memory_via_history
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Decide forget-vs-transcript policy with privacy review; encode boolean oracle
calibration_dataset: Policy decision record + DS-FORGET-HISTORY-001
decision_deadline: Before forget/erasure marketing claims
threshold_approver: privacy review owner + Stage 15
failure_if_no_threshold: Forget unresolved; cannot market as erasure
required_environment: ENV-02,ENV-12
current_code_applicable: partial — delete exists; history channel absent
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: medium
false_negative_risk: high
data_privacy_requirements: synthetic; legal_or_privacy_review=required
observability_required: forget_via_history_total
failure_interpretation: privacy_violation or accepted_risk_trigger
architecture_consequence: OV-14 honest residuals
Stage_16_consequence: Encode policy before public forget marketing
Stage_17_consequence: No erasure marketing without policy
owner: privacy
traceability_status: fully_traced
```

#### T15-025 — Profile force-merge retirement under target rules

```yaml
test_id: T15-025
title: Profile force-merge retirement under target rules
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [COR-07]
override_ids: [OV-01]
product_goal: Eligibility by relevance
risk_addressed: Unconditional profile force-include
hypothesis: forced_irrelevant=0 under target rules
preconditions: Target eligibility on
fixture_or_dataset: DS-PROFILE-FORCE-001
actors: [chat orchestration]
initial_state: Irrelevant active profile mem
event_sequence: [retrieve unrelated, assert not force-included]
expected_behaviour: No unconditional force-include
oracle: forced_irrelevant == 0
metric: forced_irrelevant
threshold: 0 (target behaviour)
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01,ENV-02
current_code_applicable: yes — chat.ts L98–111 similarity:1 profile force-merge
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic
observability_required: force_merge_total
failure_interpretation: correctness_regression
architecture_consequence: Retire always-include force-merge
Stage_16_consequence: COR-07 before private beta default
Stage_17_consequence: Change only under Stage 17 flag
owner: retrieval
traceability_status: fully_traced
```

#### T15-026 — Adapter dual-write divergence reconcile-only

```yaml
test_id: T15-026
title: Adapter dual-write divergence reconcile-only
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: adapter_enablement
finding_ids: [A57, S41, A05]
override_ids: [OV-11]
product_goal: Canonical wins on divergence
risk_addressed: Divergent remote-text serve
hypothesis: divergent_serve=0
preconditions: Adapter dual-write PoC
fixture_or_dataset: DS-DUAL-WRITE-001
actors: [publisher, adapter]
initial_state: Canonical ok; external fail
event_sequence: [write, fail external, retrieve]
expected_behaviour: Reconcile-only; no remote text
oracle: divergent_serve == 0
metric: divergent_serve
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-05,ENV-07,ENV-08
current_code_applicable: n/a until adapters
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: divergent_serve_blocked
failure_interpretation: safety_violation
architecture_consequence: Adapters after DeletionCoordinator+reconcile
Stage_16_consequence: PoC only after gates
Stage_17_consequence: No adapter dual-write in first PR
owner: adapters
traceability_status: fully_traced
```

#### T15-027 — Worker poison-message DLQ isolation

```yaml
test_id: T15-027
title: Worker poison-message DLQ isolation
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A58, S42, A63]
override_ids: [OV-01]
product_goal: Poison must not block queue
risk_addressed: HOL block / retry storm
hypothesis: poison_blocks_queue=false
preconditions: Worker+DLQ
fixture_or_dataset: DS-POISON-JOB-001
actors: [worker, DLQ]
initial_state: Malformed among valid
event_sequence: [enqueue, run, assert DLQ+valid complete]
expected_behaviour: Poison DLQ bounded retries; others proceed
oracle: poison_blocks_queue == false
metric: poison_blocks_queue
threshold: false
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07
current_code_applicable: no — workers absent
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic malformed
observability_required: dlq_depth
failure_interpretation: resilience_failure
architecture_consequence: DLQ+bounded retries before publishers
Stage_16_consequence: Worker platform prerequisite
Stage_17_consequence: First durable write needs idempotency keys
owner: ops
traceability_status: fully_traced
```

#### T15-030 — WRRF constants version-pinned not sacred

```yaml
test_id: T15-030
title: WRRF constants version-pinned not sacred
status: specified
priority: P1
evaluation_type: policy_conformance
release_gate: before_public_beta
finding_ids: [COR-08, OV-08, A35]
override_ids: [OV-08]
product_goal: Constants only via retrieval_policy_version
risk_addressed: λ/k eternal correctness
hypothesis: sacred_constant=false
preconditions: Policy version doc
fixture_or_dataset: DS-POLICY-WRRF-001
actors: [docs, fusion config]
initial_state: Sacred unversioned claims
event_sequence: [scan, assert version pin]
expected_behaviour: Constants via version pin only
oracle: sacred_constant == false
metric: sacred_constant
threshold: false
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: n/a
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: n/a
observability_required: retrieval_policy_version
failure_interpretation: architecture_conformance_failure
architecture_consequence: OV-08
Stage_16_consequence: Don't freeze λ/k
Stage_17_consequence: No hardcode-as-correctness
owner: retrieval
traceability_status: fully_traced
```

#### T15-033 — Repair queue bounded growth and DLQ

```yaml
test_id: T15-033
title: Repair queue bounded growth and DLQ
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [A67]
override_ids: [OV-01]
product_goal: Repair loops bounded
risk_addressed: Unbounded repair
hypothesis: repair_bound_hold==true
preconditions: Repair subsystem
fixture_or_dataset: DS-REPAIR-BOUND-001
actors: [harness, system under test]
initial_state: Fixture DS-REPAIR-BOUND-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: repair_bound_hold==true
oracle: repair_bound_hold satisfies threshold
metric: repair_bound_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-08
current_code_applicable: no — repair absent
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: repair_bound_hold_metric
failure_interpretation: resilience_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-033
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: ops
traceability_status: fully_traced
```

#### T15-035 — Review-queue usability floor study

```yaml
test_id: T15-035
title: Review-queue usability floor study
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A71, A07, S36]
override_ids: [OV-03]
product_goal: Usable review without harmful random confirms
risk_addressed: Queue overload
hypothesis: queue_task_success>=floor
preconditions: UP-REVIEW-001 n≥12
fixture_or_dataset: DS-QUEUE-UX-001
actors: [harness, system under test]
initial_state: Fixture DS-QUEUE-UX-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: queue_task_success>=floor
oracle: queue_task_success satisfies threshold
metric: queue_task_success
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Run UP-REVIEW-001 n≥12; success floor explore ≥0.85; max median task time pinned
calibration_dataset: DS-QUEUE-UX-001
decision_deadline: Before private beta review UX signoff
threshold_approver: product + Stage 15
failure_if_no_threshold: Review UX cannot claim readiness
required_environment: ENV-10
current_code_applicable: no — thin review UX not shipped
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: queue_task_success_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-035
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-045 — Expiration boundary DB-time eligibility

```yaml
test_id: T15-045
title: Expiration boundary DB-time eligibility
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [A59, A13]
override_ids: [OV-04]
product_goal: Expired not eligible using DB time
risk_addressed: Violation of expired_eligible
hypothesis: Expired not eligible using DB time
preconditions: expires
fixture_or_dataset: DS-EXPIRE-001
actors: [harness, system under test]
initial_state: Fixture DS-EXPIRE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Expired not eligible using DB time
oracle: expired_eligible satisfies threshold
metric: expired_eligible
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial — expires_at
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: expired_eligible_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-045
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-047 — Correction succession linear history

```yaml
test_id: T15-047
title: Correction succession linear history
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A08, A24]
override_ids: [OV-01]
product_goal: Linear succession
risk_addressed: Violation of succession_hold
hypothesis: Linear succession
preconditions: succession
fixture_or_dataset: DS-SUCCESSION-001
actors: [harness, system under test]
initial_state: Fixture DS-SUCCESSION-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Linear succession
oracle: succession_hold satisfies threshold
metric: succession_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: succession_hold_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-047
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-048 — Concurrent corrections from two devices

```yaml
test_id: T15-048
title: Concurrent corrections from two devices
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_private_beta
finding_ids: [S02, A60]
override_ids: [OV-01]
product_goal: Single head after concurrent corrections
risk_addressed: Violation of dual_head_rate
hypothesis: Single head after concurrent corrections
preconditions: concurrency
fixture_or_dataset: DS-CONCURRENT-CORR-001
actors: [harness, system under test]
initial_state: Fixture DS-CONCURRENT-CORR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Single head after concurrent corrections
oracle: dual_head_rate satisfies threshold
metric: dual_head_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: no — Gateway future
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: dual_head_rate_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-048
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-049 — Near-miss merge rejection

```yaml
test_id: T15-049
title: Near-miss merge rejection
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [A19]
override_ids: [OV-01]
product_goal: Distinct near-miss not merged
risk_addressed: False merge near-miss
hypothesis: near_miss_false_merge under floor
preconditions: dedupe labels
fixture_or_dataset: DS-NEARMISS-001
actors: [harness, system under test]
initial_state: Fixture DS-NEARMISS-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: near_miss_false_merge under floor
oracle: near_miss_false_merge satisfies threshold
metric: near_miss_false_merge
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Set near_miss_false_merge max (explore ≤0.02) on ≥100 labelled pairs
calibration_dataset: DS-NEARMISS-001
decision_deadline: Before dedupe algorithm selection
threshold_approver: Stage 15 + memory design
failure_if_no_threshold: Dedupe algorithm selection prohibited
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: near_miss_false_merge_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-049
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: processing
traceability_status: fully_traced
```

#### T15-050 — Summary non-authority in packing

```yaml
test_id: T15-050
title: Summary non-authority in packing
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_private_beta
finding_ids: [A20, A03]
override_ids: [OV-01]
product_goal: Summaries never sole required authority
risk_addressed: Violation of summary_as_required
hypothesis: Summaries never sole required authority
preconditions: packer
fixture_or_dataset: DS-SUMMARY-PACK-001
actors: [harness, system under test]
initial_state: Fixture DS-SUMMARY-PACK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Summaries never sole required authority
oracle: summary_as_required satisfies threshold
metric: summary_as_required
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no — sim
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: summary_as_required_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-050
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-052 — Import and re-import duplication

```yaml
test_id: T15-052
title: Import and re-import duplication
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [A70]
override_ids: [OV-15]
product_goal: Re-import no duplicate/trust-grant
risk_addressed: Violation of import_dup_rate
hypothesis: Re-import no duplicate/trust-grant
preconditions: import
fixture_or_dataset: DS-REIMPORT-001
actors: [harness, system under test]
initial_state: Fixture DS-REIMPORT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Re-import no duplicate/trust-grant
oracle: import_dup_rate satisfies threshold
metric: import_dup_rate
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-11
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: import_dup_rate_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-052
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-053 — Idempotent extraction retry

```yaml
test_id: T15-053
title: Idempotent extraction retry
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A23, A64]
override_ids: [OV-01]
product_goal: Idempotent retry writes once
risk_addressed: Violation of dup_write_on_retry
hypothesis: Idempotent retry writes once
preconditions: outbox
fixture_or_dataset: DS-IDEMPOTENT-EXTRACT-001
actors: [harness, system under test]
initial_state: Fixture DS-IDEMPOTENT-EXTRACT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Idempotent retry writes once
oracle: dup_write_on_retry satisfies threshold
metric: dup_write_on_retry
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07
current_code_applicable: no — workers absent
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: dup_write_on_retry_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-053
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-054 — Partial batch failure per-item completion

```yaml
test_id: T15-054
title: Partial batch failure per-item completion
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A65]
override_ids: [OV-01]
product_goal: Per-item ready flags
risk_addressed: Violation of per_item_complete
hypothesis: Per-item ready flags
preconditions: workers
fixture_or_dataset: DS-PARTIAL-BATCH-001
actors: [harness, system under test]
initial_state: Fixture DS-PARTIAL-BATCH-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Per-item ready flags
oracle: per_item_complete satisfies threshold
metric: per_item_complete
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: per_item_complete_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-054
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-055 — Clock skew expiration

```yaml
test_id: T15-055
title: Clock skew expiration
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_private_beta
finding_ids: [A59, S43]
override_ids: [OV-04]
product_goal: DB-time under skew
risk_addressed: Violation of skew_eligible_error
hypothesis: DB-time under skew
preconditions: time
fixture_or_dataset: DS-CLOCK-SKEW-001
actors: [harness, system under test]
initial_state: Fixture DS-CLOCK-SKEW-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: DB-time under skew
oracle: skew_eligible_error satisfies threshold
metric: skew_eligible_error
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: skew_eligible_error_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-055
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-056 — Correction and retrieval race SLO

```yaml
test_id: T15-056
title: Correction and retrieval race SLO
status: needs_calibration
priority: P1
evaluation_type: chaos_test
release_gate: before_private_beta
finding_ids: [A60, S44]
override_ids: [OV-01]
product_goal: Staleness SLO held
risk_addressed: Stale head after correction
hypothesis: stale_head_rate under max
preconditions: concurrency harness
fixture_or_dataset: DS-CORR-RETRIEVE-RACE-001
actors: [harness, system under test]
initial_state: Fixture DS-CORR-RETRIEVE-RACE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: stale_head_rate under max
oracle: stale_head_rate satisfies threshold
metric: stale_head_rate
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Define stale_head_rate max (explore ≤0.01 over 200 races); document SLO
calibration_dataset: DS-CORR-RETRIEVE-RACE-001
decision_deadline: Before private beta concurrency signoff
threshold_approver: Stage 15 + architecture
failure_if_no_threshold: Concurrency SLO undocumented
required_environment: ENV-02
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: stale_head_rate_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-056
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-057 — Schema and worker version mismatch gate

```yaml
test_id: T15-057
title: Schema and worker version mismatch gate
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [A58, S28]
override_ids: [OV-01]
product_goal: Old workers reject incompatible schema
risk_addressed: Violation of mismatch_accept
hypothesis: Old workers reject incompatible schema
preconditions: version
fixture_or_dataset: DS-SCHEMA-WORKER-MISMATCH-001
actors: [harness, system under test]
initial_state: Fixture DS-SCHEMA-WORKER-MISMATCH-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Old workers reject incompatible schema
oracle: mismatch_accept satisfies threshold
metric: mismatch_accept
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07,ENV-11
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: mismatch_accept_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-057
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-058 — Rollback compatibility expand-contract

```yaml
test_id: T15-058
title: Rollback compatibility expand-contract
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [S28]
override_ids: [OV-01]
product_goal: Expand/contract rollback succeeds
risk_addressed: Violation of rollback_ok
hypothesis: Expand/contract rollback succeeds
preconditions: migration
fixture_or_dataset: DS-ROLLBACK-001
actors: [harness, system under test]
initial_state: Fixture DS-ROLLBACK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Expand/contract rollback succeeds
oracle: rollback_ok satisfies threshold
metric: rollback_ok
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-11
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rollback_ok_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-058
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-059 — Deleted lexical entry exclusion

```yaml
test_id: T15-059
title: Deleted lexical entry exclusion
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [A47]
override_ids: [OV-07]
product_goal: Deleted absent from FTS
risk_addressed: Violation of deleted_lexical_hit
hypothesis: Deleted absent from FTS
preconditions: lexical
fixture_or_dataset: DS-LEXICAL-DELETE-001
actors: [harness, system under test]
initial_state: Fixture DS-LEXICAL-DELETE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Deleted absent from FTS
oracle: deleted_lexical_hit satisfies threshold
metric: deleted_lexical_hit
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: no — FTS later
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: deleted_lexical_hit_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-059
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-061 — External mapping loss purge safety

```yaml
test_id: T15-061
title: External mapping loss purge safety
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: adapter_enablement
finding_ids: [A05, A06]
override_ids: [OV-11]
product_goal: Missing mapping never serves vendor text
risk_addressed: Violation of unmap_serve
hypothesis: Missing mapping never serves vendor text
preconditions: adapter
fixture_or_dataset: DS-MAP-LOSS-001
actors: [harness, system under test]
initial_state: Fixture DS-MAP-LOSS-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Missing mapping never serves vendor text
oracle: unmap_serve satisfies threshold
metric: unmap_serve
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-05,ENV-08
current_code_applicable: n/a until adapters
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: unmap_serve_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so adapter_enablement prerequisites exist before relying on T15-061
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-065 — Query disclosure classification accuracy

```yaml
test_id: T15-065
title: Query disclosure classification accuracy
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [A50]
override_ids: [OV-16]
product_goal: Accurate purpose classification
risk_addressed: Misclassification leak
hypothesis: disclosure_class_f1>=floor
preconditions: labelled queries
fixture_or_dataset: DS-DISCLOSURE-CLASS-001
actors: [harness, system under test]
initial_state: Fixture DS-DISCLOSURE-CLASS-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: disclosure_class_f1>=floor
oracle: disclosure_class_f1 satisfies threshold
metric: disclosure_class_f1
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Label ≥150 queries dual-reviewed; F1 floor explore ≥0.90
calibration_dataset: DS-DISCLOSURE-CLASS-001
decision_deadline: Before disclosure service release gate
threshold_approver: privacy + Stage 15
failure_if_no_threshold: Disclosure service cannot claim readiness
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: disclosure_class_f1_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-065
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-066 — Redaction meaning preservation

```yaml
test_id: T15-066
title: Redaction meaning preservation
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [A51]
override_ids: [OV-16]
product_goal: Redaction preserves intent
risk_addressed: Meaning destroyed
hypothesis: redaction_ir_drop<=max
preconditions: pairs
fixture_or_dataset: DS-REDACTION-IR-001
actors: [harness, system under test]
initial_state: Fixture DS-REDACTION-IR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: redaction_ir_drop<=max
oracle: redaction_ir_drop satisfies threshold
metric: redaction_ir_drop
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Measure intent-retention; max ir_drop explore ≤0.10 on ≥100 pairs
calibration_dataset: DS-REDACTION-IR-001
decision_deadline: Before redaction policy freeze
threshold_approver: privacy + Stage 15
failure_if_no_threshold: Redaction policy freeze blocked
required_environment: ENV-01
current_code_applicable: partial — redaction.ts
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: redaction_ir_drop_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-066
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-067 — Evidence disclosure consistency across representations

```yaml
test_id: T15-067
title: Evidence disclosure consistency across representations
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [A50]
override_ids: [OV-16]
product_goal: Consistent disclosure
risk_addressed: Inconsistent decisions
hypothesis: disclosure_inconsistency==0
preconditions: matrix
fixture_or_dataset: DS-DISC-REP-001
actors: [harness, system under test]
initial_state: Fixture DS-DISC-REP-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: disclosure_inconsistency==0
oracle: disclosure_inconsistency satisfies threshold
metric: disclosure_inconsistency
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: disclosure_inconsistency_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-067
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-070 — Provider logging assumption conformance

```yaml
test_id: T15-070
title: Provider logging assumption conformance
status: needs_calibration
priority: P1
evaluation_type: manual_review
release_gate: before_public_beta
finding_ids: [S21]
override_ids: [OV-16]
product_goal: Provider log assumptions explicit
risk_addressed: Opaque vendor logs
hypothesis: provider_log_policy pass
preconditions: DPA checklist
fixture_or_dataset: DS-PROVIDER-LOG-001
actors: [harness, system under test]
initial_state: Fixture DS-PROVIDER-LOG-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: provider_log_policy pass
oracle: provider_log_policy satisfies threshold
metric: provider_log_policy
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Privacy review per provider logging assumptions; checklist oracle; re-review on vendor change
calibration_dataset: Provider policy pack
decision_deadline: Before public beta external inference claims
threshold_approver: privacy review owner + Stage 15
failure_if_no_threshold: External inference privacy claims blocked
required_environment: ENV-12
current_code_applicable: n/a process
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic; legal_or_privacy_review=required
observability_required: provider_log_policy_metric
failure_interpretation: accepted_risk_trigger
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-070
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-072 — Local-only fallback behaviour

```yaml
test_id: T15-072
title: Local-only fallback behaviour
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [S40]
override_ids: [OV-09]
product_goal: Local-only never exfiltrates
risk_addressed: Exfil in local-only
hypothesis: local_only_hold==true
preconditions: local_only flag
fixture_or_dataset: DS-LOCAL-ONLY-001
actors: [harness, system under test]
initial_state: Fixture DS-LOCAL-ONLY-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: local_only_hold==true
oracle: local_only_hold satisfies threshold
metric: local_only_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-04
current_code_applicable: partial — offline mock
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: local_only_hold_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-072
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-073 — Export privacy package

```yaml
test_id: T15-073
title: Export privacy package
status: specified
priority: P1
evaluation_type: privacy_test
release_gate: before_public_beta
finding_ids: [A70]
override_ids: [OV-14]
product_goal: Export has no secrets
risk_addressed: Secret in export
hypothesis: export_secret_leak==0
preconditions: export
fixture_or_dataset: DS-EXPORT-PRIV-001
actors: [harness, system under test]
initial_state: Fixture DS-EXPORT-PRIV-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: export_secret_leak==0
oracle: export_secret_leak satisfies threshold
metric: export_secret_leak
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial — export/route.ts
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: export_secret_leak_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-073
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-076 — Lexical retrieval relevance

```yaml
test_id: T15-076
title: Lexical retrieval relevance
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [OV-07]
override_ids: [OV-07]
product_goal: Lexical quality
risk_addressed: Poor lexical precision
hypothesis: P@8 >= floor
preconditions: labels
fixture_or_dataset: DS-LEX-REL-001
actors: [harness, system under test]
initial_state: Fixture DS-LEX-REL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: P@8 >= floor
oracle: precision_at_k satisfies threshold
metric: precision_at_k
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Label ≥200; P@8 floor explore ≥0.50
calibration_dataset: DS-LEX-REL-001
decision_deadline: Before public beta lexical enablement
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Lexical channel enablement blocked
required_environment: ENV-02
current_code_applicable: no — FTS not yet
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: precision_at_k_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-076
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-077 — Hybrid lift over single channel

```yaml
test_id: T15-077
title: Hybrid lift over single channel
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [OV-07, OV-08]
override_ids: [OV-07, OV-08]
product_goal: Hybrid improves quality
risk_addressed: No lift
hypothesis: hybrid_lift >= min
preconditions: ablation
fixture_or_dataset: DS-HYBRID-001
actors: [harness, system under test]
initial_state: Fixture DS-HYBRID-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: hybrid_lift >= min
oracle: hybrid_lift satisfies threshold
metric: hybrid_lift
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Require hybrid nDCG@8 − max(semantic,lexical) ≥ lift explore ≥0.03 or disable hybrid claim
calibration_dataset: DS-HYBRID-001
decision_deadline: Before public beta hybrid marketing
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Hybrid quality claims blocked
required_environment: ENV-02
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: hybrid_lift_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-077
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-080 — Temporal retrieval correctness

```yaml
test_id: T15-080
title: Temporal retrieval correctness
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_private_beta
finding_ids: [A10, OV-04]
override_ids: [OV-04]
product_goal: Temporal selection correct
risk_addressed: Wrong temporal
hypothesis: temporal_accuracy>=floor
preconditions: temporal queries
fixture_or_dataset: DS-TEMPORAL-RET-001
actors: [harness, system under test]
initial_state: Fixture DS-TEMPORAL-RET-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: temporal_accuracy>=floor
oracle: temporal_accuracy satisfies threshold
metric: temporal_accuracy
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: ≥80 temporal queries; accuracy floor explore ≥0.90
calibration_dataset: DS-TEMPORAL-RET-001
decision_deadline: Before private beta temporal label signoff
threshold_approver: Stage 15 + memory design
failure_if_no_threshold: Temporal labels cannot claim readiness
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: temporal_accuracy_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-080
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-083 — Document coverage honesty labels

```yaml
test_id: T15-083
title: Document coverage honesty labels
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [A44, OV-10]
override_ids: [OV-10]
product_goal: Honest incompleteness labels
risk_addressed: False complete doc claims
hypothesis: false_complete_doc==0
preconditions: doc labels
fixture_or_dataset: DS-DOC-COVER-001
actors: [harness, system under test]
initial_state: Fixture DS-DOC-COVER-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: false_complete_doc==0
oracle: false_complete_doc satisfies threshold
metric: false_complete_doc
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: false_complete_doc_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-083
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-085 — Candidate flooding resistance

```yaml
test_id: T15-085
title: Candidate flooding resistance
status: needs_calibration
priority: P1
evaluation_type: load_test
release_gate: before_private_beta
finding_ids: [A33]
override_ids: [OV-01]
product_goal: Queue growth controlled
risk_addressed: Candidate flood
hypothesis: review_queue_growth_rate under max
preconditions: sim
fixture_or_dataset: DS-CAND-FLOOD-001
actors: [harness, system under test]
initial_state: Fixture DS-CAND-FLOOD-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: review_queue_growth_rate under max
oracle: review_queue_growth_rate satisfies threshold
metric: review_queue_growth_rate
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Simulate propose rates; max growth explore ≤2×/day sustained without batch tools; rate limits engage
calibration_dataset: DS-CAND-FLOOD-001
decision_deadline: Before private beta extraction defaults
threshold_approver: Stage 15 + product
failure_if_no_threshold: High-recall extraction defaults blocked
required_environment: ENV-01,ENV-09
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: review_queue_growth_rate_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-085
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: processing
traceability_status: fully_traced
```

#### T15-087 — WRRF calibration suite

```yaml
test_id: T15-087
title: WRRF calibration suite
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [OV-08, COR-08]
override_ids: [OV-08]
product_goal: Calibrated fusion version
risk_addressed: Uncalibrated fusion
hypothesis: wrrf_ndcg maximized under domination
preconditions: grid search
fixture_or_dataset: DS-WRRF-CAL-001
actors: [harness, system under test]
initial_state: Fixture DS-WRRF-CAL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: wrrf_ndcg maximized under domination
oracle: wrrf_ndcg satisfies threshold
metric: wrrf_ndcg
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Grid-search λ/k under domination; pick version maximizing nDCG@8 on holdout; pin retrieval_policy_version
calibration_dataset: DS-WRRF-CAL-001
decision_deadline: Before fusion release gate
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Fusion enablement blocked
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: wrrf_ndcg_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-087
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-088 — Policy multiplier effect bounds

```yaml
test_id: T15-088
title: Policy multiplier effect bounds
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [A36, OV-08]
override_ids: [OV-08]
product_goal: Multipliers bounded
risk_addressed: Unbounded multipliers
hypothesis: multiplier_bound==true
preconditions: unit
fixture_or_dataset: DS-MULT-BOUND-001
actors: [harness, system under test]
initial_state: Fixture DS-MULT-BOUND-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: multiplier_bound==true
oracle: multiplier_bound satisfies threshold
metric: multiplier_bound
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: multiplier_bound_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-088
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-089 — Token-estimation error bound

```yaml
test_id: T15-089
title: Token-estimation error bound
status: needs_calibration
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [A39]
override_ids: [OV-13]
product_goal: Token estimate accuracy
risk_addressed: Large estimate error
hypothesis: context_pack_token_error p95 under max
preconditions: packs
fixture_or_dataset: DS-TOKEN-ERR-001
actors: [harness, system under test]
initial_state: Fixture DS-TOKEN-ERR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: context_pack_token_error p95 under max
oracle: context_pack_token_error satisfies threshold
metric: context_pack_token_error
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: |estimate−exact|/exact on ≥500 packs; p95 error max explore ≤0.08
calibration_dataset: DS-TOKEN-ERR-001
decision_deadline: Before packing release
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Packing release blocked
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: context_pack_token_error_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-089
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-090 — Exact tokenizer fallback

```yaml
test_id: T15-090
title: Exact tokenizer fallback
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [A39]
override_ids: [OV-13]
product_goal: Bounded exact-pack attempts
risk_addressed: Unbounded retries
hypothesis: max_exact_pack_attempts<=3
preconditions: packer
fixture_or_dataset: DS-EXACT-PACK-001
actors: [harness, system under test]
initial_state: Fixture DS-EXACT-PACK-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: max_exact_pack_attempts<=3
oracle: max_exact_pack_attempts satisfies threshold
metric: max_exact_pack_attempts
threshold: <= 3
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: max_exact_pack_attempts_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-090
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-091 — Extraction model drift detection

```yaml
test_id: T15-091
title: Extraction model drift detection
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: provider_change
finding_ids: [A22]
override_ids: [OV-13]
product_goal: Detect extraction drift
risk_addressed: Silent worse model
hypothesis: extraction_false_fact_rate not worse
preconditions: gold set
fixture_or_dataset: DS-EXTRACT-GOLD-001
actors: [harness, system under test]
initial_state: Fixture DS-EXTRACT-GOLD-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: extraction_false_fact_rate not worse
oracle: extraction_false_fact_rate satisfies threshold
metric: extraction_false_fact_rate
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Pin baseline; require new model CI not worse at α=0.05 or reviewed rebaseline
calibration_dataset: DS-EXTRACT-GOLD-001
decision_deadline: Before any extraction model upgrade
threshold_approver: Stage 15 + extraction
failure_if_no_threshold: Model upgrade prohibited
required_environment: ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: extraction_false_fact_rate_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so provider_change prerequisites exist before relying on T15-091
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: extraction
traceability_status: fully_traced
```

#### T15-103 — Quota and capacity enforcement

```yaml
test_id: T15-103
title: Quota and capacity enforcement
status: needs_calibration
priority: P1
evaluation_type: load_test
release_gate: before_paid_scale
finding_ids: [A33]
override_ids: [OV-01]
product_goal: Quotas enforce capacity
risk_addressed: Quota breach silent
hypothesis: quota_breach handled 100%
preconditions: soak
fixture_or_dataset: DS-QUOTA-001
actors: [harness, system under test]
initial_state: Fixture DS-QUOTA-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: quota_breach handled 100%
oracle: quota_breach satisfies threshold
metric: quota_breach
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Set per-user chunk/job quotas from soak; breach must reject with explicit error 100%
calibration_dataset: DS-QUOTA-001
decision_deadline: Before paid-scale
threshold_approver: Stage 15 + ops
failure_if_no_threshold: Paid-scale capacity claims blocked
required_environment: ENV-09
current_code_applicable: weak quotas today
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: quota_breach_metric
failure_interpretation: performance_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-103
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: ops
traceability_status: fully_traced
```

#### T15-107 — Incident recovery without vendor data

```yaml
test_id: T15-107
title: Incident recovery without vendor data
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_paid_scale
finding_ids: [A57]
override_ids: [OV-11]
product_goal: Recover from PG canonical only
risk_addressed: Risk:recover_from_canonical
hypothesis: Recover from PG canonical only
preconditions: chaos
fixture_or_dataset: DS-INCIDENT-RECOVER-001
actors: [harness, system under test]
initial_state: Fixture DS-INCIDENT-RECOVER-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Recover from PG canonical only
oracle: recover_from_canonical satisfies threshold
metric: recover_from_canonical
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-08
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: recover_from_canonical_metric
failure_interpretation: resilience_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-107
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: ops
traceability_status: fully_traced
```

#### T15-108 — Confirmation fatigue study

```yaml
test_id: T15-108
title: Confirmation fatigue study
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A71]
override_ids: [OV-03]
product_goal: Manage confirm fatigue
risk_addressed: Fatigue harm
hypothesis: confirm_fatigue_score under max
preconditions: UP-FATIGUE-001
fixture_or_dataset: DS-UX-FATIGUE-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-FATIGUE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: confirm_fatigue_score under max
oracle: confirm_fatigue_score satisfies threshold
metric: confirm_fatigue_score
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12; max fatigue Likert mean explore ≤3/5; max skip rate pinned
calibration_dataset: DS-UX-FATIGUE-001
decision_deadline: Before private beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Confirm UX readiness blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: confirm_fatigue_score_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-108
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-109 — Correction discoverability

```yaml
test_id: T15-109
title: Correction discoverability
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A71]
override_ids: [OV-01]
product_goal: Users find correction
risk_addressed: Undiscoverable correction
hypothesis: correction_find_rate>=floor
preconditions: UP-CORRECT-001
fixture_or_dataset: DS-UX-CORRECT-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-CORRECT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: correction_find_rate>=floor
oracle: correction_find_rate satisfies threshold
metric: correction_find_rate
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12; find rate explore ≥0.80 within 60s
calibration_dataset: DS-UX-CORRECT-001
decision_deadline: Before private beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Correction UX blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: correction_find_rate_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-109
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-111 — Current vs historical label comprehension

```yaml
test_id: T15-111
title: Current vs historical label comprehension
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [OV-04]
override_ids: [OV-04]
product_goal: Users understand temporal labels
risk_addressed: Misread labels
hypothesis: label_comprehension>=0.80
preconditions: UP-TEMPORAL-001
fixture_or_dataset: DS-UX-TEMPORAL-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-TEMPORAL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: label_comprehension>=0.80
oracle: label_comprehension satisfies threshold
metric: label_comprehension
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12; comprehension ≥0.80
calibration_dataset: DS-UX-TEMPORAL-001
decision_deadline: Before private beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Temporal UX blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: label_comprehension_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-111
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-112 — Conflict explanation comprehension

```yaml
test_id: T15-112
title: Conflict explanation comprehension
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A12]
override_ids: [OV-16]
product_goal: Users understand conflicts
risk_addressed: Confusion
hypothesis: conflict_comprehension>=0.80
preconditions: UP-CONFLICT-001
fixture_or_dataset: DS-UX-CONFLICT-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-CONFLICT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: conflict_comprehension>=0.80
oracle: conflict_comprehension satisfies threshold
metric: conflict_comprehension
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12; comprehension ≥0.80
calibration_dataset: DS-UX-CONFLICT-001
decision_deadline: Before private beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Conflict UX blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: conflict_comprehension_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-112
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-113 — Privacy-mode comprehension

```yaml
test_id: T15-113
title: Privacy-mode comprehension
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_public_beta
finding_ids: [A52]
override_ids: [OV-16]
product_goal: Users understand privacy mode
risk_addressed: Misunderstood privacy
hypothesis: privacy_mode_comprehension>=0.80
preconditions: UP-PRIVACY-001
fixture_or_dataset: DS-UX-PRIVACY-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-PRIVACY-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: privacy_mode_comprehension>=0.80
oracle: privacy_mode_comprehension satisfies threshold
metric: privacy_mode_comprehension
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12; comprehension ≥0.80
calibration_dataset: DS-UX-PRIVACY-001
decision_deadline: Before public beta
threshold_approver: product + privacy + Stage 15
failure_if_no_threshold: Privacy mode UX blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: privacy_mode_comprehension_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-113
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-115 — User confidence after memory error

```yaml
test_id: T15-115
title: User confidence after memory error
status: needs_calibration
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A71, S34]
override_ids: [OV-01]
product_goal: Trust recovers after error+undo
risk_addressed: Trust collapse
hypothesis: post_error_trust recovery>=floor
preconditions: UP-ERROR-TRUST-001
fixture_or_dataset: DS-UX-ERROR-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-ERROR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: post_error_trust recovery>=floor
oracle: post_error_trust satisfies threshold
metric: post_error_trust
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥12 after induced error+undo; recover explore ≥0.70
calibration_dataset: DS-UX-ERROR-001
decision_deadline: Before private beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Error recovery UX blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: post_error_trust_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-115
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-116 — Canonical memory independence across models

```yaml
test_id: T15-116
title: Canonical memory independence across models
status: specified
priority: P1
evaluation_type: simulation
release_gate: before_public_beta
finding_ids: [S35]
override_ids: [OV-13]
product_goal: Canonical rows identical across models
risk_addressed: Risk:canonical_divergence
hypothesis: Canonical rows identical across models
preconditions: two models
fixture_or_dataset: DS-CANON-IND-001
actors: [harness, system under test]
initial_state: Fixture DS-CANON-IND-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Canonical rows identical across models
oracle: canonical_divergence satisfies threshold
metric: canonical_divergence
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: canonical_divergence_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-116
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: independence
traceability_status: fully_traced
```

#### T15-117 — Packing-policy independence

```yaml
test_id: T15-117
title: Packing-policy independence
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [OV-13]
override_ids: [OV-13]
product_goal: Frozen candidates+policy ⇒ same pack
risk_addressed: Risk:pack_policy_hold
hypothesis: Frozen candidates+policy ⇒ same pack
preconditions: packer
fixture_or_dataset: DS-PACK-IND-001
actors: [harness, system under test]
initial_state: Fixture DS-PACK-IND-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Frozen candidates+policy ⇒ same pack
oracle: pack_policy_hold satisfies threshold
metric: pack_policy_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: pack_policy_hold_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-117
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: independence
traceability_status: fully_traced
```

#### T15-119 — Extraction interpretation variance bound

```yaml
test_id: T15-119
title: Extraction interpretation variance bound
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: provider_change
finding_ids: [A22]
override_ids: [OV-13]
product_goal: Bound extraction variance
risk_addressed: Unbounded variance
hypothesis: extract_variance under max
preconditions: gold
fixture_or_dataset: DS-EXTRACT-VAR-001
actors: [harness, system under test]
initial_state: Fixture DS-EXTRACT-VAR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: extract_variance under max
oracle: extract_variance satisfies threshold
metric: extract_variance
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Bound pairwise disagreement; max explore ≤0.15 or pin model
calibration_dataset: DS-EXTRACT-VAR-001
decision_deadline: Before extraction provider change
threshold_approver: Stage 15 + extraction
failure_if_no_threshold: Provider change blocked
required_environment: ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: extract_variance_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so provider_change prerequisites exist before relying on T15-119
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: extraction
traceability_status: fully_traced
```

#### T15-120 — Provider context-window compatibility

```yaml
test_id: T15-120
title: Provider context-window compatibility
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [OV-09]
override_ids: [OV-09]
product_goal: Respect window or terminal plan
risk_addressed: Risk:ctx_compat_hold
hypothesis: Respect window or terminal plan
preconditions: plans
fixture_or_dataset: DS-CTX-COMPAT-001
actors: [harness, system under test]
initial_state: Fixture DS-CTX-COMPAT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Respect window or terminal plan
oracle: ctx_compat_hold satisfies threshold
metric: ctx_compat_hold
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: ctx_compat_hold_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-120
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-125 — Deletion during export

```yaml
test_id: T15-125
title: Deletion during export
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [S04]
override_ids: [OV-14]
product_goal: In-flight delete excluded or export blocked
risk_addressed: Risk:export_deleted_fact
hypothesis: In-flight delete excluded or export blocked
preconditions: export
fixture_or_dataset: DS-DEL-EXPORT-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-EXPORT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: In-flight delete excluded or export blocked
oracle: export_deleted_fact satisfies threshold
metric: export_deleted_fact
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02,ENV-11
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: export_deleted_fact_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-125
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-126 — Deletion during migration

```yaml
test_id: T15-126
title: Deletion during migration
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [S04]
override_ids: [OV-14]
product_goal: Migration cannot resurrect deleted
risk_addressed: Risk:migrate_resurrect
hypothesis: Migration cannot resurrect deleted
preconditions: migration
fixture_or_dataset: DS-DEL-MIG-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-MIG-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Migration cannot resurrect deleted
oracle: migrate_resurrect satisfies threshold
metric: migrate_resurrect
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-11
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: migrate_resurrect_metric
failure_interpretation: migration_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-126
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-127 — Deletion during provider outage

```yaml
test_id: T15-127
title: Deletion during provider outage
status: specified
priority: P1
evaluation_type: chaos_test
release_gate: before_public_beta
finding_ids: [S40]
override_ids: [OV-14]
product_goal: Native delete completes; adapter purge visible fail/queue
risk_addressed: Risk:delete_completes_native
hypothesis: Native delete completes; adapter purge visible fail/queue
preconditions: outage
fixture_or_dataset: DS-DEL-OUTAGE-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-OUTAGE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Native delete completes; adapter purge visible fail/queue
oracle: delete_completes_native satisfies threshold
metric: delete_completes_native
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-08
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: delete_completes_native_metric
failure_interpretation: resilience_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-127
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-130 — Delete one conversation proof

```yaml
test_id: T15-130
title: Delete one conversation proof
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_private_beta
finding_ids: [OV-14]
override_ids: [OV-14]
product_goal: Deleted conversation excluded per policy
risk_addressed: Risk:conv_residual
hypothesis: Deleted conversation excluded per policy
preconditions: conv delete
fixture_or_dataset: DS-DEL-CONV-001
actors: [harness, system under test]
initial_state: Fixture DS-DEL-CONV-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Deleted conversation excluded per policy
oracle: conv_residual satisfies threshold
metric: conv_residual
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: conv_residual_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-130
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: deletion
traceability_status: fully_traced
```

#### T15-131 — Export incompatible semantics honesty

```yaml
test_id: T15-131
title: Export incompatible semantics honesty
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [S39]
override_ids: [OV-15]
product_goal: Incompatible import cannot silently map trust
risk_addressed: Risk:false_semantic_import
hypothesis: Incompatible import cannot silently map trust
preconditions: hostile
fixture_or_dataset: DS-EXPORT-INCOMPAT-001
actors: [harness, system under test]
initial_state: Fixture DS-EXPORT-INCOMPAT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Incompatible import cannot silently map trust
oracle: false_semantic_import satisfies threshold
metric: false_semantic_import
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: false_semantic_import_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-131
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: portability
traceability_status: fully_traced
```

#### T15-133 — Reindex reliability

```yaml
test_id: T15-133
title: Reindex reliability
status: needs_calibration
priority: P1
evaluation_type: chaos_test
release_gate: before_paid_scale
finding_ids: [A45, S17]
override_ids: [OV-01]
product_goal: Reliable reindex
risk_addressed: Broken reindex
hypothesis: reindex_success>=floor
preconditions: interrupt mid-reindex
fixture_or_dataset: DS-REINDEX-001
actors: [harness, system under test]
initial_state: Fixture DS-REINDEX-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: reindex_success>=floor
oracle: reindex_success satisfies threshold
metric: reindex_success
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Interrupt mid-reindex; success/resume floor explore ≥0.99; zero cross-space serve during rebuild
calibration_dataset: DS-REINDEX-001
decision_deadline: Before paid-scale embed upgrades
threshold_approver: Stage 15 + embeddings
failure_if_no_threshold: Reindex/upgrade blocked
required_environment: ENV-07,ENV-08
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: reindex_success_metric
failure_interpretation: resilience_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-133
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: embeddings
traceability_status: fully_traced
```

#### T15-135 — Rollback drill public beta

```yaml
test_id: T15-135
title: Rollback drill public beta
status: specified
priority: P1
evaluation_type: migration_test
release_gate: before_public_beta
finding_ids: [S28]
override_ids: [OV-01]
product_goal: Rollback drill succeeds
risk_addressed: Risk:rollback_drill_ok
hypothesis: Rollback drill succeeds
preconditions: drill
fixture_or_dataset: DS-ROLLBACK-DRILL-001
actors: [harness, system under test]
initial_state: Fixture DS-ROLLBACK-DRILL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Rollback drill succeeds
oracle: rollback_drill_ok satisfies threshold
metric: rollback_drill_ok
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-11
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rollback_drill_ok_metric
failure_interpretation: migration_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-135
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: ops
traceability_status: fully_traced
```

#### T15-136 — Paraphrase dedupe precision

```yaml
test_id: T15-136
title: Paraphrase dedupe precision
status: needs_calibration
priority: P1
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [A18]
override_ids: [OV-01]
product_goal: Paraphrase merge precision
risk_addressed: Missed paraphrases or overmerge
hypothesis: dedupe_precision>=floor
preconditions: paraphrase slice
fixture_or_dataset: DS-PARAPHRASE-001
actors: [harness, system under test]
initial_state: Fixture DS-PARAPHRASE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: dedupe_precision>=floor
oracle: dedupe_precision satisfies threshold
metric: dedupe_precision
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Precision-first like T15-017; floor explore ≥0.90
calibration_dataset: DS-PARAPHRASE-001
decision_deadline: Before dedupe algorithm selection
threshold_approver: Stage 15 + memory design
failure_if_no_threshold: Algorithm selection prohibited
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: dedupe_precision_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-136
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: processing
traceability_status: fully_traced
```

#### T15-140 — Provider-incompatible evidence terminal plan

```yaml
test_id: T15-140
title: Provider-incompatible evidence terminal plan
status: specified
priority: P1
evaluation_type: unit_contract
release_gate: before_public_beta
finding_ids: [S07, OV-16]
override_ids: [OV-16, OV-09]
product_goal: Incompatible evidence ⇒ terminal plan
risk_addressed: Risk:silent_drop
hypothesis: Incompatible evidence ⇒ terminal plan
preconditions: packing
fixture_or_dataset: DS-PROV-INCOMPAT-001
actors: [harness, system under test]
initial_state: Fixture DS-PROV-INCOMPAT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Incompatible evidence ⇒ terminal plan
oracle: silent_drop satisfies threshold
metric: silent_drop
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: silent_drop_metric
failure_interpretation: safety_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-140
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-143 — Worker schema mismatch reject

```yaml
test_id: T15-143
title: Worker schema mismatch reject
status: specified
priority: P1
evaluation_type: integration_contract
release_gate: before_public_beta
finding_ids: [S28]
override_ids: [OV-01]
product_goal: Old workers reject new schema
risk_addressed: Risk:old_worker_accept
hypothesis: Old workers reject new schema
preconditions: version
fixture_or_dataset: DS-WORKER-SCHEMA-001
actors: [harness, system under test]
initial_state: Fixture DS-WORKER-SCHEMA-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Old workers reject new schema
oracle: old_worker_accept satisfies threshold
metric: old_worker_accept
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-07
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: old_worker_accept_metric
failure_interpretation: migration_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-143
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: ops
traceability_status: fully_traced
```

#### T15-145 — Score-not-trust presentation

```yaml
test_id: T15-145
title: Score-not-trust presentation
status: specified
priority: P1
evaluation_type: usability_test
release_gate: before_private_beta
finding_ids: [A02, A14]
override_ids: [OV-03]
product_goal: Scores not presented as trust
risk_addressed: Risk:score_as_trust
hypothesis: Scores not presented as trust
preconditions: UI
fixture_or_dataset: DS-SCORE-TRUST-001
actors: [harness, system under test]
initial_state: Fixture DS-SCORE-TRUST-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Scores not presented as trust
oracle: score_as_trust satisfies threshold
metric: score_as_trust
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-10
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: yes
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: semi_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: score_as_trust_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_private_beta prerequisites exist before relying on T15-145
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

### 17.3 Priority P2

#### T15-016 — Long-vault chunk flood latency and quotas

```yaml
test_id: T15-016
title: Long-vault chunk flood latency and quotas
status: needs_calibration
priority: P2
evaluation_type: load_test
release_gate: before_paid_scale
finding_ids: [A33, A49, S30]
override_ids: [OV-01]
product_goal: Scale without collapse
risk_addressed: 1e6 chunks collapse p95
hypothesis: p95 under calibrated budget; quotas engage
preconditions: Soak 1e4/1e5/1e6
fixture_or_dataset: DS-CHUNK-FLOOD-001
actors: [retrieve, quota]
initial_state: N chunks
event_sequence: [soak, measure, verify quota]
expected_behaviour: Latency within budget; quotas before collapse
oracle: retrieval_latency_p95 <= budget AND quota_enforced
metric: retrieval_latency_p95
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Measure p95 retrieve on chosen topology at 1e4/1e5/1e6 chunks; set budget with 20% headroom under platform timeout
calibration_dataset: DS-CHUNK-FLOOD-001 + soak harness
decision_deadline: Before T15-016 becomes paid-scale gate
threshold_approver: Stage 15 author + architecture reviewer on PR that pins the number
failure_if_no_threshold: Test remains non-gating; paid-scale latency claims blocked
required_environment: ENV-09
current_code_applicable: partial — can soak match_memories
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: medium
false_negative_risk: medium
data_privacy_requirements: synthetic chunks
observability_required: retrieval_latency_p95
failure_interpretation: performance_regression
architecture_consequence: Quotas at paid scale
Stage_16_consequence: Caps before heavy vault marketing
Stage_17_consequence: No paid-scale claims without pinned budget
owner: perf
traceability_status: fully_traced
```

#### T15-017 — Deduplication precision-first bands

```yaml
test_id: T15-017
title: Deduplication precision-first bands
status: needs_calibration
priority: P2
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: [A18, A19]
override_ids: [OV-01]
product_goal: Merge paraphrases; reject near-miss
risk_addressed: Over/under merge harm
hypothesis: Precision floor then max F1
preconditions: Labelled ≥200 pairs
fixture_or_dataset: DS-DEDUPE-001
actors: [dedupe]
initial_state: Gold merge/no-merge
event_sequence: [run, precision/recall/F1, select under floor]
expected_behaviour: Meet precision floor; maximize F1 under floor
oracle: dedupe_precision >= floor
metric: dedupe_precision
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Precision-first: choose precision floor first (explore ≥0.90) then max F1 under floor
calibration_dataset: DS-DEDUPE-001 labelled pairs ≥200 dual-reviewed
decision_deadline: Before selecting dedupe algorithm
threshold_approver: Stage 15 author + memory design reviewer
failure_if_no_threshold: Algorithm selection prohibited
required_environment: ENV-01
current_code_applicable: no — target dedupe absent
can_run_before_implementation: yes
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: medium
false_negative_risk: medium
data_privacy_requirements: synthetic/licensed public only
observability_required: dedupe_precision
failure_interpretation: correctness_regression
architecture_consequence: Precision-first merge
Stage_16_consequence: Select algorithm after calibration
Stage_17_consequence: No aggressive auto-merge
owner: processing
traceability_status: fully_traced
```

#### T15-018 — Entity homonym auto-merge ban

```yaml
test_id: T15-018
title: Entity homonym auto-merge ban
status: deferred
priority: P2
evaluation_type: unit_contract
release_gate: non_gating_research
finding_ids: [S12, A25, A04, COR-09]
override_ids: [OV-05]
product_goal: No auto-merge of two people same name
risk_addressed: Homonym auto-merge
hypothesis: false_merge=0 when graph pursued
preconditions: Graph flag deferred
fixture_or_dataset: DS-HOMONYM-001
actors: [entity resolver]
initial_state: Two Alex persons
event_sequence: [propose name merge, assert reject]
expected_behaviour: No auto-merge
oracle: false_merge == 0
metric: false_merge
threshold: deferred_until_feature_enablement
threshold_status: deferred
calibration_method: Calibrate only if/when feature is enabled per OV-05/OV-11/adapter gates
calibration_dataset: Deferred feature corpus; not built for initial release
decision_deadline: Before enablement PR; never as private-beta gate unless OV amended
threshold_approver: Architecture owner + Stage 15 maintainer at enablement
failure_if_no_threshold: Feature enablement prohibited
required_environment: ENV-01
current_code_applicable: n/a — graph deferred
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: no
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: low
data_privacy_requirements: synthetic names
observability_required: false_merge_blocked_total
failure_interpretation: architecture_conformance_failure if enabled without test
architecture_consequence: OV-05 graph deferred
Stage_16_consequence: No Graphiti/Neo4j
Stage_17_consequence: No entity schema in first PR
owner: entities
traceability_status: fully_traced
```

#### T15-060 — Stale cache exclusion

```yaml
test_id: T15-060
title: Stale cache exclusion
status: specified
priority: P2
evaluation_type: integration_contract
release_gate: before_paid_scale
finding_ids: [A48]
override_ids: [OV-01]
product_goal: Stale cache never serves deleted/corrected
risk_addressed: Violation of stale_cache_hit
hypothesis: Stale cache never serves deleted/corrected
preconditions: cache
fixture_or_dataset: DS-STALE-CACHE-001
actors: [harness, system under test]
initial_state: Fixture DS-STALE-CACHE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Stale cache never serves deleted/corrected
oracle: stale_cache_hit satisfies threshold
metric: stale_cache_hit
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-02
current_code_applicable: unresolved A48 cache policy
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: stale_cache_hit_metric
failure_interpretation: correctness_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-060
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: correctness
traceability_status: fully_traced
```

#### T15-069 — External reranker disclosure gate

```yaml
test_id: T15-069
title: External reranker disclosure gate
status: deferred
priority: P2
evaluation_type: security_test
release_gate: adapter_enablement
finding_ids: [A40]
override_ids: [OV-11]
product_goal: Reranker disclosure
risk_addressed: Forbidden send to reranker
hypothesis: rerank_forbidden_send==0 when enabled
preconditions: rerank PoC
fixture_or_dataset: DS-RERANK-DISC-001
actors: [harness, system under test]
initial_state: Fixture DS-RERANK-DISC-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: rerank_forbidden_send==0 when enabled
oracle: rerank_forbidden_send satisfies threshold
metric: rerank_forbidden_send
threshold: deferred_until_feature_enablement
threshold_status: deferred
calibration_method: Calibrate only if/when feature is enabled per OV-05/OV-11/adapter gates
calibration_dataset: Deferred feature corpus; not built for initial release
decision_deadline: Before enablement PR; never as private-beta gate unless OV amended
threshold_approver: Architecture owner + Stage 15 maintainer at enablement
failure_if_no_threshold: Feature enablement prohibited
required_environment: ENV-06
current_code_applicable: n/a deferred
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rerank_forbidden_send_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so adapter_enablement prerequisites exist before relying on T15-069
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-082 — Optional evidence stability

```yaml
test_id: T15-082
title: Optional evidence stability
status: needs_calibration
priority: P2
evaluation_type: offline_dataset_eval
release_gate: before_paid_scale
finding_ids: [A42]
override_ids: [OV-01]
product_goal: Optional evidence stability
risk_addressed: Answer churn
hypothesis: answer_stability>=min
preconditions: ablation
fixture_or_dataset: DS-OPT-STABLE-001
actors: [harness, system under test]
initial_state: Fixture DS-OPT-STABLE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: answer_stability>=min
oracle: answer_stability satisfies threshold
metric: answer_stability
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Optional evidence ablation agreement explore ≥0.80; diagnostic then gate
calibration_dataset: DS-OPT-STABLE-001
decision_deadline: Before paid-scale optional-channel claims
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Optional channel claims blocked
required_environment: ENV-04
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: answer_stability_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-082
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-084 — Whole-document claims deferred honesty

```yaml
test_id: T15-084
title: Whole-document claims deferred honesty
status: specified
priority: P2
evaluation_type: policy_conformance
release_gate: before_paid_scale
finding_ids: [OV-10]
override_ids: [OV-10]
product_goal: No false whole-doc claims while deferred
risk_addressed: False whole-doc mode
hypothesis: whole_doc_false_claim==0
preconditions: policy audit
fixture_or_dataset: DS-WHOLE-DOC-001
actors: [harness, system under test]
initial_state: Fixture DS-WHOLE-DOC-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: whole_doc_false_claim==0
oracle: whole_doc_false_claim satisfies threshold
metric: whole_doc_false_claim
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-01
current_code_applicable: n/a deferred modes
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: whole_doc_false_claim_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-084
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-086 — Ranking bias audit

```yaml
test_id: T15-086
title: Ranking bias audit
status: needs_calibration
priority: P2
evaluation_type: offline_dataset_eval
release_gate: before_paid_scale
finding_ids: [A36, A02]
override_ids: [OV-08]
product_goal: Bounded ranking bias
risk_addressed: Hidden bias
hypothesis: rank_bias_delta under max
preconditions: slices
fixture_or_dataset: DS-RANK-BIAS-001
actors: [harness, system under test]
initial_state: Fixture DS-RANK-BIAS-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: rank_bias_delta under max
oracle: rank_bias_delta satisfies threshold
metric: rank_bias_delta
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Slice nDCG |delta| max explore ≤0.05 or document accepted_risk
calibration_dataset: DS-RANK-BIAS-001
decision_deadline: Before paid-scale ranking claims
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Ranking fairness claims blocked
required_environment: ENV-01
current_code_applicable: no
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rank_bias_delta_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-086
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-102 — Influence explainability redaction paid-scale

```yaml
test_id: T15-102
title: Influence explainability redaction paid-scale
status: specified
priority: P2
evaluation_type: privacy_test
release_gate: before_paid_scale
finding_ids: [OV-06, COR-11]
override_ids: [OV-06]
product_goal: Influence redacted
risk_addressed: Risk:influence_raw_leak
hypothesis: Influence redacted
preconditions: influence
fixture_or_dataset: DS-INFLUENCE-001
actors: [harness, system under test]
initial_state: Fixture DS-INFLUENCE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Influence redacted
oracle: influence_raw_leak satisfies threshold
metric: influence_raw_leak
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-12
current_code_applicable: no — deferred
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: influence_raw_leak_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-102
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-104 — Cost model measurement

```yaml
test_id: T15-104
title: Cost model measurement
status: needs_calibration
priority: P2
evaluation_type: cost_model
release_gate: before_paid_scale
finding_ids: []
override_ids: [OV-01]
product_goal: Measured cost model not list-price TCO
risk_addressed: Underestimated cost
hypothesis: usd_per_active_user model published
preconditions: cost harness
fixture_or_dataset: DS-COST-MODEL-001
actors: [harness, system under test]
initial_state: Fixture DS-COST-MODEL-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: usd_per_active_user model published
oracle: usd_per_active_user satisfies threshold
metric: usd_per_active_user
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Measure token/embed/worker/storage at 1k/10k/100k assumptions; publish sensitivity; not vendor list price as TCO
calibration_dataset: DS-COST-MODEL-001
decision_deadline: Before paid-scale pricing claims
threshold_approver: Stage 15 + founder
failure_if_no_threshold: Paid-scale cost claims blocked
required_environment: ENV-09
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: usd_per_active_user_metric
failure_interpretation: cost_overrun
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-104
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: ops
traceability_status: fully_traced
```

#### T15-105 — Vendor exit drill native rebuild

```yaml
test_id: T15-105
title: Vendor exit drill native rebuild
status: specified
priority: P2
evaluation_type: chaos_test
release_gate: adapter_enablement
finding_ids: [A57, S27]
override_ids: [OV-11]
product_goal: Native rebuild without vendor
risk_addressed: Risk:native_rebuild_ok
hypothesis: Native rebuild without vendor
preconditions: exit
fixture_or_dataset: DS-VENDOR-EXIT-001
actors: [harness, system under test]
initial_state: Fixture DS-VENDOR-EXIT-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Native rebuild without vendor
oracle: native_rebuild_ok satisfies threshold
metric: native_rebuild_ok
threshold: true
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-05,ENV-07
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: native_rebuild_ok_metric
failure_interpretation: resilience_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so adapter_enablement prerequisites exist before relying on T15-105
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: adapters
traceability_status: fully_traced
```

#### T15-106 — Support tooling privacy

```yaml
test_id: T15-106
title: Support tooling privacy
status: specified
priority: P2
evaluation_type: privacy_test
release_gate: before_paid_scale
finding_ids: [A68]
override_ids: [OV-17]
product_goal: Support tools no unauthorized raw
risk_addressed: Risk:support_raw_leak
hypothesis: Support tools no unauthorized raw
preconditions: support
fixture_or_dataset: DS-SUPPORT-PRIV-001
actors: [harness, system under test]
initial_state: Fixture DS-SUPPORT-PRIV-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: Support tools no unauthorized raw
oracle: support_raw_leak satisfies threshold
metric: support_raw_leak
threshold: 0
threshold_status: concrete
calibration_method: n/a — concrete threshold pinned in Stage 15
calibration_dataset: n/a
decision_deadline: n/a — threshold already pinned
threshold_approver: n/a — Stage 15 author pins concrete value
failure_if_no_threshold: n/a — threshold already pinned
required_environment: ENV-12
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: support_raw_leak_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-106
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-114 — Perceived invasiveness and trust calibration

```yaml
test_id: T15-114
title: Perceived invasiveness and trust calibration
status: needs_calibration
priority: P2
evaluation_type: usability_test
release_gate: before_public_beta
finding_ids: [A71]
override_ids: [OV-01]
product_goal: Calibrated trust vs invasiveness
risk_addressed: Over-invasive feel
hypothesis: invasiveness_score under ceiling
preconditions: UP-INVASIVE-001
fixture_or_dataset: DS-UX-INVASIVE-001
actors: [harness, system under test]
initial_state: Fixture DS-UX-INVASIVE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: invasiveness_score under ceiling
oracle: invasiveness_score satisfies threshold
metric: invasiveness_score
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: n≥20; set invasiveness Likert ceiling and trust calibration band
calibration_dataset: DS-UX-INVASIVE-001
decision_deadline: Before public beta
threshold_approver: product + Stage 15
failure_if_no_threshold: Invasiveness claims blocked
required_environment: ENV-10
current_code_applicable: no
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: consented participants; synthetic memories
observability_required: invasiveness_score_metric
failure_interpretation: usability_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-114
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: product-ux
traceability_status: fully_traced
```

#### T15-118 — Answer-style variance allowed

```yaml
test_id: T15-118
title: Answer-style variance allowed
status: needs_calibration
priority: P2
evaluation_type: offline_dataset_eval
release_gate: non_gating_research
finding_ids: [S35]
override_ids: [OV-13]
product_goal: Document allowed style variance
risk_addressed: Overclaim tone invariance
hypothesis: style_variance within band
preconditions: style set
fixture_or_dataset: DS-STYLE-VAR-001
actors: [harness, system under test]
initial_state: Fixture DS-STYLE-VAR-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: style_variance within band
oracle: style_variance satisfies threshold
metric: style_variance
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Document allowed style variance bands; diagnostic not safety gate
calibration_dataset: DS-STYLE-VAR-001
decision_deadline: Before marketing copy on tone consistency
threshold_approver: Stage 15 + product
failure_if_no_threshold: Tone consistency marketing blocked
required_environment: ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: no
automation_level: semi_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: style_variance_metric
failure_interpretation: inconclusive
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so non_gating_research prerequisites exist before relying on T15-118
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: independence
traceability_status: fully_traced
```

#### T15-137 — Multi-language mixed Greek English retrieval

```yaml
test_id: T15-137
title: Multi-language mixed Greek English retrieval
status: needs_calibration
priority: P2
evaluation_type: offline_dataset_eval
release_gate: before_public_beta
finding_ids: []
override_ids: [OV-07]
product_goal: EL/EN retrieval quality
risk_addressed: Poor multilingual recall
hypothesis: ml_recall>=floor
preconditions: mixed corpus
fixture_or_dataset: DS-ML-EL-EN-001
actors: [harness, system under test]
initial_state: Fixture DS-ML-EL-EN-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: ml_recall>=floor
oracle: ml_recall satisfies threshold
metric: ml_recall
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: ≥100 mixed EL/EN queries; recall@8 explore ≥0.50 diagnostic then gate
calibration_dataset: DS-ML-EL-EN-001
decision_deadline: Before public beta multilingual claims
threshold_approver: Stage 15 + retrieval
failure_if_no_threshold: Multilingual claims blocked
required_environment: ENV-04
current_code_applicable: partial
can_run_before_implementation: yes
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: yes
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: ml_recall_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_public_beta prerequisites exist before relying on T15-137
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-142 — Millions-of-chunks soak

```yaml
test_id: T15-142
title: Millions-of-chunks soak
status: needs_calibration
priority: P2
evaluation_type: load_test
release_gate: before_paid_scale
finding_ids: [S30, A49]
override_ids: [OV-01]
product_goal: 1e6 chunk soak
risk_addressed: Latency collapse
hypothesis: retrieval_latency_p95 under budget
preconditions: soak
fixture_or_dataset: DS-CHUNK-FLOOD-001
actors: [harness, system under test]
initial_state: Fixture DS-CHUNK-FLOOD-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: retrieval_latency_p95 under budget
oracle: retrieval_latency_p95 satisfies threshold
metric: retrieval_latency_p95
threshold: to_be_calibrated_in_stage15
threshold_status: to_be_calibrated_in_stage15
calibration_method: Same method as T15-016 at 1e6; may share calibrated budget
calibration_dataset: DS-CHUNK-FLOOD-001
decision_deadline: Before paid-scale
threshold_approver: Stage 15 + perf
failure_if_no_threshold: Paid-scale soak claims blocked
required_environment: ENV-09
current_code_applicable: partial
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: retrieval_latency_p95_metric
failure_interpretation: performance_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so before_paid_scale prerequisites exist before relying on T15-142
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: perf
traceability_status: fully_traced
```

### 17.4 Priority P3

#### T15-074 — Connector OAuth scope deferred gate

```yaml
test_id: T15-074
title: Connector OAuth scope deferred gate
status: deferred
priority: P3
evaluation_type: policy_conformance
release_gate: adapter_enablement
finding_ids: [S25]
override_ids: [OV-11]
product_goal: Minimal OAuth scopes
risk_addressed: Over-broad OAuth
hypothesis: oauth_scope_ok when enabled
preconditions: connector PoC
fixture_or_dataset: DS-OAUTH-SCOPE-001
actors: [harness, system under test]
initial_state: Fixture DS-OAUTH-SCOPE-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: oauth_scope_ok when enabled
oracle: oauth_scope_ok satisfies threshold
metric: oauth_scope_ok
threshold: deferred_until_feature_enablement
threshold_status: deferred
calibration_method: Calibrate only if/when feature is enabled per OV-05/OV-11/adapter gates
calibration_dataset: Deferred feature corpus; not built for initial release
decision_deadline: Before enablement PR; never as private-beta gate unless OV amended
threshold_approver: Architecture owner + Stage 15 maintainer at enablement
failure_if_no_threshold: Feature enablement prohibited
required_environment: ENV-06
current_code_applicable: n/a deferred
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: manual_review
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic; legal_or_privacy_review=required
observability_required: oauth_scope_ok_metric
failure_interpretation: privacy_violation
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so adapter_enablement prerequisites exist before relying on T15-074
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: privacy
traceability_status: fully_traced
```

#### T15-094 — Reranker invariants deferred

```yaml
test_id: T15-094
title: Reranker invariants deferred
status: deferred
priority: P3
evaluation_type: unit_contract
release_gate: adapter_enablement
finding_ids: [A40]
override_ids: [OV-11]
product_goal: Reranker invariants
risk_addressed: Rerank breaks order invariants
hypothesis: rerank_invariant when enabled
preconditions: rerank
fixture_or_dataset: DS-RERANK-INV-001
actors: [harness, system under test]
initial_state: Fixture DS-RERANK-INV-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: rerank_invariant when enabled
oracle: rerank_invariant satisfies threshold
metric: rerank_invariant
threshold: deferred_until_feature_enablement
threshold_status: deferred
calibration_method: Calibrate only if/when feature is enabled per OV-05/OV-11/adapter gates
calibration_dataset: Deferred feature corpus; not built for initial release
decision_deadline: Before enablement PR; never as private-beta gate unless OV amended
threshold_approver: Architecture owner + Stage 15 maintainer at enablement
failure_if_no_threshold: Feature enablement prohibited
required_environment: ENV-01
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: yes
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: yes
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rerank_invariant_metric
failure_interpretation: architecture_conformance_failure
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so adapter_enablement prerequisites exist before relying on T15-094
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: retrieval
traceability_status: fully_traced
```

#### T15-095 — Entity retrieval deferred

```yaml
test_id: T15-095
title: Entity retrieval deferred
status: deferred
priority: P3
evaluation_type: offline_dataset_eval
release_gate: non_gating_research
finding_ids: [OV-05]
override_ids: [OV-05]
product_goal: Entity retrieval quality
risk_addressed: N/A until graph
hypothesis: entity_recall when enabled
preconditions: entity set
fixture_or_dataset: DS-ENTITY-RET-001
actors: [harness, system under test]
initial_state: Fixture DS-ENTITY-RET-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: entity_recall when enabled
oracle: entity_recall satisfies threshold
metric: entity_recall
threshold: deferred_until_feature_enablement
threshold_status: deferred
calibration_method: Calibrate only if/when feature is enabled per OV-05/OV-11/adapter gates
calibration_dataset: Deferred feature corpus; not built for initial release
decision_deadline: Before enablement PR; never as private-beta gate unless OV amended
threshold_approver: Architecture owner + Stage 15 maintainer at enablement
failure_if_no_threshold: Feature enablement prohibited
required_environment: ENV-01
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: no
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: entity_recall_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so non_gating_research prerequisites exist before relying on T15-095
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: entities
traceability_status: fully_traced
```

#### T15-096 — Relationship retrieval deferred

```yaml
test_id: T15-096
title: Relationship retrieval deferred
status: deferred
priority: P3
evaluation_type: offline_dataset_eval
release_gate: non_gating_research
finding_ids: [OV-05]
override_ids: [OV-05]
product_goal: Relationship retrieval quality
risk_addressed: N/A until graph
hypothesis: rel_recall when enabled
preconditions: rel set
fixture_or_dataset: DS-REL-RET-001
actors: [harness, system under test]
initial_state: Fixture DS-REL-RET-001 prepared
event_sequence: [arrange preconditions, act scenario, measure metric, compare to threshold]
expected_behaviour: rel_recall when enabled
oracle: rel_recall satisfies threshold
metric: rel_recall
threshold: deferred_until_feature_enablement
threshold_status: deferred
calibration_method: Calibrate only if/when feature is enabled per OV-05/OV-11/adapter gates
calibration_dataset: Deferred feature corpus; not built for initial release
decision_deadline: Before enablement PR; never as private-beta gate unless OV amended
threshold_approver: Architecture owner + Stage 15 maintainer at enablement
failure_if_no_threshold: Feature enablement prohibited
required_environment: ENV-01
current_code_applicable: n/a
can_run_before_implementation: no
must_run_during_poc: no
must_run_before_private_beta: no
must_run_before_public_beta: no
must_run_before_paid_scale: no
automation_level: fully_automated
false_positive_risk: low
false_negative_risk: medium
data_privacy_requirements: synthetic
observability_required: rel_recall_metric
failure_interpretation: quality_regression
architecture_consequence: Preserve Stage 14 OV-amended narrow MVA and safety spine
Stage_16_consequence: Sequence work so non_gating_research prerequisites exist before relying on T15-096
Stage_17_consequence: First PR stays dark/flagged; must not violate this oracle if surface overlaps
owner: entities
traceability_status: fully_traced
```

---

## 18. Stage 16 handoff

1. **P0 tests that pull components earlier:** T15-001/100/122 (Mem0 disable); T15-002/037 (secret/heuristic); T15-003/051/024 (conflict+terminal plan); T15-006/063/098 (RLS/Gateway); T15-009/039 (correction); T15-025 (force-merge retirement); T15-028/029 (scope/OV); T15-075/121 (semantic floor); T15-007/138 (doc injection); T15-034/110 (undo).
2. **May move later:** entity graph, multi-provider, full influence, connectors, rerank, WRRF extra channels, auto consolidation, T15-018/094/095/096.
3. **Infrastructure prerequisites:** local Supabase (ENV-02); mock providers (ENV-04/05); worker host only for public beta; chaos/load envs as gated.
4. **Sequencing constraints:** MVA safety spine → private beta gates → workers/DeletionCoordinator/disclosure/lexical → paid-scale registry/quotas → adapter enablement only after native metrics.
5. **Migration rehearsal:** T15-013/057/058/135 before dual-write expansion.
6. **Observability:** T15-134/004 — no raw memory text; hash/id audits.
7. **Release gates:** §10 matrices.
8. **Adapter enablement conditions:** T15-001/015/026/061/122 green; DeletionCoordinator present; disclosure present; native floor held.
9. **Still prohibited:** vendor as canonical; remote-text authority; Graphiti required; enabling adapters in initial release; E2E determinism claims; implementation before Stage 17.
10. **Tests before production behaviour changes:** all unwaivable private-beta P0s applicable to the change surface.
11. **Alongside dark code:** schema/unit sims for T15-042–051, packing sims, policy tests.
12. **PoC environments:** adapter/Mem0 mocks only after native metrics; no private-beta PoC required for adapters.
13. **Maximum unresolved P0 before Stage 16 planning:** **0** unwaivable P0 without either concrete threshold or complete calibration task — currently satisfied; calibration must complete before the corresponding release gate is claimed.

Stage 16 may convert this section directly into an ordered implementation roadmap.

---

## 19. Stage 17 handoff

- **Must accompany first implementation PR:** unit/integration tests for the exact surface touched (minimum style of T15-001 and/or T15-002 and/or T15-006 if those paths change).
- **Must exist before first PR:** this Stage 15 catalog approved; OV binding T15-028/029 accepted.
- **May remain specification-only initially:** calibrated offline evals, UX studies, worker chaos, adapter gates.
- **Architecture invariant first PR must prove:** narrow, reversible step toward CE-* / OV-amended MVA **without** enabling adapters or claiming Stage 8–12 completeness.
- **Required rollback tests:** feature flag off; expand/contract down if migration.
- **Required migration tests:** additive only; no drop of `memories` in first PR.
- **Required observability tests:** no raw memory text in new logs (T15-134 style).
- **Maximum first-PR test surface:** single architectural concern (e.g. disable remote-text **or** additive dark assertion table — not both + workers).
- **External provider calls:** avoided; mocks preferred; sandbox only if Stage 17 explicitly allows.
- **Dependencies:** forbidden unless Stage 17 explicitly lists.
- **Dark/disabled behaviour:** preferred.
- **P0 failures that prohibit first PR:** any safety/privacy P0 on the touched surface; enabling Mem0 remote-text; inventing heuristic enabled as default chat behaviour; RLS regression.

Do not specify the final Stage 17 PR in this document.

---

## 20. Acceptance questions

**1. Can the narrowed MVA be falsified before implementation?** Yes — policy sims + current-defect tests (T15-001/002/006/025/028/029) and packing/conflict sims.

**2. Which current defects can be demonstrated immediately?** Mem0 remote-text L123–125; heuristic fallback L147–149; profile force-merge chat.ts L98–111; account Auth-not-last L37–49; RLS IDOR suite.

**3. Which tests require the future assertion schema?** Lifecycle/conflict/temporal/succession suites (e.g. T15-042–051, T15-003 integration beyond sim).

**4. Which tests require workers?** Those listing ENV-07 — e.g. T15-005/014/027/033/040/041/053/054/123/124/144.

**5. Which tests require external providers?** Avoidable with mocks; ENV-06 only when sandbox unavoidable (logging review, some drift).

**6. Which tests require real user studies?** T15-035/108–115 and related UX protocols.

**7. Which tests are zero-tolerance?** Safety/privacy P0s with threshold 0/true fail-closed (inject, leak, dual_truth, resurrect, secrets, IDOR, etc.).

**8. Which require calibrated thresholds?** All `needs_calibration` / `to_be_calibrated_in_stage15` tests (§0 count).

**9. Minimum semantic retrieval quality floor?** Calibration task on T15-075/T15-121: explore nDCG@8 ≥0.55 with CI rule; pin before private beta claim.

**10. Extraction precision required for private beta?** Precision-first via T15-017/136 calibration before algorithm selection; invent rate 0 (T15-002).

**11. How much review-queue growth is allowed?** T15-019/085 calibration; explore ≤2×/day sustained without batch tools.

**12. How quickly must correction and undo propagate?** T15-034 calibration; explore ≤2000ms p95 on sync private-beta path.

**13. Can deletion be tested under partial failure?** Yes after workers — T15-005/123/124/127.

**14. Can export semantics be tested before implementation?** Yes as policy/unit sims for trust bans; watermark integration needs export redesign (T15-013/023/131).

**15. Can model independence be measured?** Yes for eligible-set/canonical invariants (T15-012/116/117); not via PG storage alone.

**16. Which behaviour may vary across models?** Answer style/tone (T15-118); borderline extraction phrasing within variance bounds.

**17. Which must remain invariant?** Canonical rows; eligible IDs; disclosure fail-closed; no dual settled truths; secrets; tenant isolation.

**18. Can provider outages preserve memory safety?** Yes if T15-062/010 hold — degrade without unsafe serve.

**19. Can malicious PDFs be tested safely?** Yes with synthetic corpus DS-PDF-INJECT-001 / T15-007/138; no real user docs.

**20. Can embedding drift be detected before user impact?** Yes via T15-092 gates before embedding_change.

**21. Can cross-space contamination be prevented?** Yes via T15-008/093 with registry at paid scale.

**22. Can adapter disablement be tested?** Yes T15-122/100/015.

**23. Can native-only quality be measured?** Yes T15-121 with adapters off.

**24. What release gates are unwaivable?** Safety/privacy P0s; cross-user isolation; Mem0 remote-text off; secret fail-closed; deletion resurrection=0; disclosure leak=0; MVA/OV conformance.

**25. What test data may never be committed?** Real private user data; real production secrets; real Mem0 customer payloads.

**26. How will subjective labels be adjudicated?** Dual review + third/tie-break; versioned labels (§4.3).

**27. How will flaky provider tests be handled?** Retry ≤3; quarantine infra flakes; safety P0 not silently quarantined (§9).

**28. How are baselines versioned?** eval_baseline_version + dataset_id@version + retrieval_policy_version (§9).

**29. What if a threshold is not established?** `failure_if_no_threshold` applies — usually block the related release claim/algorithm selection.

**30. What findings remain untestable?** Vendor-side log deletion empirics; absolute model obedience to injection; complete deletion in uncontrolled backups without policy (handled as policy conformance T15-036).

**31. What requires normative acceptance rather than experimentation?** OV-01 MVA scope; OV-18 correction register; zero adapters initial release; Auth-last policy; no E2E determinism claim.

**32. What should Stage 16 sequence first?** Disable/harden Mem0 remote-text; ban inventing heuristic; thin assertions+conflict+temporal; Gateway mutations; undo/confirm; semantic floor harness.

**33. What must Stage 17 prohibit?** Enabling adapters/remote-text; broad behaviour defaults without flags; dependency sprawl; dropping `memories`; claiming full 8–12 completeness.

**34. May Stage 16 begin after Stage 15 review?** Yes — after this framework is reviewed; not before.

**35. Does any implementation remain prohibited?** Yes — until Stages 15 and 17 approved per roadmap.

---

## 21. Final verdict

```text
approve_test_framework
```

1. Verdict: `approve_test_framework`.
2. Total test count: **150**.
3. P0 count: **63**.
4. P1 count: **67**.
5. P2 count: **16**.
6. P3 count: **4**.
7. Concrete-threshold count: **103**.
8. Calibration-task count: **41**.
9. Deferred-test count: **6**.
10. Rejected-test count: **0**.
11. Tests executable now (can_run_before_implementation=yes): **110**.
12. Tests requiring core/future implementation surface (current_code not already 'yes…'): **136**.
13. Tests requiring workers (ENV-07): **16**.
14. Tests requiring adapters (adapter_enablement gate): **8**.
15. Tests requiring graph features: **3** (T15-018/095/096) plus deferred reranker T15-094.
16. Private-beta gate size: **15**.
17. Public-beta gate size: **12**.
18. Paid-scale gate size: **12**.
19. Unwaivable gates: safety/privacy P0s; cross-user isolation; Mem0 remote-text off; secrets; deletion resurrection; disclosure leak; MVA/OV conformance.
20. Remaining unknowns: vendor log retention empirics; backup erasure legal specifics (calibrated via T15-036); whether thin MVA suffices for retention (product learning); eng cost of chosen worker host.
21. Stage 14 findings fully traced? **Yes** for blockers, required corrections, OV-01…OV-18, and listed partial gaps.
22. Stage 16 may begin after review? **Yes**.
23. Preconditions for Stage 16: Stage 15 review complete; no implementation until Stage 17; plan from OV register + this catalog.
24. Implementation remains prohibited? **Yes** until Stages 15 and 17 approved.
25. Can this framework genuinely falsify the architecture? **Yes** — zero-tolerance safety oracles and calibrated quality floors can fail the MVA or force OV amendments.

---

## 22. Counts ledger (must reproduce)

| Priority | Count |
| --- | ---: |
| P0 | 63 |
| P1 | 67 |
| P2 | 16 |
| P3 | 4 |
| **Total** | **150** |

| threshold_status | Count |
| --- | ---: |
| concrete | 103 |
| deferred | 6 |
| to_be_calibrated_in_stage15 | 41 |

| evaluation_type | Count |
| --- | ---: |
| chaos_test | 17 |
| cost_model | 1 |
| integration_contract | 20 |
| load_test | 4 |
| manual_review | 1 |
| migration_test | 7 |
| offline_dataset_eval | 21 |
| policy_conformance | 15 |
| privacy_test | 10 |
| security_test | 10 |
| simulation | 9 |
| unit_contract | 23 |
| usability_test | 12 |

| release_gate | Count |
| --- | ---: |
| adapter_enablement | 8 |
| before_paid_scale | 14 |
| before_private_beta | 67 |
| before_public_beta | 54 |
| embedding_change | 1 |
| non_gating_research | 4 |
| provider_change | 2 |

Priority sum check: 63+67+16+4 = 150 (must equal 150).

---

## 23. Final consistency checks

Search discipline applied for complacent placeholders and key terms (Mem0, Graphiti, WRRF, calibration, threshold, P0, private/public beta, paid scale, Stage 16 may begin, implementation prohibited).

Confirmations:

1. Every test has the full schema — **yes** (§17).
2. Every threshold is concrete or has a complete calibration task — **yes**.
3. Priority counts sum exactly — **yes** (§22).
4. Release-gate matrices explicitly sized — **yes** (§10).
5. Every Stage 14 blocker traced — **yes** (§15).
6. Every Stage 14 required correction traced — **yes** (§15).
7. OV-01 through OV-18 traced — **yes** (§15).
8. Current-code applicability explicit — **yes** per test + §7.
9. Required environments explicit — **yes**.
10. Statistical reproducibility defined — **yes** (§4).
11. Subjective labels have adjudication rules — **yes** (§4.3).
12. Private-beta gates match Stage 14 MVA — **yes** (§10.1 / §10A).
13. Public-beta gates match Stage 14 phase boundary — **yes** (§10.2).
14. Paid-scale gates do not silently pull deferred architecture earlier — **yes** (graph/adapters gated).
15. No external adapter enabled by this stage — **yes**.
16. No production implementation added — **yes**.
17. Stages 0–14 untouched — **yes**.
18. Stage 16 and Stage 17 not started — **yes**.
19. Only `docs/memory-system/15-testing-evaluation.md` changed — **enforced by PR scope**.
20. PR remains draft — **process requirement**.

---

## 24. Document control

| Item | Value |
| --- | --- |
| Authoring stage | 15 |
| Supersedes for test design | Stage 14 §17 backlog (expanded here) |
| Normative architecture inputs | Stage 14 §6A OV-01…OV-18; §10A release phases |
| Next stage | 16 — implementation roadmap (after review) |
| Implementation | Prohibited until Stages 15 and 17 approved |

