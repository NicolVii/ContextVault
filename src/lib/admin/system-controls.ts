/**
 * Platform operational controls — DB-backed kill-switches with optional expiry.
 * All product gates must call these helpers server-side; UI toggles are not enough.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";

export const OPERATIONAL_CONTROL_KEYS = [
  "maintenance_mode",
  "mock_only_mode",
  "frontier_shutdown",
  "file_upload_shutdown",
  "voice_shutdown",
  "registration_shutdown",
  "checkout_shutdown",
  "provider_shutdown",
  "model_shutdown",
] as const;

export type OperationalControlKey = (typeof OPERATIONAL_CONTROL_KEYS)[number];

export const OPERATIONAL_CONTROL_META: Record<
  OperationalControlKey,
  { label: string; description: string; supportsTargets: boolean }
> = {
  maintenance_mode: {
    label: "Maintenance mode",
    description:
      "Blocks product APIs (chat, think, uploads, billing mutations) with 503.",
    supportsTargets: false,
  },
  mock_only_mode: {
    label: "Mock-only mode",
    description: "Forces all inference onto the mock adapter (no live providers).",
    supportsTargets: false,
  },
  frontier_shutdown: {
    label: "Frontier shutdown",
    description: "Rejects Frontier-intensity turns platform-wide.",
    supportsTargets: false,
  },
  file_upload_shutdown: {
    label: "File-upload shutdown",
    description: "Rejects new document uploads.",
    supportsTargets: false,
  },
  voice_shutdown: {
    label: "Voice shutdown",
    description: "Disables voice capability even when plan + feature flag allow it.",
    supportsTargets: false,
  },
  registration_shutdown: {
    label: "Registration shutdown",
    description:
      "Blocks new auth.users inserts (email + OAuth) via database trigger.",
    supportsTargets: false,
  },
  checkout_shutdown: {
    label: "Checkout shutdown",
    description: "Blocks Stripe Checkout session creation.",
    supportsTargets: false,
  },
  provider_shutdown: {
    label: "Provider shutdown",
    description:
      "Disables live providers. Leave targets empty for all; otherwise list provider ids.",
    supportsTargets: true,
  },
  model_shutdown: {
    label: "Model shutdown",
    description:
      "Disables models. Leave targets empty for all; otherwise list cortaix model ids.",
    supportsTargets: true,
  },
};

export interface OperationalControlState {
  key: OperationalControlKey;
  enabled: boolean;
  /** True when enabled and not past expires_at. */
  active: boolean;
  expiresAt: string | null;
  reason: string | null;
  targetIds: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  metadata: Record<string, unknown>;
}

export type OperationalControlsSnapshot = {
  controls: Map<OperationalControlKey, OperationalControlState>;
  loadedAt: number;
};

export const OPERATIONAL_CONTROLS_CACHE_TTL_MS = 15_000;

export class OperationalControlError extends Error {
  readonly code: string;
  readonly status: 503 | 403;

  constructor(code: string, message: string, status: 503 | 403 = 503) {
    super(message);
    this.name = "OperationalControlError";
    this.code = code;
    this.status = status;
  }
}

let cache: OperationalControlsSnapshot | null = null;

export function isOperationalControlKey(
  value: unknown
): value is OperationalControlKey {
  return (
    typeof value === "string" &&
    (OPERATIONAL_CONTROL_KEYS as readonly string[]).includes(value)
  );
}

export function invalidateOperationalControlsCache(): void {
  cache = null;
}

function isActive(enabled: boolean, expiresAt: string | null, now = Date.now()): boolean {
  if (!enabled) return false;
  if (!expiresAt) return true;
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp)) return true;
  return exp > now;
}

function defaultControl(key: OperationalControlKey): OperationalControlState {
  return {
    key,
    enabled: false,
    active: false,
    expiresAt: null,
    reason: null,
    targetIds: [],
    updatedAt: null,
    updatedBy: null,
    metadata: {},
  };
}

function rowToState(row: {
  key: string;
  enabled: boolean;
  expires_at: string | null;
  reason: string | null;
  target_ids: string[] | null;
  updated_at: string | null;
  updated_by: string | null;
  metadata: Record<string, unknown> | null;
}): OperationalControlState | null {
  if (!isOperationalControlKey(row.key)) return null;
  const expiresAt = row.expires_at;
  const enabled = Boolean(row.enabled);
  return {
    key: row.key,
    enabled,
    active: isActive(enabled, expiresAt),
    expiresAt,
    reason: row.reason,
    targetIds: Array.isArray(row.target_ids) ? row.target_ids.filter(Boolean) : [],
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
  };
}

