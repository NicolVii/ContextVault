# Admin commercial architecture audit

Status legend used below:

| Status | Meaning |
| --- | --- |
| **Fully functional** | Implemented end-to-end in code; works in the intended environment without stubs. |
| **Configured but unverified** | Implementation exists and is env-gated, but live Stripe/provider/tax paths have not been proven in this audit. |
| **Scaffolded** | Schema, flags, or API surface exist; product behavior is incomplete or not enforced. |
| **Mocked** | Offline / demo substitute deliberately used when keys or Stripe are absent. |
| **Disabled** | Explicitly blocked in production or kept off the public storefront. |
| **Unsafe for public use** | Must not accept real customer money or store production secrets until listed gaps are closed. |

This document is an **audit of the current codebase**, not a redesign. Related checklist: [`legal-readiness-checklist.md`](./legal-readiness-checklist.md). Demo / offline verification matrix: [`demo-mode-test-matrix.md`](./demo-mode-test-matrix.md).

There is **no separate admin console** for commercial ops. Operators use Stripe Dashboard, Supabase tables/RPC, `/api/status` (non-secret diagnostics), and application UI under Vault.

---

## 1. System map

```text
Customer UI
  /vault/plan          PlanUsagePanel (usage, upgrade, portal, optional spend cap, dev top-up)
  /vault/settings      BYOK (Pro), workspaces CRUD, default model
  Thinking composer    plan-gated attachments; founding offer banner
        │
        ▼
API routes
  /api/billing/checkout | portal | webhook | usage | settings | byok | dev-topup
  /api/credits           wallet + recent usage_events
  /api/documents         attachments + storageBytes entitlements
  /api/chat · /api/think → orchestration → runInference
        │
        ▼
Billing + inference libs
  products · entitlements · plan-usage · webhook · stripe · byok · telemetry
  adapters (openrouter/openai/anthropic/google/groq/mock)
  credits · meter · pricing · router
        │
        ▼
Postgres (Supabase)
  subscriptions · stripe_customers · stripe_webhook_events
  plan_usage_periods · subscription_period_grants · billing_settings
  billing_telemetry_events · user_provider_keys
  credit_accounts · credit_ledger · usage_events · price_book
  workspaces · workspace_members
```

### Primary source files

| Area | Paths |
| --- | --- |
| Catalog / Stripe helpers | `src/lib/billing/products.ts`, `stripe.ts`, `constants.ts` |
| Entitlements / usage | `entitlements.ts`, `plan-usage.ts`, `usage-intensity.ts`, `grace.ts`, `ensure-free.ts` |
| Webhooks | `webhook.ts`, `src/app/api/billing/webhook/route.ts` |
| BYOK | `byok.ts`, `byok-crypto.ts`, `byok-providers.ts`, `api/billing/byok` |
| Dev top-up | `dev-topup.ts`, `api/billing/dev-topup` |
| Telemetry / future tiers | `telemetry.ts`, `future-tiers.ts` |
| Inference bridge | `src/lib/inference/complete.ts`, `meter.ts`, `credits.ts`, `adapters/` |
| UI | `PlanUsagePanel.tsx`, `ByokPanel.tsx`, `BillingPanel.tsx` (deprecated shim), `FoundingOfferBanner.tsx` |
| Migrations | `20260721140000_inference_metering.sql`, `…billing_byok_workspaces.sql`, `…stripe_webhook_events.sql`, `…commercial_plan_usage.sql`, `…founding_offer_dismissed.sql` |

---

## 2. Plan products (Free / Lite / Pro)

**Status: Fully functional (in-code catalog) · Stripe prices configured but unverified**

Launch catalog in `SUBSCRIPTION_PLANS`:

| Plan | Monthly (EUR cents) | Annual | Notes |
| --- | --- | --- | --- |
| Free | 0 | — | ~30 Auto turns / month; no Frontier; no attachments |
| Lite | 500 (€5) | 5_000 | Unlimited Auto (fair use); 10 Frontier turns; 100 MB library |
| Pro | 2_800 (€28) | 28_000 | Founding monthly display 2_500; BYOK + voice flags; soft Frontier credit cap |

