/**
 * Placeholder legal surfaces — not final counsel-approved documents.
 * Linked from Checkout consent and Plan & Usage details.
 */

import Link from "next/link";

const PAGES = [
  { href: "/legal/terms", title: "Terms of Service" },
  { href: "/legal/privacy", title: "Privacy Policy" },
  { href: "/legal/billing", title: "Subscription & Billing Terms" },
  { href: "/legal/aup", title: "Acceptable Use Policy" },
];

export default function LegalIndexPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-2xl text-ink">Legal</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Draft placeholders pending lawyer review. Do not treat as final.
      </p>
      <ul className="mt-8 space-y-3">
        {PAGES.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="text-sm font-medium text-ink underline">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-xs text-ink-faint">
        Internal checklist: <code>docs/legal-readiness-checklist.md</code>
      </p>
    </main>
  );
}
