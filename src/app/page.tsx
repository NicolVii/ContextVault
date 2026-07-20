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
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FEATURES = [
  { icon: Brain, title: "One memory, every model", body: "Store your context once. Context Vault injects it into GPT, Claude, Gemini and more." },
  { icon: Eye, title: "Always know why", body: "Every answer shows exactly which memories were used. Ask “why does the AI know this?” anytime." },
  { icon: Layers, title: "You stay in control", body: "Extracted memories wait in a review queue. Nothing sensitive is ever saved automatically." },
  { icon: FileText, title: "Your documents, searchable", body: "Upload PDFs and notes. We chunk, embed and cite them with filename and page." },
  { icon: MessageSquare, title: "Multi-model chat", body: "Switch between models mid-conversation while keeping the same personal context." },
  { icon: ShieldCheck, title: "Private by design", body: "Row-level security, audit logs and one-click export or deletion. Your keys never touch the browser." },
];

export default async function LandingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="badge bg-brand-100 text-brand-700">
            Model-independent AI memory
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-brand-900 sm:text-6xl">
            Save your context once.
            <br />
            <span className="text-brand-600">Use it with every AI.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-700">
            Stop re-explaining yourself to every chatbot. Context Vault is your
            personal memory layer — portable across models, private by default,
            and always under your control.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={user ? "/dashboard" : "/signup"} className="btn-primary px-6 py-3 text-base">
              {user ? "Open dashboard" : "Create your vault"}
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
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-brand-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-700">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-brand-100 py-8">
        <div className="mx-auto max-w-6xl px-6 text-sm text-brand-600">
          Context Vault · Your context, portable and private.
        </div>
      </footer>
    </div>
  );
}
