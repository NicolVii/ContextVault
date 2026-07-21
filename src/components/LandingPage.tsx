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

/** Temporary public marketing page — full redesign lands in Stage 3. */
export function LandingPage() {
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

      <footer className="border-t border-mist-200 py-8">
        <div className="mx-auto max-w-6xl px-6 text-sm text-ink-muted">
          {BRAND.name} · {BRAND.tagline}
        </div>
      </footer>
    </div>
  );
}