- Public storefront = these three only (`getPublicPlans()`). Team / Max are not SKUs.
- Stripe Price IDs are **env-mapped** (`STRIPE_PRICE_LITE_MONTHLY`, …). Missing price → checkout returns 500.
- Optional pack `pack_frontier_boost` exists but `public: false` → **Disabled** on storefront; checkout rejects non-public packs.
- `FUTURE_TIER_SPECS` (Private / Executive / Concierge / Team) is **Scaffolded** marketing/positioning only — not in checkout or entitlements.

---

## 3. Entitlements

**Status: Fully functional definitions · mixed enforcement**

`PLAN_ENTITLEMENTS` in `entitlements.ts`. Unknown / legacy `team` → Free gates.

| Gate | Free | Lite | Pro | Enforcement today |
| --- | --- | --- | --- | --- |
| Auto monthly turns | 30 | unlimited | unlimited | **Fully functional** — `assertPlanAllowsTurn` + `record_plan_usage_turn` |
| Frontier monthly turns | 0 | 10 | null (soft credit cap) | **Fully functional** for hard counts / soft Pro cap |
| Auto period fair-use credits | 8k | 400k | 2M | **Fully functional** (period) |
| Auto daily fair-use credits | 8k | 50k | 200k | **Scaffolded** — field unused in assert/record paths |
| Max Frontier credits / turn | 0 | 8k | 50k | **Fully functional** |
| Attachments | no | yes | yes | **Fully functional** — documents API + composer UI |
| Storage bytes | 0 | 100 MB | 5 GB | **Fully functional** — documents API |
| BYOK | no | no | yes | **Fully functional** — API 403 + inference force-platform |
| Voice | no | no | yes | **Scaffolded** — flag only; no voice product surface |
| `elevatedLimits` | no | no | yes | **Scaffolded** — unused beyond Free `cheapOnlyRouting` |

Free users also get `cheapOnlyRouting` in `runInference` so Auto stays on cheap models.

---

## 4. Stripe billing routes

| Route | Role | Status |
| --- | --- | --- |
| `POST /api/billing/checkout` | Subscription (Lite/Pro) or public pack Checkout Session; founding coupon optional | **Configured but unverified** without live Stripe + prices |
| `POST /api/billing/portal` | Customer Portal session → `/vault/plan` | Same |
| `POST /api/billing/webhook` | Signature verify → `handleStripeEvent` | Same; unit tests cover signature + claim pattern |
| `GET /api/billing/usage` | Plan snapshot + storage used + founding offer | **Fully functional** against DB |
| `GET/PATCH /api/billing/settings` | Spend cap / auto-topup flags / founding dismiss | Persistence **Fully functional**; enforcement below |
| `GET/PUT/DELETE /api/billing/byok` | Encrypted provider keys (Pro) | **Fully functional** with encryption env rules |
| `POST /api/billing/dev-topup` | Local credit grant | **Fully functional** locally; **Disabled** in production |

Checkout features when Stripe is configured: billing address, tax ID collection, Stripe Tax, ToS consent copy, founding Pro coupon (`STRIPE_COUPON_PRO_FOUNDING`).

### Webhook handlers (`webhook.ts`)

| Event | Behavior |
| --- | --- |
| `checkout.session.completed` | One-time payment: grant credits from session metadata |
| `invoice.paid` | Clear restriction; pack price → top-up; plan price → idempotent period grant + credits |
| `invoice.payment_failed` | Start 7-day grace |
| `charge.refunded` | Telemetry only (soft clawback signal) |
| `customer.subscription.*` | Upsert / cancel → Free |

Idempotency: `stripe_webhook_events` unique `event_id`; claim released on handler failure so Stripe can retry. Period grants: `subscription_period_grants` unique `(stripe_subscription_id, period_start)`.

**Unsafe for public use** until Stripe Tax / Portal / legal docs / price verification in [`legal-readiness-checklist.md`](./legal-readiness-checklist.md) are done. Code alone is not a go-live.

---

## 5. Credits, usage events, and metering

**Status: Fully functional (platform path) · Mocked when no provider keys**

- Wallet: `credit_accounts` + `credit_ledger` via `apply_credit_delta`.
- Signup bootstrap: `DEFAULT_SIGNUP_CREDITS` = 3_000 (internal; Free Auto is period-counted, not this grant).
- Settlement: `settleUsage` → `usage_events` keyed by `request_id` (idempotent).
- Debit rules: `billingMode === "byok"` or `provider === "mock"` → **0 credits**.
- Plan counters: `recordPlanTurn` after platform (non-mock) turns.
- Embeddings: `meter-embed.ts` meters only when `EMBEDDING_PROVIDER=openai`; local embeddings skip COGS metering.
- Price book: in-code + DB seed; legal checklist marks provider micros as **placeholders** until externally verified → treat COGS analytics as **Configured but unverified**.

