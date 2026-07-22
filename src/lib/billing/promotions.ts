import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { grantCredits } from "@/lib/inference/credits";
import { resolveCommercialMode } from "./commercial";
import { recordBillingTelemetry } from "./telemetry";
import { syncPromotionPriceToStripe } from "./promotions-stripe";
import {
  isPromotionWindowOpen,
  normalizePromotionCode,
  parseBonusEffect,
  parsePriceEffect,
  promotionInputSchema,
  requirePromotionReason,
  type BonusEffect,
  type DemoStripeSimulation,
  type PriceEffect,
  type PromotionAudience,
  type PromotionDistribution,
  type PromotionInput,
  type PromotionPlanId,
  type PromotionRecord,
  type PromotionRedemption,
  type PromotionRedemptionSource,
  type PromotionStatus,
  type PromotionRedemptionStatus,
} from "./promotions-types";
import type { LaunchPlanId } from "./products";

function mapEligiblePlans(raw: unknown): PromotionPlanId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is PromotionPlanId =>
      p === "free" || p === "lite" || p === "pro"
  );
}

function mapDemoSimulation(raw: unknown): DemoStripeSimulation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.simulated !== true) return null;
  const priceEffect = parsePriceEffect(obj.priceEffect);
  if (!priceEffect) return null;
  return {
    simulated: true,
    couponId: String(obj.couponId ?? ""),
    promotionCodeId:
      obj.promotionCodeId == null ? null : String(obj.promotionCodeId),
    mappedAt: String(obj.mappedAt ?? new Date().toISOString()),
    priceEffect,
  };
}

export function mapPromotionRow(row: Record<string, unknown>): PromotionRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    status: row.status as PromotionStatus,
    distribution: row.distribution as PromotionDistribution,
    code: (row.code as string | null) ?? null,
    startsAt: String(row.starts_at),
    endsAt: (row.ends_at as string | null) ?? null,
    pausedAt: (row.paused_at as string | null) ?? null,
    maxRedemptions:
      row.max_redemptions == null ? null : Number(row.max_redemptions),
    maxRedemptionsPerUser: Number(row.max_redemptions_per_user ?? 1),
    eligiblePlans: mapEligiblePlans(row.eligible_plans),
    audience: (row.audience as PromotionAudience) ?? "all",
    priceEffect: parsePriceEffect(row.price_effect),
    bonusEffect: parseBonusEffect(row.bonus_effect),
    stripeCouponId: (row.stripe_coupon_id as string | null) ?? null,
    stripePromotionCodeId:
      (row.stripe_promotion_code_id as string | null) ?? null,
    demoStripeSimulation: mapDemoSimulation(row.demo_stripe_simulation),
    redemptionCount: Number(row.redemption_count ?? 0),
    reason: String(row.reason ?? ""),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapRedemptionRow(
  row: Record<string, unknown>
): PromotionRedemption {
  return {
    id: String(row.id),
    promotionId: String(row.promotion_id),
    userId: String(row.user_id),
    redeemedAt: String(row.redeemed_at),
    source: row.source as PromotionRedemptionSource,
    codeUsed: (row.code_used as string | null) ?? null,
    status: row.status as PromotionRedemptionStatus,
    expiresAt: (row.expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    priceDiscountApplied: parsePriceEffect(row.price_discount_applied),
    bonusApplied: parseBonusEffect(row.bonus_applied),
    stripeCouponId: (row.stripe_coupon_id as string | null) ?? null,
    stripePromotionCodeId:
      (row.stripe_promotion_code_id as string | null) ?? null,
    demoSimulated: Boolean(row.demo_simulated),
    entitlementGrantId: (row.entitlement_grant_id as string | null) ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listPromotions(params?: {
  status?: PromotionStatus | PromotionStatus[];
  limit?: number;
}): Promise<PromotionRecord[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 100);

  if (params?.status) {
    const statuses = Array.isArray(params.status)
      ? params.status
      : [params.status];
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapPromotionRow(row as Record<string, unknown>)
  );
}

export async function getPromotionById(
  id: string
): Promise<PromotionRecord | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPromotionRow(data as Record<string, unknown>);
}

export async function getPromotionByCode(
  code: string
): Promise<PromotionRecord | null> {
  const normalized = normalizePromotionCode(code);
  if (!normalized) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPromotionRow(data as Record<string, unknown>);
}

export async function getPromotionBySlug(
  slug: string
): Promise<PromotionRecord | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .select("*")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPromotionRow(data as Record<string, unknown>);
}

