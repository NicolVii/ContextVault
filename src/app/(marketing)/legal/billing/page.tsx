export default function LegalBillingPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-sm text-ink-muted">
      <h1 className="font-display text-2xl text-ink">Subscription &amp; Billing Terms</h1>
      <p>
        Placeholder. Final terms require legal review before live payments.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Plans: Free, Lite (€5/mo), Pro (€28/mo). No Max or Team at launch.</li>
        <li>Access continues until the end of the paid period after cancellation.</li>
        <li>Auto is unlimited on Lite/Pro under published fair use.</li>
        <li>Lite includes a limited Frontier conversation count each period.</li>
        <li>Pro includes generous Frontier access without message counters; soft limits may apply.</li>
        <li>Failed payments: grace period, then AI usage may pause while the vault remains available.</li>
        <li>BYOK is Pro-only; provider charges are the customer’s responsibility.</li>
      </ul>
    </main>
  );
}
