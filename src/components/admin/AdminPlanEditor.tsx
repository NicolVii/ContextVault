"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  AdminPlanDetail,
  PlanCampaignSummary,
  PlanEntitlementInput,
  PlanProductInput,
  PlanVersionSummary,
} from "@/lib/billing/plan-editor";
import type { ModelFamilyId } from "@/lib/billing/plan-defaults";

function formatBytes(n: number): string {
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-mist-200 pt-6">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-mist-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

function nullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function productFromDetail(detail: AdminPlanDetail): PlanProductInput {
  return {
    label: detail.product.label,
    purpose: detail.product.purpose,
    amountEurCentsMonthly: detail.product.amountEurCentsMonthly,
    amountEurCentsAnnual: detail.product.amountEurCentsAnnual,
    foundingEurCentsMonthly: detail.product.foundingEurCentsMonthly,
    stripePriceEnvMonthly: detail.product.stripePriceEnvMonthly,
    stripePriceEnvAnnual: detail.product.stripePriceEnvAnnual,
    features: [...detail.product.features],
    public: detail.product.public,
  };
}

function entitlementsFromVersion(
  version: PlanVersionSummary | null,
  detail: AdminPlanDetail
): PlanEntitlementInput {
  const e = version?.entitlements ?? detail.activeVersion?.entitlements;
  if (!e) {
    return {
      autoMonthlyTurns: 0,
      unlimitedAuto: false,
      autoFairUseDailyCredits: 0,
      autoFairUsePeriodCredits: 0,
      frontierMonthlyTurns: 0,
      maxFrontierCreditsPerTurn: 0,
      frontierSoftCreditCap: null,
      frontierHeavyRatio: 0.8,
      attachments: false,
      storageBytes: 0,
      byok: false,
      voice: false,
      elevatedLimits: false,
      modelFamilies: [],
    };
  }
  return {
    autoMonthlyTurns: e.autoMonthlyTurns,
    unlimitedAuto: e.unlimitedAuto,
    autoFairUseDailyCredits: e.autoFairUseDailyCredits,
    autoFairUsePeriodCredits: e.autoFairUsePeriodCredits,
    frontierMonthlyTurns: e.frontierMonthlyTurns,
    maxFrontierCreditsPerTurn: e.maxFrontierCreditsPerTurn,
    frontierSoftCreditCap: e.frontierSoftCreditCap,
    frontierHeavyRatio: e.frontierHeavyRatio,
    attachments: e.attachments,
    storageBytes: e.storageBytes,
    byok: e.byok,
    voice: e.voice,
    elevatedLimits: e.elevatedLimits,
    modelFamilies: [...e.modelFamilies],
  };
}

type ActionResult = { ok?: boolean; error?: string };

async function postPlan(
  planId: string,
  body: Record<string, unknown>
): Promise<ActionResult> {
  const res = await fetch(`/api/admin/plans/${planId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ActionResult;
  if (!res.ok) return { error: json.error ?? `HTTP ${res.status}` };
  return json;
}

async function postCampaign(
  body: Record<string, unknown>
): Promise<ActionResult> {
  const res = await fetch("/api/admin/plans/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ActionResult;
  if (!res.ok) return { error: json.error ?? `HTTP ${res.status}` };
  return json;
}

export function AdminPlanEditor({
  detail,
  canMutate,
}: {
  detail: AdminPlanDetail;
  canMutate: boolean;
}) {
  const router = useRouter();
  const [product, setProduct] = useState(() => productFromDetail(detail));
  const [ents, setEnts] = useState(() =>
    entitlementsFromVersion(detail.activeVersion, detail)
  );
  const [featuresText, setFeaturesText] = useState(
    () => product.features.join("\n")
  );
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [campaignReason, setCampaignReason] = useState("");
  const [campaignStarts, setCampaignStarts] = useState("");
  const [campaignEnds, setCampaignEnds] = useState("");
  const [campaignFrontierTurns, setCampaignFrontierTurns] = useState("25");

  const families = detail.modelFamilyOptions;

  const retiredVersions = useMemo(
    () => detail.versions.filter((v) => v.status !== "active"),
    [detail.versions]
  );

  function syncUnlimited(autoMonthlyTurns: number | null) {
    setEnts((prev) => ({
      ...prev,
      autoMonthlyTurns,
      unlimitedAuto: autoMonthlyTurns == null,
    }));
  }

  function toggleFamily(family: ModelFamilyId) {
    setEnts((prev) => {
      const has = prev.modelFamilies.includes(family);
      return {
        ...prev,
        modelFamilies: has
          ? prev.modelFamilies.filter((f) => f !== family)
          : [...prev.modelFamilies, family],
      };
    });
  }

  async function publish() {
    if (!canMutate) return;
    setBusy(true);
    setMessage(null);
    const nextProduct: PlanProductInput = {
      ...product,
      features: featuresText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };
    const result = await postPlan(detail.planId, {
      action: "publish",
      reason,
      product: nextProduct,
      entitlements: ents,
    });
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setReason("");
    setMessage("Published new plan version.");
    router.refresh();
  }

  async function rollback(version: PlanVersionSummary) {
    if (!canMutate) return;
    const rollbackReason = window.prompt(
      `Reason for rolling back to v${version.version}:`,
      ""
    );
    if (rollbackReason == null) return;
    setBusy(true);
    setMessage(null);
    const result = await postPlan(detail.planId, {
      action: "rollback",
      reason: rollbackReason,
      toVersionId: version.id,
    });
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Rolled back to configuration from v${version.version}.`);
    router.refresh();
  }

  async function createCampaign() {
    if (!canMutate) return;
    setBusy(true);
    setMessage(null);
    const startsAt = campaignStarts
      ? new Date(campaignStarts).toISOString()
      : new Date().toISOString();
    const endsAt = campaignEnds
      ? new Date(campaignEnds).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const frontier = nullableNumber(campaignFrontierTurns);
    const result = await postCampaign({
      action: "create",
      planId: detail.planId,
      name: campaignName,
      reason: campaignReason,
      startsAt,
      endsAt,
      entitlementOverrides: {
        frontierMonthlyTurns: frontier,
      },
    });
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setCampaignName("");
    setCampaignReason("");
    setMessage("Campaign created.");
    router.refresh();
  }

  async function revokeCampaign(campaign: PlanCampaignSummary) {
    if (!canMutate) return;
    const revokeReason = window.prompt("Reason for revoking campaign:", "");
    if (revokeReason == null) return;
    setBusy(true);
    setMessage(null);
    const result = await postCampaign({
      action: "revoke",
      id: campaign.id,
      reason: revokeReason,
    });
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Campaign revoked.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p className="font-mono text-xs text-ink-muted" role="status">
          {message}
        </p>
      ) : null}

      <Section title="Pricing & visibility">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label">
            <input
              className={inputClass}
              value={product.label}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setProduct((p) => ({ ...p, label: e.target.value }))
              }
            />
          </Field>
          <Field label="Purpose">
            <input
              className={inputClass}
              value={product.purpose}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setProduct((p) => ({ ...p, purpose: e.target.value }))
              }
            />
          </Field>
          <Field label="Monthly price (EUR cents)">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={product.amountEurCentsMonthly}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setProduct((p) => ({
                  ...p,
                  amountEurCentsMonthly: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Annual price (EUR cents, blank = none)">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={product.amountEurCentsAnnual ?? ""}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setProduct((p) => ({
                  ...p,
                  amountEurCentsAnnual:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Founding monthly (EUR cents, blank = none)">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={product.foundingEurCentsMonthly ?? ""}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setProduct((p) => ({
                  ...p,
                  foundingEurCentsMonthly:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Public storefront">
            <select
              className={inputClass}
              value={product.public ? "true" : "false"}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setProduct((p) => ({
                  ...p,
                  public: e.target.value === "true",
                }))
              }
            >
              <option value="true">Public</option>
              <option value="false">Hidden</option>
            </select>
          </Field>
          <Field label="Feature bullets (one per line)">
            <textarea
              className={`${inputClass} min-h-[6rem] font-mono text-xs`}
              value={featuresText}
              disabled={!canMutate || busy}
              onChange={(e) => setFeaturesText(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Auto limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly Auto turns (blank = unlimited)">
            <input
              className={inputClass}
              value={ents.autoMonthlyTurns ?? ""}
              disabled={!canMutate || busy}
              onChange={(e) => syncUnlimited(nullableNumber(e.target.value))}
            />
          </Field>
          <Field label="Unlimited Auto (derived)">
            <input
              className={inputClass}
              value={ents.unlimitedAuto ? "true" : "false"}
              disabled
              readOnly
            />
          </Field>
        </div>
      </Section>

      <Section title="Fair-use limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daily Auto fair-use credits">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={ents.autoFairUseDailyCredits}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  autoFairUseDailyCredits: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Period Auto fair-use credits">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={ents.autoFairUsePeriodCredits}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  autoFairUsePeriodCredits: Number(e.target.value),
                }))
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Frontier limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly Frontier turns (blank = soft-cap / uncapped)">
            <input
              className={inputClass}
              value={ents.frontierMonthlyTurns ?? ""}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  frontierMonthlyTurns: nullableNumber(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Max Frontier credits / turn">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={ents.maxFrontierCreditsPerTurn}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  maxFrontierCreditsPerTurn: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Frontier soft credit cap (blank = none)">
            <input
              className={inputClass}
              value={ents.frontierSoftCreditCap ?? ""}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  frontierSoftCreditCap: nullableNumber(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Frontier heavy ratio (0–1)">
            <input
              className={inputClass}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={ents.frontierHeavyRatio}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  frontierHeavyRatio: Number(e.target.value),
                }))
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Storage, attachments, voice, BYOK, elevated">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Storage bytes (${formatBytes(ents.storageBytes)})`}>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={ents.storageBytes}
              disabled={!canMutate || busy}
              onChange={(e) =>
                setEnts((prev) => ({
                  ...prev,
                  storageBytes: Number(e.target.value),
                }))
              }
            />
          </Field>
          {(
            [
              ["attachments", "Attachments"],
              ["byok", "BYOK"],
              ["voice", "Voice"],
              ["elevatedLimits", "Elevated limits"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <select
                className={inputClass}
                value={ents[key] ? "true" : "false"}
                disabled={!canMutate || busy}
                onChange={(e) =>
                  setEnts((prev) => ({
                    ...prev,
                    [key]: e.target.value === "true",
                  }))
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Model-family access">
        <p className="text-sm text-ink-muted">
          Frontier families this plan may use. Empty means no frontier family
          access.
        </p>
        <div className="flex flex-wrap gap-3">
          {families.map((family) => {
            const checked = ents.modelFamilies.includes(family);
            return (
              <label
                key={family}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canMutate || busy}
                  onChange={() => toggleFamily(family)}
                />
                <span className="font-mono">{family}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="Publish">
        <Field label="Change reason (required)">
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={reason}
            disabled={!canMutate || busy}
            placeholder="Why is this configuration changing?"
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className="btn-secondary"
          disabled={!canMutate || busy || reason.trim().length < 3}
          onClick={() => void publish()}
        >
          Publish new version
        </button>
      </Section>

      <Section title="Version history & rollback">
        <ul className="divide-y divide-mist-200 border-y border-mist-200 text-sm">
          {detail.versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  v{v.version}{" "}
                  <span className="font-mono text-xs text-ink-faint">
                    {v.status}
                  </span>
                </p>
                <p className="text-xs text-ink-muted">
                  {formatDate(v.effectiveFrom)}
                  {v.changeReason ? ` · ${v.changeReason}` : ""}
                </p>
              </div>
              {v.status !== "active" && canMutate ? (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={busy}
                  onClick={() => void rollback(v)}
                >
                  Rollback
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {retiredVersions.length === 0 ? (
          <p className="text-sm text-ink-faint">No prior versions yet.</p>
        ) : null}
      </Section>

      <Section title="Campaign overrides">
        <p className="text-sm text-ink-muted">
          Temporary entitlement changes with start and end dates. Example:
          raise Lite Frontier turns from 10 to 25 for one month without
          permanently changing the plan.
        </p>

        <ul className="divide-y divide-mist-200 border-y border-mist-200 text-sm">
          {detail.campaigns.length === 0 ? (
            <li className="py-3 text-ink-faint">No campaigns.</li>
          ) : (
            detail.campaigns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">
                    {c.name}{" "}
                    <span className="font-mono text-xs text-ink-faint">
                      {c.revokedAt
                        ? "revoked"
                        : c.active
                          ? "active"
                          : "scheduled/expired"}
                    </span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDate(c.startsAt)} → {formatDate(c.endsAt)}
                  </p>
                  <p className="font-mono text-xs text-ink-faint">
                    {JSON.stringify(c.entitlementOverrides)}
                  </p>
                  <p className="text-xs text-ink-muted">{c.reason}</p>
                </div>
                {!c.revokedAt && canMutate ? (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    disabled={busy}
                    onClick={() => void revokeCampaign(c)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>

        {canMutate ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name">
              <input
                className={inputClass}
                value={campaignName}
                disabled={busy}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Lite Frontier boost — Aug"
              />
            </Field>
            <Field label="Frontier monthly turns override">
              <input
                className={inputClass}
                value={campaignFrontierTurns}
                disabled={busy}
                onChange={(e) => setCampaignFrontierTurns(e.target.value)}
              />
            </Field>
            <Field label="Starts at (local)">
              <input
                className={inputClass}
                type="datetime-local"
                value={campaignStarts}
                disabled={busy}
                onChange={(e) => setCampaignStarts(e.target.value)}
              />
            </Field>
            <Field label="Ends at (local, default +30d)">
              <input
                className={inputClass}
                type="datetime-local"
                value={campaignEnds}
                disabled={busy}
                onChange={(e) => setCampaignEnds(e.target.value)}
              />
            </Field>
            <Field label="Reason (required)">
              <textarea
                className={`${inputClass} min-h-[4rem]`}
                value={campaignReason}
                disabled={busy}
                onChange={(e) => setCampaignReason(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  busy ||
                  campaignName.trim().length < 1 ||
                  campaignReason.trim().length < 3
                }
                onClick={() => void createCampaign()}
              >
                Create campaign
              </button>
            </div>
          </div>
        ) : null}
      </Section>
    </div>
  );
}