export async function loadOperationalControlsSnapshot(): Promise<OperationalControlsSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_operational_controls")
    .select(
      "key, enabled, expires_at, reason, target_ids, updated_at, updated_by, metadata"
    );

  if (error) {
    throw new Error(`loadOperationalControlsSnapshot failed: ${error.message}`);
  }

  const controls = new Map<OperationalControlKey, OperationalControlState>();
  for (const key of OPERATIONAL_CONTROL_KEYS) {
    controls.set(key, defaultControl(key));
  }
  for (const row of data ?? []) {
    const state = rowToState(
      row as {
        key: string;
        enabled: boolean;
        expires_at: string | null;
        reason: string | null;
        target_ids: string[] | null;
        updated_at: string | null;
        updated_by: string | null;
        metadata: Record<string, unknown> | null;
      }
    );
    if (state) controls.set(state.key, state);
  }

  // Lazily clear expired flags so the admin UI and audit trail stay honest.
  const expiredKeys: OperationalControlKey[] = [];
  for (const state of controls.values()) {
    if (state.enabled && state.expiresAt && !state.active) {
      expiredKeys.push(state.key);
    }
  }
  if (expiredKeys.length > 0) {
    const nowIso = new Date().toISOString();
    await admin
      .from("system_operational_controls")
      .update({
        enabled: false,
        expires_at: null,
        metadata: { auto_expired_at: nowIso },
      })
      .in("key", expiredKeys);
    for (const key of expiredKeys) {
      const prev = controls.get(key) ?? defaultControl(key);
      controls.set(key, {
        ...prev,
        enabled: false,
        active: false,
        expiresAt: null,
        metadata: { ...prev.metadata, auto_expired_at: nowIso },
      });
      void recordAdminAudit({
        actorUserId: null,
        action: "admin.system_control.auto_expire",
        targetType: "system_operational_control",
        targetId: key,
        metadata: { expiresAt: prev.expiresAt },
      });
    }
  }

  return { controls, loadedAt: Date.now() };
}

export async function ensureOperationalControlsSnapshot(options?: {
  ttlMs?: number;
}): Promise<OperationalControlsSnapshot> {
  const ttlMs = options?.ttlMs ?? OPERATIONAL_CONTROLS_CACHE_TTL_MS;
  if (cache && Date.now() - cache.loadedAt < ttlMs) {
    const refreshed = new Map<OperationalControlKey, OperationalControlState>();
    for (const [key, state] of cache.controls) {
      refreshed.set(key, {
        ...state,
        active: isActive(state.enabled, state.expiresAt),
      });
    }
    return { controls: refreshed, loadedAt: cache.loadedAt };
  }
  try {
    cache = await loadOperationalControlsSnapshot();
    return cache;
  } catch (err) {
    console.error("ensureOperationalControlsSnapshot failed", err);
    const controls = new Map<OperationalControlKey, OperationalControlState>();
    for (const key of OPERATIONAL_CONTROL_KEYS) {
      controls.set(key, defaultControl(key));
    }
    return { controls, loadedAt: Date.now() };
  }
}

export function getControl(
  key: OperationalControlKey,
  snapshot: OperationalControlsSnapshot
): OperationalControlState {
  return snapshot.controls.get(key) ?? defaultControl(key);
}

export function isControlActive(
  key: OperationalControlKey,
  snapshot: OperationalControlsSnapshot
): boolean {
  return getControl(key, snapshot).active;
}

/** Provider shutdown: empty targets = all non-mock providers. */
export function isProviderShutDown(
  providerId: string,
  snapshot: OperationalControlsSnapshot
): boolean {
  if (providerId === "mock") return false;
  const ctl = getControl("provider_shutdown", snapshot);
  if (!ctl.active) return false;
  if (ctl.targetIds.length === 0) return true;
  return ctl.targetIds.includes(providerId);
}

/** Model shutdown: empty targets = all models. */
export function isModelShutDown(
  modelId: string,
  snapshot: OperationalControlsSnapshot
): boolean {
  const ctl = getControl("model_shutdown", snapshot);
  if (!ctl.active) return false;
  if (ctl.targetIds.length === 0) return true;
  return ctl.targetIds.includes(modelId);
}