Subscription period credit grant sizes approximate `autoFairUsePeriodCredits + (frontierSoftCreditCap ?? 80_000)` — internal wallet top-up, not the customer-facing Auto/Frontier counters.

---

## 6. Provider adapters

**Status: Fully functional adapter code · live calls configured but unverified · Mocked offline**

Registered in `src/lib/inference/adapters/index.ts`: `openrouter`, `openai`, `anthropic`, `google`, `groq`, `mock`.

| Provider | Platform key env | Notes |
| --- | --- | --- |
| OpenRouter | `OPENROUTER_API_KEY` or `OPENROUTER_API_KEYS` pool | Primary path; also used by legacy chat provider |
| OpenAI | `OPENAI_API_KEY` | Chat + optional embeddings |
| Anthropic | `ANTHROPIC_API_KEY` | Native Messages API |
| Google | `GOOGLE_API_KEY` / `GEMINI_API_KEY` | OpenAI-compatible Gemini endpoint |
| Groq | `GROQ_API_KEY` | OpenAI-compatible |
| Mock | none | Used when no runnable key for any binding |

`runInference` failovers across model bindings; settles once per `request_id`. Without keys → mock completion, no wallet debit, no plan-turn record.

Memory: `MEMORY_PROVIDER=supabase` (default) or `mem0` — orthogonal to Stripe; Mem0 needs `MEM0_API_KEY`.

---

## 7. BYOK

**Status: Fully functional (Pro) · production crypto rules enforced in unit tests**

- Providers: openrouter, openai, anthropic, google, groq.
- Storage: AES-256-GCM in `user_provider_keys`; derivation salt `cortaix-byok-v1`.
- Production **requires** `BYOK_ENCRYPTION_KEY` (no service-role fallback). Local may fall back to `SUPABASE_SERVICE_ROLE_KEY`.
- Pro entitlement required to save keys; inference forces platform billing if BYOK not entitled.
- When BYOK key is used and plan allows → `billingMode=byok`, zero Cortaix debit, plan turns not recorded.
- Key rotation (`BYOK_ENCRYPTION_KEY_PREVIOUS`) documented as future in README — **Scaffolded**.

**Unsafe for public use** if production deploys without a dedicated encryption secret, or if plaintext keys are logged (current code does not return plaintext from list API).

---

## 8. Dev top-up

**Status: Fully functional in non-production · Disabled in production**

`isDevTopupAllowed`: `NODE_ENV === "production"` → false (no env override). Route also refuses when `STRIPE_SECRET_KEY` is set. UI shows “Dev top-up” only when Stripe unset and top-up allowed. Covered by `tests/production-safety.test.ts`.

---

## 9. Billing settings (spend cap / auto top-up)

**Status: Scaffolded**

- Columns + PATCH API persist `monthly_spend_cap_eur_cents`, `auto_topup_enabled`, `auto_topup_pack_id`.
- Plan UI can save a spend cap and **forces** `autoTopupEnabled: false`.
- No worker or checkout path enforces the cap or performs auto top-up.
- Grace / `inference_restricted` **are** enforced on inference via `applyGraceExpiryIfNeeded` + `assertPlanAllowsTurn`.

---

## 10. Telemetry

**Status: Fully functional write path · no admin analytics UI**

`recordBillingTelemetry` → `billing_telemetry_events` (fire-and-forget; never breaks product paths).

Observed event names: `checkout_started`, `subscription_period_granted`, `payment_failed`, `inference_restricted`, `charge_refunded`, `subscription_canceled`, `inference_turn`.

---

## 11. Vault Plan UI & related surfaces

| Surface | Status |
| --- | --- |
| `/vault/plan` + `PlanUsagePanel` | **Fully functional** for Free usage display, plan list, recent usage, details drawer; Stripe CTAs need config |
| `BillingPanel` | **Disabled** as product UI — deprecated redirect shim to Plan & Usage |
| Founding offer banner | **Configured but unverified** (needs Stripe + coupon) |
| Vault settings BYOK | **Fully functional** when Pro; locked copy otherwise |
| Workspaces panel | **Scaffolded** — CRUD + optional budget field; budget **not** applied in metering |
| Landing pricing | Catalog-driven copy; not a checkout surface |

