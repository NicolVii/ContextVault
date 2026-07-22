# Demo-mode & commercial test matrix

This matrix describes how Cortaix behaves when running **offline / local demo** versus **configured Stripe / live providers**, and which automated tests cover each path. Pair with [`admin-commercial-architecture.md`](./admin-commercial-architecture.md).

Demo login (seeded): `demo@contextvault.local` / `demo-password-123`.

---

## 1. Environment modes

| Mode | Typical env | AI chat / think | Embeddings | Memory extract | Stripe checkout | Credits UI |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Offline demo (default local)** | No `OPENROUTER_API_KEY`; `EMBEDDING_PROVIDER=local`; no Stripe | Mock adapter / mock chat | Local deterministic | Heuristic fallback | 503 / “not configured” | Dev top-up available |
| **B. Platform keys, no Stripe** | OpenRouter (or other) key set; Stripe unset | Live adapters | Local or OpenAI | LLM extract if key present | Same as A | Dev top-up + real COGS debit |
| **C. Stripe test + keys** | Stripe secret + prices + webhook; provider keys | Live | As configured | As configured | Checkout / Portal / webhooks | Dev top-up **blocked** (Stripe set) |
| **D. Production** | `NODE_ENV=production` + hosted secrets | Live (must not ship mock as sole path) | Usually OpenAI or equiv. | LLM | Live Stripe | Dev top-up **impossible** |

Mode A is the AGENTS.md / README “offline by default” path. Modes C–D are **Unsafe for public use** until legal/tax/ops checklist items are complete.

---

## 2. Feature × mode matrix

Statuses: **OK** expected to work · **MOCK** demo substitute · **BLOCKED** intentional deny · **N/A** not applicable · **UNVERIFIED** code present, not proven live in this audit · **SCAFFOLD** persisted or flagged only.

| Feature | Mode A (offline) | Mode B (keys, no Stripe) | Mode C (Stripe test) | Mode D (prod) | Automated coverage |
| --- | --- | --- | --- | --- | --- |
| Sign-in / demo seed user | OK (after bootstrap) | OK | OK | OK (real auth) | `memory.test` (integration) |
| Free subscription row | OK (`ensureFreeSubscription`) | OK | OK | OK | UX unit (gates only) |
| Auto turn display (~30) | OK | OK | OK | OK | `commercial-ux`, `billing-providers` |
| Exhaust Free Auto | OK (plan gate) | OK | OK | OK | Unit catalog; no E2E exhaustion test |
| Frontier on Free | BLOCKED | BLOCKED | BLOCKED | BLOCKED | `billing-providers` |
| Attachments on Free | BLOCKED | BLOCKED | BLOCKED | BLOCKED | Documents API + unit entitlements |
| Attachments on Lite/Pro | N/A (need paid plan row) | N/A unless sub forced in DB | OK after webhook | OK | Entitlement unit; upload path untested E2E |
| Mock inference | MOCK | N/A if keys work | N/A if keys work | Must not be sole prod path | `chat-provider`, meter zero-charge |
| Live OpenRouter turn | BLOCKED (no key) | OK / UNVERIFIED | OK / UNVERIFIED | OK / UNVERIFIED | Adapter registration unit only |
| Credit debit (platform) | N/A (mock = 0) | OK | OK | OK | `production-safety` computeCredits |
| Plan turn recording | Skipped on mock | OK | OK | OK | Logic in `plan-usage`; RPC needs DB |
| Dev top-up +100k | OK | OK | BLOCKED | BLOCKED | `production-safety` |
| Checkout Lite/Pro | BLOCKED (503) | BLOCKED (503) | UNVERIFIED | UNVERIFIED | No E2E; checkout Zod/path untested |
| Customer Portal | BLOCKED | BLOCKED | UNVERIFIED | UNVERIFIED | — |
| Webhook signature | N/A | N/A | UNVERIFIED live | Required | Unit constructEvent; claim integration |
| Period credit grant | N/A | N/A | UNVERIFIED | Required | Mocked claim pattern only |
| Payment grace / restrict | Manual DB possible | Same | UNVERIFIED | Required | Code path; no dedicated test |
| Founding Pro offer UI | Shows if Free; checkout fails | Same | UNVERIFIED (coupon) | UNVERIFIED | Eligibility unit |
| BYOK save (Free/Lite) | BLOCKED 403 | BLOCKED | BLOCKED | BLOCKED | Entitlement unit |
| BYOK save (Pro) | Needs Pro row + crypto | Same | Same | Needs `BYOK_ENCRYPTION_KEY` | Crypto unit |
| BYOK inference (no debit) | N/A | UNVERIFIED | UNVERIFIED | UNVERIFIED | `computeCreditsCharged` byok=0 |
| Spend cap save | OK (persists) | OK | OK | OK | — |
| Spend cap enforce | SCAFFOLD | SCAFFOLD | SCAFFOLD | SCAFFOLD | None |
| Auto top-up | SCAFFOLD (forced off in UI) | Same | Same | Same | None |
| Voice feature | SCAFFOLD | SCAFFOLD | SCAFFOLD | SCAFFOLD | Flag unit only |
| Workspace budget | SCAFFOLD (CRUD) | Same | Same | Same | None |
| Telemetry insert | OK if DB up | OK | OK | OK | None (fire-and-forget) |
| Mem0 memory | N/A default supabase | Optional if `MEM0_API_KEY` | Same | Same | `mem0-*` unit |
| `/api/status` | Shows mock / local | Shows live flags | Same | Same | Manual |

