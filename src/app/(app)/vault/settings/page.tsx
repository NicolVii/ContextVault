import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ChevronDown, ChevronRight } from "lucide-react";
import { DangerZone } from "@/components/DangerZone";
import { ProfileFields } from "@/components/ProfileFields";
import { AdvancedModelSettings } from "@/components/AdvancedModelSettings";
import { ByokPanel } from "@/components/ByokPanel";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getCachedUser, getSessionContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/profile";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default async function VaultSettingsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const profile = await ensureUserProfile(ctx.supabase, user);
  if (!profile) redirect("/onboarding");

  const admin = createSupabaseAdminClient();
  const snap = await getPlanUsageSnapshot(user.id);

  const [{ data: audit }, { data: keys }, { data: workspaces }] = await Promise.all([
    ctx.supabase
      .from("audit_log")
      .select("action, created_at, entity_type")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("user_provider_keys")
      .select("provider, label, created_at")
      .eq("user_id", user.id),
    ctx.supabase
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
        <Link
          href="/vault/plan"
          className="flex items-center gap-3 rounded-2xl border border-mist-200 px-4 py-4 transition-colors hover:bg-mist-50"
        >
          <div className="flex-1">
            <span className="text-sm font-medium text-ink">Plan &amp; Usage</span>
            <p className="mt-0.5 text-xs text-ink-faint">
              Current plan, usage, and billing management
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-faint" />
        </Link>
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
              {snap.entitlements.byok ? (
                <>
                  <p className="mt-1 text-xs text-ink-muted">
                    Optional provider credentials. Inference on your key is not debited from
                    Cortaix usage.
                  </p>
                  <div className="mt-3">
                    <ByokPanel initialKeys={keys ?? []} />
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">
                  BYOK is included with Pro.{" "}
                  <Link href="/vault/plan" className="underline">
                    View plans
                  </Link>
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink">Workspaces</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Personal project labels and optional monthly budgets. Shared team workspaces are
                not part of the launch plans.
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
