import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { DangerZone } from "@/components/DangerZone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: audit } = await supabase
    .from("audit_log")
    .select("action, created_at, entity_type")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-900">Privacy &amp; data</h1>
      <p className="text-sm text-brand-600">
        You control what is stored and can export or delete it at any time.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-100 bg-white p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-600" />
        <p className="text-sm text-brand-700">
          Your data is protected with row-level security so no one else can read it. Provider API
          keys are stored only on the server and never sent to your browser.
        </p>
      </div>

      <div className="mt-6">
        <DangerZone />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold text-brand-900">Recent activity</h2>
        <p className="mt-1 text-sm text-brand-600">
          A log of security-relevant actions on your account.
        </p>
        <ul className="mt-4 divide-y divide-brand-50 text-sm">
          {(audit ?? []).length === 0 ? (
            <li className="py-2 text-brand-500">No activity yet.</li>
          ) : (
            (audit ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span className="font-mono text-brand-800">{a.action}</span>
                <span className="text-brand-500">{formatDate(a.created_at)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
