# Legal & commercial readiness checklist

This is an **internal readiness checklist**, not final legal copy.
Counsel and an accountant must draft or review documents before live payments.

## Documents required before accepting live payments

| Document | Must cover | Open decisions |
|---|---|---|
| Terms of Service | Account rules, liability, governing law | Entity name; governing law |
| Privacy Policy | Controllership, processors, transfers, rights | Analytics cookies; EU transfers |
| Subscription & Billing Terms | Renewals, Free/Lite/Pro, fair use, soft caps | VAT inclusive display |
| Refund & cancellation | Period-end access, packs, withdrawal | 14-day digital service stance |
| Credit / usage rules | Auto vs Frontier, expiry, no Max | Confirm Lite Frontier count |
| Acceptable Use Policy | Abuse, automation, sharing | Enforcement path |
| Cookie notice | If non-essential cookies | Categories actually used |
| Subprocessors | Stripe, Supabase, Vercel, model providers | Final host list |
| AI disclosure | Generated text; memory extraction | Human review expectations |
| Retention & deletion | Export, account delete, backups | Soft-delete windows |
| BYOK responsibility | User keys; provider bills | Key storage disclosure |
| Outages | Best-effort; no personal SLA | Goodwill credits discretionary |
| Price-change notice | Advance notice before renewals | 30 days recommended |
| Consumer withdrawal | EU consumer rights | Consent when service begins |
| Business customer terms | VAT ID / reverse charge | Separate B2B checkbox |

## Stripe / tax / ops (accountant)

- [ ] Stripe Tax enabled; EUR prices tax behaviour confirmed
- [ ] Billing address + VAT ID collection verified in Checkout
- [ ] OSS / local VAT registrations as required
- [ ] Greek myDATA / e-invoicing path decided
- [ ] Invoice template, credit notes, refund records
- [ ] Dunning / Smart Retries configured
- [ ] Customer Portal limited to Lite ↔ Pro (no Team/Max)

## Price book verification (external)

Treat [`src/lib/inference/pricing.ts`](../src/lib/inference/pricing.ts) provider micros as placeholders until manually verified against current OpenRouter / OpenAI / Anthropic / Google / Groq list rates.

## Telemetry to collect before any future premium tier

Events land in `billing_telemetry_events`:

- `inference_turn` (plan, intensity, model, credits)
- `checkout_started`
- `subscription_period_granted`
- `payment_failed` / `inference_restricted`
- `charge_refunded`
- `subscription_canceled`

Review monthly: avg Pro COGS, p90/p99 usage, Frontier mix, context sizes, cooldown frequency, upgrade requests.

**Do not launch Max as “more Frontier.”** Future tiers should be qualitative (Private / Executive / Concierge / Team).