export async function createPromotion(params: {
  input: PromotionInput;
  actorUserId: string;
  activate?: boolean;
}): Promise<PromotionRecord> {
  const parsed = promotionInputSchema.safeParse(params.input);
  if (!parsed.success) {
    throw new Error(
      `Invalid promotion: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const input = parsed.data;
  const reason = requirePromotionReason(input.reason);
  const code =
    input.distribution === "public_code" && input.code
      ? normalizePromotionCode(input.code)
      : null;

  const admin = createSupabaseAdminClient();
  const insert = {
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    status: params.activate ? "active" : "draft",
    distribution: input.distribution,
    code,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    paused_at: null,
    max_redemptions: input.maxRedemptions ?? null,
    max_redemptions_per_user: input.maxRedemptionsPerUser,
    eligible_plans: input.eligiblePlans,
    audience: input.audience,
    price_effect: input.priceEffect ?? null,
    bonus_effect: input.bonusEffect ?? null,
    reason,
    created_by: params.actorUserId,
  };

  const { data, error } = await admin
    .from("promotions")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;

  let mapped = mapPromotionRow(data as Record<string, unknown>);

  // Sync Stripe price mapping (demo simulates; live creates coupon).
  if (mapped.priceEffect) {
    const stripeMap = await syncPromotionPriceToStripe({ promotion: mapped });
    const { data: updated, error: updateError } = await admin
      .from("promotions")
      .update({
        stripe_coupon_id: stripeMap.stripeCouponId,
        stripe_promotion_code_id: stripeMap.stripePromotionCodeId,
        demo_stripe_simulation: stripeMap.demoStripeSimulation,
      })
      .eq("id", mapped.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    mapped = mapPromotionRow(updated as Record<string, unknown>);
  }

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.create",
    targetType: "promotion",
    targetId: mapped.id,
    metadata: {
      reason,
      slug: mapped.slug,
      distribution: mapped.distribution,
      status: mapped.status,
      hasPriceEffect: Boolean(mapped.priceEffect),
      hasBonusEffect: Boolean(mapped.bonusEffect),
      demoSimulated: Boolean(mapped.demoStripeSimulation),
      stripeCouponId: mapped.stripeCouponId,
    },
  });

  return mapped;
}

export async function activatePromotion(params: {
  id: string;
  reason: string;
  actorUserId: string;
}): Promise<PromotionRecord> {
  const reason = requirePromotionReason(params.reason);
  const existing = await getPromotionById(params.id);
  if (!existing) throw new Error("Promotion not found");
  if (existing.status === "archived") {
    throw new Error("Cannot activate an archived promotion");
  }
  if (existing.status === "ended") {
    throw new Error("Cannot activate an ended promotion");
  }
  if (existing.status === "active") return existing;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .update({ status: "active", paused_at: null })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapPromotionRow(data as Record<string, unknown>);
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.activate",
    targetType: "promotion",
    targetId: mapped.id,
    metadata: { reason, previousStatus: existing.status },
  });
  return mapped;
}

export async function pausePromotion(params: {
  id: string;
  reason: string;
  actorUserId: string;
}): Promise<PromotionRecord> {
  const reason = requirePromotionReason(params.reason);
  const existing = await getPromotionById(params.id);
  if (!existing) throw new Error("Promotion not found");
  if (existing.status !== "active") {
    throw new Error("Only active promotions can be paused");
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("promotions")
    .update({ status: "paused", paused_at: now })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapPromotionRow(data as Record<string, unknown>);
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.pause",
    targetType: "promotion",
    targetId: mapped.id,
    metadata: { reason, pausedAt: now },
  });
  return mapped;
}

export async function resumePromotion(params: {
  id: string;
  reason: string;
  actorUserId: string;
}): Promise<PromotionRecord> {
  const reason = requirePromotionReason(params.reason);
  const existing = await getPromotionById(params.id);
  if (!existing) throw new Error("Promotion not found");
  if (existing.status !== "paused") {
    throw new Error("Only paused promotions can be resumed");
  }

  // If the window already ended, mark ended instead of reactivating.
  if (existing.endsAt && new Date(existing.endsAt) <= new Date()) {
    return endPromotion({
      id: params.id,
      reason: `${reason} (auto-ended on resume: window closed)`,
      actorUserId: params.actorUserId,
    });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .update({ status: "active", paused_at: null })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapPromotionRow(data as Record<string, unknown>);
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.resume",
    targetType: "promotion",
    targetId: mapped.id,
    metadata: { reason },
  });
  return mapped;
}

export async function endPromotion(params: {
  id: string;
  reason: string;
  actorUserId: string;
}): Promise<PromotionRecord> {
  const reason = requirePromotionReason(params.reason);
  const existing = await getPromotionById(params.id);
  if (!existing) throw new Error("Promotion not found");
  if (existing.status === "ended" || existing.status === "archived") {
    return existing;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .update({ status: "ended", paused_at: null })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapPromotionRow(data as Record<string, unknown>);
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.end",
    targetType: "promotion",
    targetId: mapped.id,
    metadata: { reason, previousStatus: existing.status },
  });
  return mapped;
}

export async function archivePromotion(params: {
  id: string;
  reason: string;
  actorUserId: string;
}): Promise<PromotionRecord> {
  const reason = requirePromotionReason(params.reason);
  const existing = await getPromotionById(params.id);
  if (!existing) throw new Error("Promotion not found");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .update({ status: "archived", paused_at: null })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapPromotionRow(data as Record<string, unknown>);
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.archive",
    targetType: "promotion",
    targetId: mapped.id,
    metadata: { reason, previousStatus: existing.status },
  });
  return mapped;
}

/**
 * Expire redemptions whose expires_at has passed.
 * Best-effort maintenance called from list/redeem paths.
 */
export async function expireStaleRedemptions(
  now: Date = new Date()
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotion_redemptions")
    .update({ status: "expired" })
    .eq("status", "applied")
    .lt("expires_at", now.toISOString())
    .not("expires_at", "is", null)
    .select("id");
  if (error) {
    console.error("expireStaleRedemptions failed", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Auto-end promotions past ends_at that are still active/paused.
 */
export async function expireEndedPromotions(
  now: Date = new Date()
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .update({ status: "ended", paused_at: null })
    .in("status", ["active", "paused"])
    .lt("ends_at", now.toISOString())
    .not("ends_at", "is", null)
    .select("id");
  if (error) {
    console.error("expireEndedPromotions failed", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export type PromotionEligibilityContext = {
  userId: string;
  /** Current effective plan id (free/lite/pro). */
  planId: LaunchPlanId | string;
  /** Account created_at ISO — used for new vs existing audience. */
  userCreatedAt: string;
  /** True when the user has ever had a paid Stripe subscription. */
  hasHadPaidSubscription?: boolean;
};

export type EligibilityResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function evaluatePromotionEligibility(
  promo: PromotionRecord,
  ctx: PromotionEligibilityContext,
  now: Date = new Date()
): EligibilityResult {
  if (!isPromotionWindowOpen(promo, now)) {
    if (promo.status === "paused") {
      return { ok: false, code: "promotion_paused", message: "Promotion is paused" };
    }
    if (promo.status === "draft") {
      return { ok: false, code: "promotion_draft", message: "Promotion is not active" };
    }
    if (promo.status === "ended" || promo.status === "archived") {
      return { ok: false, code: "promotion_ended", message: "Promotion has ended" };
    }
    if (new Date(promo.startsAt) > now) {
      return {
        ok: false,
        code: "promotion_not_started",
        message: "Promotion has not started yet",
      };
    }
    return { ok: false, code: "promotion_ended", message: "Promotion window closed" };
  }

  if (
    promo.maxRedemptions != null &&
    promo.redemptionCount >= promo.maxRedemptions
  ) {
    return {
      ok: false,
      code: "promotion_exhausted",
      message: "Promotion redemption limit reached",
    };
  }

  if (promo.eligiblePlans.length > 0) {
    if (!promo.eligiblePlans.includes(ctx.planId as PromotionPlanId)) {
      return {
        ok: false,
        code: "plan_not_eligible",
        message: `Plan ${ctx.planId} is not eligible for this promotion`,
      };
    }
  }

  const accountAgeMs = now.getTime() - new Date(ctx.userCreatedAt).getTime();
  const isNewUser =
    accountAgeMs <= NEW_USER_WINDOW_MS && !ctx.hasHadPaidSubscription;

  if (promo.audience === "new_users" && !isNewUser) {
    return {
      ok: false,
      code: "audience_new_only",
      message: "Promotion is limited to new users",
    };
  }
  if (promo.audience === "existing_users" && isNewUser) {
    return {
      ok: false,
      code: "audience_existing_only",
      message: "Promotion is limited to existing users",
    };
  }

  return { ok: true };
}

function computeBonusExpiry(
  promo: PromotionRecord,
  bonus: BonusEffect,
  now: Date = new Date()
): string | null {
  const candidates: number[] = [];
  if (bonus.durationDays != null) {
    candidates.push(now.getTime() + bonus.durationDays * 24 * 60 * 60 * 1000);
  }
  if (promo.endsAt) {
    candidates.push(new Date(promo.endsAt).getTime());
  }
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

async function loadUserEligibilityContext(
  userId: string
): Promise<PromotionEligibilityContext> {
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: sub }] = await Promise.all([
    admin
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const planId = (sub?.plan_id as string | undefined) ?? "free";
  const status = (sub?.status as string | null) ?? null;
  const hasHadPaidSubscription =
    (planId === "lite" || planId === "pro") &&
    (status === "active" ||
      status === "trialing" ||
      status === "past_due" ||
      status === "canceled");

  return {
    userId,
    planId,
    userCreatedAt:
      (profile?.created_at as string | undefined) ??
      new Date().toISOString(),
    hasHadPaidSubscription,
  };
}

/**
 * Apply bonus effects inside Cortaix (credits + tracked overlay).
 * Usage/turn/storage/feature bonuses are applied at entitlement resolution
 * time from active redemptions — never via Stripe, never as demo grants.
 */
async function applyBonusCredits(params: {
  userId: string;
  bonus: BonusEffect;
}): Promise<void> {
  if ((params.bonus.creditBonus ?? 0) > 0) {
    await grantCredits(
      params.userId,
      Math.floor(params.bonus.creditBonus!),
      "promotion_credit_bonus"
    );
  }
}

/**
 * Active applied redemptions with bonus effects for entitlement stacking.
 */
export async function listActivePromotionBonusesForUser(
  userId: string,
  now: Date = new Date()
): Promise<
  import("./entitlement-resolution").PromotionBonusOverlay[]
> {
  await expireStaleRedemptions(now);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotion_redemptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "applied")
    .not("bonus_applied", "is", null);
  if (error) throw error;

  const overlays: import("./entitlement-resolution").PromotionBonusOverlay[] =
    [];
  for (const row of data ?? []) {
    const redemption = mapRedemptionRow(row as Record<string, unknown>);
    const bonus = redemption.bonusApplied;
    if (!bonus) continue;
    if (
      redemption.expiresAt &&
      new Date(redemption.expiresAt).getTime() <= now.getTime()
    ) {
      continue;
    }
    overlays.push({
      id: redemption.id,
      autoTurnBonus: bonus.autoTurnBonus ?? 0,
      frontierTurnBonus: bonus.frontierTurnBonus ?? 0,
      storageBytesBonus: bonus.storageBytesBonus ?? 0,
      featureOverrides: bonus.featureAccess ?? {},
      expiresAt: redemption.expiresAt,
    });
  }
  return overlays;
}

export type RedeemPromotionResult = {
  redemption: PromotionRedemption;
  promotion: PromotionRecord;
  demoSimulated: boolean;
};

/**
 * Redeem a promotion for a user (public code, automatic, or admin).
 */
export async function redeemPromotion(params: {
  promotionId?: string;
  code?: string;
  userId: string;
  source: PromotionRedemptionSource;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<RedeemPromotionResult> {
  await expireEndedPromotions();
  await expireStaleRedemptions();

  let promo: PromotionRecord | null = null;
  if (params.promotionId) {
    promo = await getPromotionById(params.promotionId);
  } else if (params.code) {
    promo = await getPromotionByCode(params.code);
  }
  if (!promo) throw new Error("Promotion not found");

  if (params.source === "code" && promo.distribution !== "public_code") {
    throw new Error("This promotion is not redeemable by code");
  }
  if (params.source === "automatic" && promo.distribution !== "automatic") {
    throw new Error("This promotion is not an automatic campaign");
  }

  const eligibilityCtx = await loadUserEligibilityContext(params.userId);
  const eligibility = evaluatePromotionEligibility(promo, eligibilityCtx);
  if (!eligibility.ok) {
    throw new Error(eligibility.message);
  }

  const mode = resolveCommercialMode();
  const demoSimulated =
    mode !== "live" && Boolean(promo.priceEffect);

  const bonus = promo.bonusEffect;
  const expiresAt = bonus
    ? computeBonusExpiry(promo, bonus)
    : promo.priceEffect
      ? promo.endsAt
      : null;

  // Credits applied after successful redeem to avoid orphan grants on failure.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("redeem_promotion", {
    p_promotion_id: promo.id,
    p_user_id: params.userId,
    p_source: params.source,
    p_code_used:
      params.source === "code"
        ? normalizePromotionCode(params.code ?? promo.code ?? "")
        : null,
    p_expires_at: expiresAt,
    p_price_discount_applied: promo.priceEffect,
    p_bonus_applied: promo.bonusEffect,
    p_stripe_coupon_id: demoSimulated ? null : promo.stripeCouponId,
    p_stripe_promotion_code_id: demoSimulated
      ? null
      : promo.stripePromotionCodeId,
    p_demo_simulated: demoSimulated,
    p_entitlement_grant_id: null,
    p_metadata: {
      ...(params.metadata ?? {}),
      commercialMode: mode,
      demoStripeSimulation: demoSimulated
        ? promo.demoStripeSimulation
        : null,
    },
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("promotion_user_limit")) {
      throw new Error("You have already redeemed this promotion");
    }
    if (msg.includes("promotion_exhausted")) {
      throw new Error("Promotion redemption limit reached");
    }
    if (msg.includes("promotion_paused")) {
      throw new Error("Promotion is paused");
    }
    if (msg.includes("promotion_not_active")) {
      throw new Error("Promotion is not active");
    }
    if (msg.includes("promotion_ended") || msg.includes("promotion_not_started")) {
      throw new Error("Promotion is not currently available");
    }
    throw new Error(msg || "Redemption failed");
  }

  if (bonus) {
    await applyBonusCredits({ userId: params.userId, bonus });
  }

  const redemption = mapRedemptionRow(data as Record<string, unknown>);
  const refreshed = (await getPromotionById(promo.id)) ?? promo;

  await recordBillingTelemetry({
    userId: params.userId,
    eventName: "promotion_redeemed",
    planId: eligibilityCtx.planId,
    meta: {
      promotionId: promo.id,
      slug: promo.slug,
      source: params.source,
      demoSimulated,
      hasPriceEffect: Boolean(promo.priceEffect),
      hasBonusEffect: Boolean(promo.bonusEffect),
    },
  });

  if (params.actorUserId) {
    await recordAdminAudit({
      actorUserId: params.actorUserId,
      action: "admin.promotion.redeem",
      targetType: "promotion_redemption",
      targetId: redemption.id,
      metadata: {
        promotionId: promo.id,
        userId: params.userId,
        source: params.source,
        demoSimulated,
      },
    });
  }

  return { redemption, promotion: refreshed, demoSimulated };
}

export async function revokeRedemption(params: {
  redemptionId: string;
  reason: string;
  actorUserId: string;
}): Promise<PromotionRedemption> {
  const reason = requirePromotionReason(params.reason);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await admin
    .from("promotion_redemptions")
    .select("*")
    .eq("id", params.redemptionId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Redemption not found");
  if (existing.status === "revoked") {
    return mapRedemptionRow(existing as Record<string, unknown>);
  }

  const { data, error } = await admin
    .from("promotion_redemptions")
    .update({ status: "revoked", revoked_at: now })
    .eq("id", params.redemptionId)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapRedemptionRow(data as Record<string, unknown>);

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.promotion.redemption.revoke",
    targetType: "promotion_redemption",
    targetId: mapped.id,
    metadata: {
      reason,
      promotionId: mapped.promotionId,
      userId: mapped.userId,
    },
  });

  return mapped;
}

export async function listRedemptionsForPromotion(
  promotionId: string,
  limit = 50
): Promise<PromotionRedemption[]> {
  await expireStaleRedemptions();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotion_redemptions")
    .select("*")
    .eq("promotion_id", promotionId)
    .order("redeemed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapRedemptionRow(row as Record<string, unknown>)
  );
}

export async function listRedemptionsForUser(
  userId: string,
  limit = 50
): Promise<PromotionRedemption[]> {
  await expireStaleRedemptions();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("promotion_redemptions")
    .select("*")
    .eq("user_id", userId)
    .order("redeemed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapRedemptionRow(row as Record<string, unknown>)
  );
}

/**
 * List automatic campaigns currently open for a user (eligibility pre-check).
 */
export async function listEligibleAutomaticPromotions(
  userId: string
): Promise<PromotionRecord[]> {
  await expireEndedPromotions();
  const promos = await listPromotions({ status: "active" });
  const automatic = promos.filter((p) => p.distribution === "automatic");
  const ctx = await loadUserEligibilityContext(userId);
  return automatic.filter((p) => evaluatePromotionEligibility(p, ctx).ok);
}

/** Pure helpers re-exported for unit tests. */
export {
  isPromotionWindowOpen,
  normalizePromotionCode,
  parseBonusEffect,
  parsePriceEffect,
  type PriceEffect,
  type BonusEffect,
  type PromotionInput,
  type PromotionRecord,
  type PromotionRedemption,
};