export async function listOperationalControls(): Promise<OperationalControlState[]> {
  const snap = await ensureOperationalControlsSnapshot({ ttlMs: 0 });
  return OPERATIONAL_CONTROL_KEYS.map((key) => getControl(key, snap));
}

export async function updateOperationalControl(input: {
  key: OperationalControlKey;
  enabled: boolean;
  reason: string;
  expiresAt?: string | null;
  targetIds?: string[];
  actorUserId: string;
}): Promise<OperationalControlState> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new Error("Reason must be at least 3 characters");
  }

  let expiresAt: string | null = null;
  if (input.enabled && input.expiresAt) {
    const exp = Date.parse(input.expiresAt);
    if (!Number.isFinite(exp)) {
      throw new Error("Invalid expiresAt");
    }
    if (exp <= Date.now()) {
      throw new Error("expiresAt must be in the future");
    }
    expiresAt = new Date(exp).toISOString();
  }

  const meta = OPERATIONAL_CONTROL_META[input.key];
  const targetIds = meta.supportsTargets
    ? (input.targetIds ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 100)
    : [];

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_operational_controls")
    .upsert(
      {
        key: input.key,
        enabled: input.enabled,
        expires_at: input.enabled ? expiresAt : null,
        reason,
        target_ids: targetIds,
        updated_by: input.actorUserId,
        metadata: {},
      },
      { onConflict: "key" }
    )
    .select(
      "key, enabled, expires_at, reason, target_ids, updated_at, updated_by, metadata"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update control");
  }

  invalidateOperationalControlsCache();

  const state = rowToState(
    data as {
      key: string;
      enabled: boolean;
      expires_at: string | null;
      reason: string | null;
      target_ids: string[] | null;
      updated_at: string | null;
      updated_by: string | null;
      metadata: Record<string, unknown> | null;
    }
  );
  if (!state) throw new Error("Unknown control key");

  await recordAdminAudit({
    actorUserId: input.actorUserId,
    action: input.enabled
      ? "admin.system_control.enable"
      : "admin.system_control.disable",
    targetType: "system_operational_control",
    targetId: input.key,
    metadata: {
      reason,
      expiresAt: state.expiresAt,
      targetIds: state.targetIds,
      enabled: state.enabled,
    },
  });

  return state;
}

export async function assertMaintenanceAllowed(): Promise<void> {
  const snap = await ensureOperationalControlsSnapshot();
  if (isControlActive("maintenance_mode", snap)) {
    const reason = getControl("maintenance_mode", snap).reason;
    throw new OperationalControlError(
      "maintenance_mode",
      reason?.trim() || "The platform is in maintenance mode. Please try again later.",
      503
    );
  }
}

export async function assertFileUploadAllowed(): Promise<void> {
  await assertMaintenanceAllowed();
  const snap = await ensureOperationalControlsSnapshot();
  if (isControlActive("file_upload_shutdown", snap)) {
    throw new OperationalControlError(
      "file_upload_shutdown",
      "File uploads are temporarily disabled.",
      503
    );
  }
}

export async function assertCheckoutControlAllowed(): Promise<void> {
  await assertMaintenanceAllowed();
  const snap = await ensureOperationalControlsSnapshot();
  if (isControlActive("checkout_shutdown", snap)) {
    throw new OperationalControlError(
      "checkout_shutdown",
      "Checkout is temporarily disabled.",
      503
    );
  }
}

export async function assertVoiceAllowed(): Promise<void> {
  const snap = await ensureOperationalControlsSnapshot();
  if (isControlActive("voice_shutdown", snap)) {
    throw new OperationalControlError(
      "voice_shutdown",
      "Voice features are temporarily disabled.",
      503
    );
  }
}

export async function isVoiceShutdownActive(): Promise<boolean> {
  const snap = await ensureOperationalControlsSnapshot();
  return isControlActive("voice_shutdown", snap);
}

export async function assertRegistrationAllowed(): Promise<void> {
  const snap = await ensureOperationalControlsSnapshot();
  if (isControlActive("registration_shutdown", snap)) {
    throw new OperationalControlError(
      "registration_shutdown",
      "New registrations are temporarily disabled.",
      403
    );
  }
}

export function operationalControlErrorResponse(err: OperationalControlError) {
  return {
    error: err.message,
    code: err.code,
  };
}

/** Pure helper for unit tests — evaluate active flag without DB. */
export function evaluateControlActive(
  enabled: boolean,
  expiresAt: string | null,
  nowMs: number = Date.now()
): boolean {
  return isActive(enabled, expiresAt, nowMs);
}