---

## 12. Workspaces

**Status: Scaffolded**

Tables + `/api/workspaces` + Settings UI for personal labels / optional monthly credit budget. Shared team tenancy is explicitly out of launch scope. Inference does not scope or enforce workspace budgets.

---

## 13. Environment variables (commercial)

| Variable | Role |
| --- | --- |
| `STRIPE_SECRET_KEY` | Enables Stripe client + disables dev top-up |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_PRICE_LITE_*` / `STRIPE_PRICE_PRO_*` | Checkout line items |
| `STRIPE_COUPON_PRO_FOUNDING` | Optional founding Pro discount |
| `STRIPE_PRICE_PACK_FRONTIER_BOOST` | Non-public pack |
| `NEXT_PUBLIC_APP_URL` | Checkout / portal return URLs |
| `BYOK_ENCRYPTION_KEY` | Required in production for BYOK |
| `OPENROUTER_API_KEY` / `OPENROUTER_API_KEYS` | Platform inference |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` / `GEMINI_API_KEY`, `GROQ_API_KEY` | Direct adapters |
| `EMBEDDING_PROVIDER` | `local` (default) or `openai` |
| `MEMORY_PROVIDER` / `MEM0_API_KEY` | Memory backend |

See `.env.example` for comments. Local demo JWTs must never be used in hosted environments.

---

## 14. Test coverage (commercial-related)

| Suite | What it covers | Needs DB |
| --- | --- | --- |
| `tests/billing-providers.test.ts` | Catalog, entitlements, intensity, adapters, BYOK list | No |
| `tests/commercial-ux.test.ts` | Pricing copy, founding eligibility, Free gates | No |
| `tests/production-safety.test.ts` | Dev top-up, BYOK crypto, credit skip, Stripe signature, mocked idempotency | No |
| `tests/inference.test.ts` | Router, pricing estimates | No |
| `tests/stripe-webhook.integration.test.ts` | Real `claimStripeEvent` uniqueness | Yes (`CV_INTEGRATION=1`) |
| `tests/memory.test.ts` | RLS / memory (not billing, but in `check:full`) | Yes |

Gaps relative to a go-live audit: no end-to-end Stripe Checkout/Portal test; no live webhook fixture against full `handleStripeEvent` grant math; no enforcement tests for spend cap / daily fair use / voice / workspace budgets.

---

## 15. Summary matrix

| Component | Status |
| --- | --- |
| Free/Lite/Pro product catalog | Fully functional |
| Stripe Price env wiring | Configured but unverified |
| Checkout / Portal / Webhook code | Configured but unverified · Unsafe for public use until ops/legal complete |
| Credit packs (Frontier boost) | Disabled (non-public) |
| Future qualitative tiers | Scaffolded |
| Plan turn / Frontier / fair-use period gates | Fully functional |
| Daily fair-use credits | Scaffolded |
| Voice entitlement | Scaffolded |
| Attachments + storage gates | Fully functional |
| Credit wallet + usage_events | Fully functional |
| Mock inference offline | Mocked |
| Provider adapters | Fully functional code · live unverified |
| BYOK encrypt/store/use | Fully functional (Pro) |
| Dev top-up | Fully functional locally · Disabled in production |
| Spend cap / auto top-up | Scaffolded |
| Payment grace + inference restrict | Fully functional |
| Billing telemetry inserts | Fully functional |
| Vault Plan & Usage UI | Fully functional (local paths) |
| BillingPanel | Deprecated shim |
| Workspaces budgets | Scaffolded |
| Admin commercial console | Absent (ops via Stripe/DB) |
| Price book COGS micros | Configured but unverified (placeholders) |

---

## 16. Operator notes (no redesign)

1. Local commercial loop: leave Stripe unset → Free plan + mock/heuristic AI + **Dev top-up** for wallet experiments.
2. Stripe test mode: set secret, webhook secret, price IDs, forward webhooks to `/api/billing/webhook`, configure Portal + Tax in Dashboard.
3. Production: never enable Stripe without legal checklist + `BYOK_ENCRYPTION_KEY` + verified price book; keep `NODE_ENV=production` so dev top-up cannot run.
4. Refunds today only emit telemetry — manual ops/support confirm unused credit lots before clawback.
5. Prefer querying `billing_telemetry_events` and Stripe Dashboard over building an admin UI until go-live priorities are set.
