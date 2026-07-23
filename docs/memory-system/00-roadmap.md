# 00 — Memory System Master Roadmap

> **Role:** Planning process owner  
> **Scope:** Sequence and operating rules for Cortaix memory-system design.  
> **Constraints:** Documentation and planning only. No production behaviour changes in this track until stage 17 is approved.

This track proceeds in **small, evidence-based stages**. Each stage produces one report under `docs/memory-system/`. Stages investigate and design; they do not implement.

---

## Operating rules

1. Only one stage is investigated at a time.
2. Every stage must read all relevant earlier reports.
3. Earlier conclusions must be challenged, not blindly accepted.
4. Repository evidence must be separated from assumptions.
5. Planning stages must not change production behaviour.
6. Future stages must not be started prematurely.
7. The sequence may be adjusted if repository evidence justifies it.
8. No implementation begins until the architecture, red-team review, testing plan, and first PR specification are approved.

---

## Stages

### Discovery and audit

| # | Stage | Status | Output |
| --- | --- | --- | --- |
| 1 | Repository map | **complete** | [`01-repository-map.md`](./01-repository-map.md) |
| 2 | Current chat and memory flow audit | **next** | `02-current-memory-flow.md` |
| 3 | Database, migrations, indexes, and RLS audit | pending | `03-database-rls-audit.md` |
| 4 | Memory extraction and classification audit | pending | `04-extraction-audit.md` |
| 5 | Retrieval and context construction audit | pending | `05-retrieval-context-audit.md` |
| 6 | Security, privacy, and failure analysis | pending | `06-security-failure-audit.md` |

### Target design

| # | Stage | Status | Output |
| --- | --- | --- | --- |
| 7 | Target memory architecture | pending | `07-target-architecture.md` |
| 8 | Memory taxonomy, trust model, and lifecycle | pending | `08-memory-model.md` |
| 9 | Database and service design | pending | `09-technical-design.md` |
| 10 | Extraction, validation, deduplication, and conflict design | pending | `10-memory-processing-design.md` |
| 11 | Entity and relationship design | pending | `11-entity-relationship-design.md` |
| 12 | Hybrid retrieval, reranking, and context design | pending | `12-retrieval-design.md` |

### Evaluation and safe delivery

| # | Stage | Status | Output |
| --- | --- | --- | --- |
| 13 | Framework build-versus-reuse evaluation | pending | `13-framework-evaluation.md` |
| 14 | Architecture red-team review | pending | `14-architecture-red-team.md` |
| 15 | Testing and evaluation framework | pending | `15-testing-evaluation.md` |
| 16 | Phased implementation roadmap | pending | `16-implementation-roadmap.md` |
| 17 | First safe implementation PR specification | pending | `17-first-pr-specification.md` |

---

## Stage responsibilities (summary)

1. **Repository map** — Locate chat, memory, embeddings, retrieval, DB, auth, and related surfaces. *(done)*
2. **Current flow audit** — Trace end-to-end chat/think → retrieve → respond → extract → persist.
3. **Database / RLS audit** — Schema, migrations, indexes, grants, and row-level security for memory data.
4. **Extraction audit** — How candidates are classified, scored, and written today.
5. **Retrieval / context audit** — How memories and documents become prompt context.
6. **Security / failure analysis** — Privacy boundaries, abuse paths, and failure modes.
7. **Target architecture** — Proposed system shape grounded in audit evidence.
8. **Memory model** — Taxonomy, trust levels, and lifecycle states.
9. **Technical design** — Tables, services, and interfaces for the target.
10. **Processing design** — Extraction, validation, dedupe, and conflict handling.
11. **Entity / relationship design** — People, places, concepts, and links between memories.
12. **Retrieval design** — Hybrid search, reranking, and context packing.
13. **Framework evaluation** — Build vs reuse (e.g. Mem0 and alternatives) with evidence.
14. **Red-team review** — Challenge architecture for gaps, risks, and overreach.
15. **Testing / evaluation** — How correctness, regression, and quality will be measured.
16. **Implementation roadmap** — Ordered, reversible delivery phases.
17. **First PR spec** — Narrowest safe change set; gate for any code work.

---

## Gate before implementation

Stages **7**, **14**, **15**, and **17** (architecture, red-team, testing plan, first PR spec) must be complete and approved before any production code, migrations, APIs, prompts, tests, dependencies, or configuration changes land for this track.
