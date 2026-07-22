# Private beta readiness

Operational checklist and remaining launch risks for a **closed private beta** of Cortaix (Context Vault). Companion docs:

- [`admin-commercial-architecture.md`](./admin-commercial-architecture.md) — system map and status legend
- [`demo-mode-test-matrix.md`](./demo-mode-test-matrix.md) — demo vs live behaviour matrix
- [`legal-readiness-checklist.md`](./legal-readiness-checklist.md) — legal / tax documents before public payments

This document is for **operators and reviewers**. It is not a commitment to ship dates.

---

## 1. What “private beta ready” means

| Goal | Definition |
| --- | --- |
| Safe demo | `COMMERCIAL_MODE=demo` (default non-prod): catalog + Free usage; Checkout/Portal blocked even if Stripe keys exist |
| Safe disabled | Production unset → `disabled`; no Checkout/Portal/dev top-up |
| Staff-only admin | Normal users get **404** on `/admin` and **403** on `/api/admin/*`; RLS blocks client reads/writes of admin config |
| Offline AI | No `OPENROUTER_API_KEY` → mock chat; `EMBEDDING_PROVIDER=local` → deterministic embeddings |
| Test payments (optional) | Only with `COMMERCIAL_MODE=live` + full live-readiness (test keys, prices, webhook secret, app URL) |

Automated coverage for these gates lives in:

- Unit: `tests/commercial-hardening.test.ts`, `commercial-mode.test.ts`, `admin-roles.test.ts`, `live-readiness.test.ts`, `production-safety.test.ts`, …
- Integration: `admin-config-rls.integration.test.ts`, `admin-auth.integration.test.ts`, `admin-entitlements.integration.test.ts`, `stripe-lifecycle.integration.test.ts`, `promotions.integration.test.ts`, `provider-ops.integration.test.ts`, …

Run: `pnpm check` (unit) and `pnpm check:full` (unit + integration, Supabase up).

---

## 2. Remaining launch risks

### High — block public paid launch (still OK for invite-only demo)

| Risk | Why it matters | Mitigation for private beta |
| --- | --- | --- |
| Legal / tax incomplete | Terms, Privacy, Billing Terms, VAT / myDATA not counsel-signed | Keep `COMMERCIAL_MODE=demo` or `disabled`; do not take real cards |
| Live Stripe unverified E2E | Checkout → webhook → period grants not proven against Stripe Dashboard in CI | Use demo grants/simulations; if testing live, use **test mode** keys + webhook forwarding only |
| Spend cap / auto top-up / voice / workspace budgets | Scaffolded flags; enforcement incomplete | Leave `FEATURE_*` off (default) |
| Refund clawback | Soft telemetry only; no automatic credit reclaim | Manual ops process if any test refunds |
| Price book placeholders | Provider micros in `pricing.ts` may drift from vendor list rates | Treat COGS dashboards as directional |

### Medium — private beta with paid testers (Stripe test or limited live)

| Risk | Why it matters | Check before enabling |
| --- | --- | --- |
| Webhook health | Paid subs without recent webhooks block live readiness | Forward Stripe CLI; confirm `stripe_webhook_events` inserts |
| Livemode mismatch | `sk_test_*` rejecting livemode events (and vice versa) | Never mix Dashboard livemode with test secret |
| `sk_live_*` without ack | Blocked unless `STRIPE_ALLOW_LIVE_KEYS=1` | Prefer test keys for beta |
| Grace / dunning | 7-day grace then `inference_restricted`; vault stays readable | Confirm Smart Retries in Stripe; banner copy reviewed |
| BYOK in production | Requires dedicated `BYOK_ENCRYPTION_KEY` (no service-role fallback) | Set before any Pro BYOK tester |
| Registration / checkout kill-switches | Ops can halt signup or Checkout | Seed admin knows `/admin` system controls |
| Provider outages | Disabled / mock-only / platform `mock_only_mode` | Confirm mock fallback before marketing “always works” |

### Lower — product / ops polish

| Risk | Notes |
| --- | --- |
| No Playwright E2E | Admin 404 concealment and Plan UI are manual or lib-level; add browser E2E before wide beta |
| Admin API HTTP suite | RBAC minima covered in unit matrix; full Next route harness not yet in CI |
| Founding coupon | Needs `STRIPE_COUPON_PRO_FOUNDING` when offering founding Pro |
| Mem0 / multi-provider | Optional; default remains Supabase memory + local embeddings |
| Super-admin seed password | Local only (`admin-password-123`); never reuse in hosted envs |

---

## 3. Operational checks (before inviting beta users)

### Environment

