import { redirect } from "next/navigation";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { DangerZone } from "@/components/DangerZone";
import { ProfileFields } from "@/components/ProfileFields";
import { AdvancedModelSettings } from "@/components/AdvancedModelSettings";
import { BillingPanel } from "@/components/BillingPanel";
import { ByokPanel } from "@/components/ByokPanel";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/profile";
import { ensureCreditAccount, getCreditBalance } from "@/lib/inference/credits";
import { isStripeConfigured } from "@/lib/billing/products";
import { isDevTopupAllowed } from "@/lib/billing/dev-topup";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default async function VaultSettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await ensureUserProfile(supabase, user);
  if (!profile) redirect("/onboarding");

  await ensureCreditAccount(user.id);
  const balance = await getCreditBalance(user.id);
  const admin = createSupabaseAdminClient();

  const [
    { data: audit },
    { data: sub },
    { data: recent },
    { data: keys },
    { data: workspaces },
  ] = await Promise.all([
    supabase
      .from("audit_log")
      .select("action, created_at, entity_type")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("usage_events")
      .select("request_id, purpose, model_id, credits_charged, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("user_provider_keys")
      .select("provider, label, created_at")
      .eq("user_id", user.id),
    supabase
      .from("workspaces")
      .select("id, name, default_model, monthly_credit_budget")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-10">
      <section>
        <h2 className="text-sm font-semibold text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ink-muted">How you appear to your cortex.</p>
        <div className="mt-4">
          <ProfileFields profile={profile as Profile} email={user.email ?? ""} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Billing</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Credits power inference. You buy from Cortaix — providers stay behind the scenes.
        </p>
        <div className="mt-4">
          <BillingPanel
            balance={balance}
            planId={(sub?.plan_id as string) ?? "free"}
            planStatus={(sub?.status as string) ?? null}
            stripeConfigured={isStripeConfigured()}
            allowDevTopup={isDevTopupAllowed()}
            recent={recent ?? []}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Privacy &amp; data</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Export or delete what you’ve stored. You stay in control.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-mist-200 bg-mist-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-accent" />
          <p className="text-sm text-ink-muted">
            Your data is protected with row-level security. Provider keys stay on the server.
          </p>
        </div>
        <div className="mt-4">
          <DangerZone />
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-medium text-ink">Recent activity</h3>
          <ul className="mt-3 divide-y divide-mist-100 text-sm">
            {(audit ?? []).length === 0 ? (
              <li className="py-2 text-ink-faint">No activity yet.</li>
            ) : (
              (audit ?? []).map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-ink">{a.action}</span>
                  <span className="text-xs text-ink-faint">{formatDate(a.created_at)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section>
        <details className="group rounded-2xl border border-mist-200 open:bg-mist-50">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
            Advanced
            <ChevronDown className="h-4 w-4 text-ink-faint transition group-open:rotate-180" />
          </summary>
          <div className="space-y-8 border-t border-mist-200 px-4 py-4">
            <div>
              <p className="mb-4 text-xs text-ink-muted">
                Default model used when the Thinking composer is set to Auto.
                Everyday Auto / preset / model switching stays in the Thinking +
                menu — this only sets the account default.
              </p>
              <AdvancedModelSettings defaultModel={(profile as Profile).default_model} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink">Bring your own key</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Optional provider credentials (configuration). Model selection
                still happens in Thinking. Inference on your key is not debited
                from Cortaix credits.
              </p>
              <div className="mt-3">
                <ByokPanel initialKeys={keys ?? []} />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink">Workspaces</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Project defaults and optional monthly credit budgets.
              </p>
              <div className="mt-3">
                <WorkspacePanel initial={workspaces ?? []} />
              </div>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