---

## 3. Manual demo checklist (Mode A)

Run after `pnpm bootstrap` (or `db:start` + `env:sync` + `db:reset`) and `pnpm dev`.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Open `/login`, sign in as demo user | Lands in app / Vault |
| 2 | Open `/vault/plan` | Free plan; Auto remaining; no Stripe upgrade (or disabled); Dev top-up visible |
| 3 | Dev top-up | Balance increases; page reload shows new internal balance under Usage details |
| 4 | Thinking: send a message | Reply marked mock; memories/heuristics may still run |
| 5 | Try Frontier / expensive model if UI allows | Blocked or cheap-only routing on Free |
| 6 | Try file upload on Free | Locked (Lite/Pro) |
| 7 | Settings → Advanced → BYOK | Locked with link to plans |
| 8 | Founding banner (if shown) | Dismiss works; checkout fails with Stripe not configured |
| 9 | `GET /api/status` | `chat.provider: mock`, embeddings local, metering flags present |

---

## 4. Manual Stripe test checklist (Mode C) — unverified in audit

Do not treat as passed until executed against Stripe test mode.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Set Stripe secret, webhook secret, four price IDs; restart app | `isStripeConfigured()` true; Dev top-up hidden |
| 2 | Forward webhooks to `/api/billing/webhook` | Signature accepts |
| 3 | Upgrade Lite monthly | Checkout → success URL; `subscriptions.plan_id=lite`; period grants |
| 4 | Run Frontier turns | Counter decrements toward 10 |
| 5 | Fail a renewal (test card) | Grace banner; after window, inference restricted |
| 6 | Portal cancel | At period end / cancel flag; then Free |
| 7 | Founding Pro with coupon env | Discount applied |
| 8 | Pro BYOK save + turn | Key stored encrypted; zero Cortaix debit |

---

## 5. Automated test commands

| Command | Scope | Result in this audit |
| --- | --- | --- |
| `pnpm check` | lint + typecheck + unit (excludes integration + `memory.test`) | **Pass** — 13 files, 118 tests |
| `pnpm test:unit` | Unit only | **Pass** (same suite) |
| `pnpm test:integration` | `memory.test` + `stripe-webhook.integration` (`CV_INTEGRATION=1`) | Requires local Supabase; not run as part of docs-only unit gate |
| `pnpm check:full` | `check` + integration | Needs Docker + `pnpm bootstrap` / stack healthy |

### Unit suites relevant to commercial / demo

- `tests/billing-providers.test.ts` — products, entitlements, intensity, adapters
- `tests/commercial-ux.test.ts` — pricing / Free gates / founding eligibility
- `tests/production-safety.test.ts` — prod top-up deny, BYOK crypto, credit skip, Stripe signature, mocked webhook idempotency
- `tests/inference.test.ts` — router + credit estimates
- `tests/chat-provider.test.ts` — mock / OpenRouter provider selection
- `tests/mem0-*.test.ts` — Mem0 client/mapping (optional provider)

### Known coverage gaps (demo & commercial)

1. No Playwright / browser E2E for Plan UI or Checkout redirect.
2. No integration test that drives full `handleStripeEvent` grant + subscription upsert against fixtures.
3. Daily fair-use, spend cap, auto top-up, voice, workspace budgets: no tests (scaffolded).
4. Live provider adapter HTTP calls: not tested (registration only).
5. `memory.test.ts` / stripe claim integration: skipped unless `CV_INTEGRATION=1` and env present.

---

## 6. Safety assertions for demo vs public

| Rule | Demo (A/B) | Public (D) |
| --- | --- | --- |
| Dev top-up | Allowed if not production and Stripe unset | Must remain impossible |
| Mock as only AI | Acceptable | Unsafe if customers expect paid intelligence |
| Local Supabase JWT defaults | OK on laptop | Never reuse on hosted |
| BYOK without `BYOK_ENCRYPTION_KEY` | Local fallback OK | Must fail closed |
| Stripe live keys + incomplete legal | — | Unsafe for public use |
| Credit pack storefront | Hidden (`public: false`) | Keep hidden until product decision |

---

## 7. Quick failure signals

| Symptom | Likely cause |
| --- | --- |
| Plan page shows Free with zeros after DB error | `getPlanUsageSnapshot` free fallback (migrations missing?) |
| Upgrade always 503 | `STRIPE_SECRET_KEY` unset |
| Upgrade 500 “Missing env STRIPE_PRICE_…” | Price ID not set |
| Dev top-up 403 with Stripe unset | Running with `NODE_ENV=production` |
| Dev top-up 403 “Use Stripe Checkout” | Stripe secret present |
| All chat is mock despite key | Key not in process env / wrong name / whitespace — check `/api/status` |
| BYOK 500 on save in prod | Missing `BYOK_ENCRYPTION_KEY` |
| Webhook 503 | Missing Stripe secret or webhook secret |