- [ ] `.env.local` from `pnpm env:sync` (local) or hosted secrets from a vault — not committed
- [ ] `COMMERCIAL_MODE` explicit: `demo` for offline invites, `live` only for payment pilots
- [ ] No `STRIPE_SECRET_KEY` in demo/disabled deploys **or** accept that Checkout still 403s if keys leak into env
- [ ] `NEXT_PUBLIC_APP_URL` matches the beta hostname when live
- [ ] `OPENROUTER_API_KEY` / provider keys only if live inference is intended
- [ ] `EMBEDDING_PROVIDER=local` unless OpenAI embeddings are approved
- [ ] `BYOK_ENCRYPTION_KEY` set if any Pro BYOK tester exists in production
- [ ] Feature flags default off unless a beta experiment is named

### Database / auth

- [ ] Migrations applied (`pnpm db:reset` local / hosted migrate path)
- [ ] Demo seed used only locally; hosted invites use real accounts
- [ ] At least one `super_admin` in `user_roles` for break-glass
- [ ] Confirm RLS: anon/authenticated cannot read `admin_audit_log`, grants, simulations, promotions, system controls, provider ops (covered by integration tests)

### Stripe (payment pilot only)

- [ ] Test mode: secret + webhook secret + four price IDs + coupon if needed
- [ ] Webhook endpoint `/api/billing/webhook` receiving events (CLI or Dashboard)
- [ ] Admin **Billing readiness** report green (no secrets in JSON)
- [ ] Failure card → grace banner; cancel → Free; paid invoice clears restriction (see `stripe-lifecycle.integration.test.ts`)
- [ ] Customer Portal limited to Lite ↔ Pro in Stripe settings

### Admin / security

- [ ] Sign in as normal user → `/admin` is 404, `/api/admin/session` is 403
- [ ] Support can read overview/audit; cannot publish plans or flip kill-switches
- [ ] Admin mutations require reason ≥ 3 chars and write `admin_audit_log`
- [ ] Provider health / admin views never return raw API keys
- [ ] Rotate any key that ever appeared in logs or screenshots

### Product smoke (demo mode)

- [ ] Demo login works; Plan page shows Free + blocked upgrade
- [ ] Thinking returns mock when no OpenRouter key
- [ ] Free Frontier / attachments / BYOK blocked
- [ ] Temporary grant or plan simulation shows demo banner and `exclude_from_revenue`
- [ ] Promotion redeem in demo uses `demo_stripe_simulation` (no Stripe objects)

---

## 4. Mode decision tree

```text
Invite-only product feedback, no cards?
  → COMMERCIAL_MODE=demo (or unset non-prod)
  → Prefer no Stripe secret in the deploy

Hosted preview that must not charge anyone?
  → COMMERCIAL_MODE=disabled (production default when unset)

Closed payment pilot with testers?
  → COMMERCIAL_MODE=live + sk_test_* + full readiness
  → Document tester list; monitor payment_failed / inference_restricted

Public paid launch?
  → Blocked until legal-readiness-checklist.md is complete
  → Then live keys only with STRIPE_ALLOW_LIVE_KEYS=1 + tax/ops sign-off
```

---

## 5. Incident / kill-switch quick reference

| Control | Effect |
| --- | --- |
| `maintenance_mode` | Product APIs 503 |
| `checkout_shutdown` | Blocks Checkout session creation |
| `mock_only_mode` | Forces mock inference |
| `provider_shutdown` / `model_shutdown` | Disables providers/models (optional target lists) |
| `registration_shutdown` | DB trigger blocks new `auth.users` |
| `frontier_shutdown` | Rejects Frontier turns |
| Revoke grant / end simulation | Returns user to subscription or Free |

All mutations should go through the Admin console (or service role) and appear in `admin_audit_log`.

---

## 6. Sign-off snapshot

| Area | Private beta (demo) | Payment pilot (test live) | Public launch |
| --- | --- | --- | --- |
| Admin RBAC + RLS | Required + tests | Required | Required |
| Demo/disabled Stripe isolation | Required + tests | N/A (live) | N/A |
| Grace / cancel / failed payment | Optional | Required + tests | Required |
| Legal / tax | Soft copy OK | Soft copy OK | Counsel + accountant |
| Live Stripe E2E | Skip | Manual + webhook health | Required |
| Feature scaffolds | Off | Off unless scoped | Off until built |

**Verdict for invite-only private beta:** ship with `COMMERCIAL_MODE=demo` (or `disabled` on production hosts), mock/local AI as needed, staff admin for grants/simulations, and treat paid launch as a separate gate after legal + live Stripe verification.
