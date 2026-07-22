import type { AdminOverviewStats } from "@/lib/admin/console";

function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border-b border-mist-100 pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <div className="grid gap-6 border-t border-mist-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

export function AdminOverviewPanels({ stats }: { stats: AdminOverviewStats }) {
  const planEntries = Object.entries(stats.plans.byPlanId).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className="space-y-10">
      <Section title="Users">
        <StatBlock label="Total" value={stats.users.total} />
        <StatBlock label="Staff+" value={stats.users.byRole.support + stats.users.byRole.admin + stats.users.byRole.super_admin} hint={`${stats.users.byRole.admin} admin · ${stats.users.byRole.super_admin} super`} />
        <StatBlock label="Support" value={stats.users.byRole.support} />
        <StatBlock label="Regular" value={stats.users.byRole.user} />
      </Section>

      <Section title="Plans">
        {planEntries.length === 0 ? (
          <StatBlock label="Subscriptions" value={0} hint="No rows yet" />
        ) : (
          planEntries.map(([planId, count]) => (
            <StatBlock key={planId} label={planId} value={count} />
          ))
        )}
        <StatBlock
          label="Demo grants"
          value={stats.plans.demoGrantsActive}
          hint="Active, not revenue"
        />
        <StatBlock
          label="Simulations"
          value={stats.plans.simulationsActive}
          hint="Active, not revenue"
        />
      </Section>

      <Section title="Usage">
        <StatBlock
          label="Auto turns"
          value={stats.usage.autoTurnsPeriod}
          hint="Current UTC month"
        />
        <StatBlock
          label="Frontier turns"
          value={stats.usage.frontierTurnsPeriod}
          hint="Current UTC month"
        />
        <StatBlock
          label="Inference events"
          value={stats.usage.usageEvents30d}
          hint="Last 30 days"
        />
      </Section>

      <Section title="Mock fallback">
        <StatBlock
          label="Mock events"
          value={stats.mockFallback.events30d}
          hint="provider=mock · 30d"
        />
        <StatBlock
          label="Share of usage"
          value={`${stats.mockFallback.shareOfUsagePct}%`}
          hint="Of inference events"
        />
      </Section>

      <Section title="Failures">
        <StatBlock
          label="Documents failed"
          value={stats.failures.documentsFailed}
        />
        <StatBlock
          label="Inference restricted"
          value={stats.failures.inferenceRestricted30d}
          hint="Telemetry · 30d"
        />
        <StatBlock
          label="Payment failed"
          value={stats.failures.paymentFailed30d}
          hint="Telemetry · 30d"
        />
      </Section>

      <p className="text-xs text-ink-faint">
        Generated {new Date(stats.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
