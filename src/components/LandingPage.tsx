import Link from "next/link";
import {
  Brain,
  ShieldCheck,
  Layers,
  FileText,
  MessageSquare,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import {
  formatEurCents,
  getPublicPlans,
  type SubscriptionPlan,
} from "@/lib/billing/products";

const FEATURES = [
  {
    icon: Brain,
    title: "One memory, every model",
    body: `Store your context once. ${BRAND.name} injects it into GPT, Claude, Gemini and more.`,
  },
  {
    icon: Eye,
    title: "Always know why",
    body: "Every answer can show which memories were used. Stay in control of what informs a reply.",
  },
  {
    icon: Layers,
    title: "You stay in control",
    body: "Suggested memories wait in a review queue. Nothing sensitive is ever saved automatically.",
  },
  {
    icon: FileText,
    title: "Your documents, searchable",
    body: "Upload PDFs and notes. They ground answers with filename and page.",
  },
  {
    icon: MessageSquare,
    title: "Ask or capture",
    body: "Think out loud — statements are remembered, questions are answered.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Row-level security, audit logs and one-click export or deletion.",
  },
];

function priceLabel(plan: SubscriptionPlan): string {
  if (plan.amountEurCentsMonthly === 0) return "€0";
  return `${formatEurCents(plan.amountEurCentsMonthly)} / month`;
}

function signupHref(plan: SubscriptionPlan): string {
  if (plan.id === "free") return "/signup";
  return `/signup?plan=${plan.id}`;
}

/** Temporary public marketing page — full redesign lands in Stage 3. */
export function LandingPage() {
  const plans = getPublicPlans();

  return (
    <div className="bg-atmosphere min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="badge bg-accent-soft text-accent">Personal memory</span>
          <h1 className="font-display mt-5 text-4xl font-medium tracking-tight text-ink sm:text-6xl">
            {BRAND.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-muted">
            Stop re-explaining yourself. {BRAND.name} is your calm second brain — portable,
            private, and always under your control.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              I already have an account
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-mist-200 bg-white/50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-ink">
              Pricing
            </h2>
            <p className="mt-3 text-ink-muted">
              One memory. Every leading model. Start free — upgrade when you need more.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-2xl border border-mist-200 bg-white p-6 shadow-soft"
              >
                <p className="text-sm font-semibold text-ink">{plan.label}</p>
                <p className="mt-1 text-xs text-ink-muted">{plan.purpose}</p>
                <p className="mt-4 font-display text-3xl font-medium text-ink">
                  {priceLabel(plan)}
                </p>
                {plan.amountEurCentsAnnual ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    or {formatEurCents(plan.amountEurCentsAnnual)} / year
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-faint">Keep your memory alive</p>
                )}
                {plan.id === "pro" && plan.foundingEurCentsMonthly && (
                  <p className="mt-2 text-xs text-accent">
                    Founding offer {formatEurCents(plan.foundingEurCentsMonthly)} / month
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-ink-muted">
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={signupHref(plan)}
                  className={
                    plan.id === "pro"
                      ? "btn-primary mt-6 justify-center text-sm"
                      : "btn-secondary mt-6 justify-center text-sm"
                  }
                >
                  {plan.id === "free" ? "Start free" : `Choose ${plan.label}`}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-mist-200 py-8">
        <div className="mx-auto max-w-6xl px-6 text-sm text-ink-muted">
          {BRAND.name} · {BRAND.tagline}
        </div>
      </footer>
    </div>
  );
}
