"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  BonusEffect,
  PriceEffect,
  PromotionRecord,
  PromotionRedemption,
} from "@/lib/billing";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function describePrice(effect: PriceEffect | null): string {
  if (!effect) return "—";
  switch (effect.type) {
    case "percentage":
      return `${effect.percentOff}% off (${effect.duration})`;
    case "fixed":
      return `€${(effect.amountOffEurCents / 100).toFixed(2)} off (${effect.duration})`;
    case "trial":
      return `${effect.trialDays}-day trial`;
    case "limited_periods":
      return `${effect.percentOff}% off × ${effect.billingPeriods} periods`;
    default:
      return "—";
  }
}

function describeBonus(effect: BonusEffect | null): string {
  if (!effect) return "—";
  const parts: string[] = [];
  if (effect.autoTurnBonus) parts.push(`+${effect.autoTurnBonus} Auto`);
  if (effect.frontierTurnBonus)
    parts.push(`+${effect.frontierTurnBonus} Frontier`);
  if (effect.creditBonus) parts.push(`+${effect.creditBonus} credits`);
  if (effect.storageBytesBonus)
    parts.push(`+${effect.storageBytesBonus} storage bytes`);
  if (effect.featureAccess && Object.keys(effect.featureAccess).length) {
    parts.push(
      `features: ${Object.entries(effect.featureAccess)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ")}`
    );
  }
  return parts.length ? parts.join(" · ") : "—";
}

const inputClass =
  "w-full rounded-lg border border-mist-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

type Props = {
  promotions: PromotionRecord[];
  canEdit: boolean;
};

export function AdminPromotionsPanel({ promotions, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    promotions[0]?.id ?? null
  );
  const [detailRedemptions, setDetailRedemptions] = useState<
    PromotionRedemption[]
  >([]);
  const [showCreate, setShowCreate] = useState(false);

  const selected = useMemo(
    () => promotions.find((p) => p.id === selectedId) ?? null,
    [promotions, selectedId]
  );

  async function runLifecycle(
    action: "activate" | "pause" | "resume" | "end" | "archive",
    id: string
  ) {
    if (!canEdit) return;
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      setMessage(`${action} succeeded`);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setDetailRedemptions(json.redemptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            Price discounts and entitlement bonuses are separate effects.
            Demo mode simulates Stripe mappings internally; live mode may create
            coupons for price discounts only.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Hide create form" : "Create promotion"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}

      {showCreate && canEdit ? (
        <CreatePromotionForm
          onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}

      <ul className="divide-y divide-mist-200 border-y border-mist-200">
        {promotions.length === 0 ? (
          <li className="py-6 text-sm text-ink-muted">No promotions yet.</li>
        ) : (
          promotions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full flex-wrap items-baseline justify-between gap-2 py-4 text-left transition-colors hover:bg-mist-50/60"
                onClick={() => void loadDetail(p.id)}
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-display text-xl text-ink">{p.name}</p>
                  <p className="font-mono text-xs text-ink-faint">
                    {p.slug}
                    {p.code ? ` · ${p.code}` : " · automatic"}
                  </p>
                </div>
                <div className="text-right text-sm text-ink-muted">
                  <p className="capitalize">{p.status}</p>
                  <p>
                    {p.redemptionCount}
                    {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ""}{" "}
                    redemptions
                  </p>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>

      {selected ? (
        <section className="space-y-4 border-t border-mist-200 pt-6">
          <header className="space-y-1">
            <h2 className="text-lg font-medium text-ink">{selected.name}</h2>
            <p className="text-sm text-ink-muted">
              {selected.description || "No description"}
            </p>
            <p className="font-mono text-xs text-ink-faint">{selected.id}</p>
          </header>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-faint">Distribution</dt>
              <dd>{selected.distribution}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Audience</dt>
              <dd>{selected.audience}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Window</dt>
              <dd>
                {formatDate(selected.startsAt)} → {formatDate(selected.endsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Eligible plans</dt>
              <dd>
                {selected.eligiblePlans.length
                  ? selected.eligiblePlans.join(", ")
                  : "all"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Price discount</dt>
              <dd>{describePrice(selected.priceEffect)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Usage bonus</dt>
              <dd>{describeBonus(selected.bonusEffect)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Stripe (live)</dt>
              <dd className="font-mono text-xs">
                {selected.stripeCouponId ?? "—"}
                {selected.stripePromotionCodeId
                  ? ` / ${selected.stripePromotionCodeId}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Demo simulation</dt>
              <dd className="font-mono text-xs">
                {selected.demoStripeSimulation
                  ? selected.demoStripeSimulation.couponId
                  : "—"}
              </dd>
            </div>
          </dl>

          {canEdit ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-ink-faint">
                  Reason (required for mutations)
                </span>
                <input
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you changing this promotion?"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {selected.status === "draft" ? (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={busy}
                    onClick={() => void runLifecycle("activate", selected.id)}
                  >
                    Activate
                  </button>
                ) : null}
                {selected.status === "active" ? (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={busy}
                    onClick={() => void runLifecycle("pause", selected.id)}
                  >
                    Pause
                  </button>
                ) : null}
                {selected.status === "paused" ? (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={busy}
                    onClick={() => void runLifecycle("resume", selected.id)}
                  >
                    Resume
                  </button>
                ) : null}
                {selected.status === "active" || selected.status === "paused" ? (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    disabled={busy}
                    onClick={() => void runLifecycle("end", selected.id)}
                  >
                    End
                  </button>
                ) : null}
                {selected.status !== "archived" ? (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    disabled={busy}
                    onClick={() => void runLifecycle("archive", selected.id)}
                  >
                    Archive
                  </button>
                ) : null}
                <Link
                  href={`/admin/audit?q=${encodeURIComponent(selected.id)}`}
                  className="btn-ghost text-sm"
                >
                  View audit
                </Link>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-ink">Recent redemptions</h3>
            {detailRedemptions.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Select a promotion to load redemptions, or none yet.
              </p>
            ) : (
              <ul className="divide-y divide-mist-100 text-sm">
                {detailRedemptions.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap justify-between gap-2 py-2"
                  >
                    <span className="font-mono text-xs">{r.userId}</span>
                    <span className="text-ink-muted">
                      {r.status} · {r.source} · {formatDate(r.redeemedAt)}
                      {r.demoSimulated ? " · demo" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CreatePromotionForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [distribution, setDistribution] = useState<"public_code" | "automatic">(
    "public_code"
  );
  const [code, setCode] = useState("");
  const [audience, setAudience] = useState<"all" | "new_users" | "existing_users">(
    "all"
  );
  const [reason, setReason] = useState("");
  const [activate, setActivate] = useState(true);
  const [effectKind, setEffectKind] = useState<"price" | "bonus" | "both">(
    "bonus"
  );
  const [percentOff, setPercentOff] = useState("20");
  const [autoTurns, setAutoTurns] = useState("0");
  const [frontierTurns, setFrontierTurns] = useState("10");
  const [credits, setCredits] = useState("0");
  const [storageBonus, setStorageBonus] = useState("0");
  const [durationDays, setDurationDays] = useState("30");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perUser, setPerUser] = useState("1");
  const [eligible, setEligible] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const startsAt = new Date().toISOString();
      const endsAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const priceEffect =
        effectKind === "price" || effectKind === "both"
          ? {
              type: "percentage" as const,
              percentOff: Number(percentOff),
              duration: "once" as const,
            }
          : null;

      const bonusEffect =
        effectKind === "bonus" || effectKind === "both"
          ? {
              autoTurnBonus: Number(autoTurns) || 0,
              frontierTurnBonus: Number(frontierTurns) || 0,
              creditBonus: Number(credits) || 0,
              storageBytesBonus: Number(storageBonus) || 0,
              durationDays: Number(durationDays) || null,
            }
          : null;

      const body = {
        slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, "-"),
        name: name.trim(),
        description: null,
        distribution,
        code: distribution === "public_code" ? code.trim().toUpperCase() : null,
        startsAt,
        endsAt,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        maxRedemptionsPerUser: Number(perUser) || 1,
        eligiblePlans: eligible,
        audience,
        priceEffect,
        bonusEffect,
        reason: reason.trim(),
        activate,
      };

      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function togglePlan(plan: string) {
    setEligible((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan]
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-4 border-y border-mist-200 py-6"
    >
      <h2 className="text-lg font-medium text-ink">New promotion</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Name</span>
          <input
            className={inputClass}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Slug</span>
          <input
            className={inputClass}
            placeholder="summer-frontier-boost"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Distribution</span>
          <select
            className={inputClass}
            value={distribution}
            onChange={(e) =>
              setDistribution(e.target.value as "public_code" | "automatic")
            }
          >
            <option value="public_code">Public code</option>
            <option value="automatic">Automatic campaign</option>
          </select>
        </label>
        {distribution === "public_code" ? (
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">Code</span>
            <input
              className={inputClass}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SUMMER20"
            />
          </label>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Audience</span>
          <select
            className={inputClass}
            value={audience}
            onChange={(e) =>
              setAudience(
                e.target.value as "all" | "new_users" | "existing_users"
              )
            }
          >
            <option value="all">All users</option>
            <option value="new_users">New users</option>
            <option value="existing_users">Existing users</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Effects</span>
          <select
            className={inputClass}
            value={effectKind}
            onChange={(e) =>
              setEffectKind(e.target.value as "price" | "bonus" | "both")
            }
          >
            <option value="bonus">Usage bonus only</option>
            <option value="price">Price discount only</option>
            <option value="both">Both</option>
          </select>
        </label>
      </div>

      {(effectKind === "price" || effectKind === "both") && (
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Percent off</span>
          <input
            className={inputClass}
            type="number"
            min={1}
            max={100}
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value)}
          />
        </label>
      )}

      {(effectKind === "bonus" || effectKind === "both") && (
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">Extra Auto turns</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={autoTurns}
              onChange={(e) => setAutoTurns(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">Extra Frontier turns</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={frontierTurns}
              onChange={(e) => setFrontierTurns(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">Extra credits</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">Extra storage (bytes)</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={storageBonus}
              onChange={(e) => setStorageBonus(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">Bonus duration (days)</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Max redemptions (global)</span>
          <input
            className={inputClass}
            type="number"
            min={1}
            placeholder="unlimited"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-ink-faint">Per-user limit</span>
          <input
            className={inputClass}
            type="number"
            min={1}
            value={perUser}
            onChange={(e) => setPerUser(e.target.value)}
          />
        </label>
        <fieldset className="space-y-1 text-sm">
          <legend className="text-xs text-ink-faint">Eligible plans</legend>
          <div className="flex flex-wrap gap-3 pt-1">
            {(["free", "lite", "pro"] as const).map((plan) => (
              <label key={plan} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={eligible.includes(plan)}
                  onChange={() => togglePlan(plan)}
                />
                {plan}
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-faint">Leave empty for all plans.</p>
        </fieldset>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-xs text-ink-faint">Reason</span>
        <input
          className={inputClass}
          required
          minLength={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Launch summer campaign"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={activate}
          onChange={(e) => setActivate(e.target.checked)}
        />
        Activate immediately
      </label>

      <button type="submit" className="btn-secondary text-sm" disabled={busy}>
        {busy ? "Creating…" : "Create promotion"}
      </button>
    </form>
  );
}
