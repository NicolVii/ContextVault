import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SIGNUP_CREDITS } from "./pricing";

export class InsufficientCreditsError extends Error {
  readonly balance: number;
  readonly required: number;

  constructor(balance: number, required: number) {
    super(
      `Usage unavailable right now (need ${required}, have ${balance}). Check Plan & Usage to continue.`
    );
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.required = required;
  }
}

export async function ensureCreditAccount(userId: string): Promise<{ balance: number }> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("credit_accounts")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return { balance: existing.balance as number };

  const { data, error } = await admin
    .from("credit_accounts")
    .insert({ user_id: userId, balance: DEFAULT_SIGNUP_CREDITS })
    .select("balance")
    .single();

  if (error) {
    // Race: another request created the row.
    const { data: again } = await admin
      .from("credit_accounts")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (again) return { balance: again.balance as number };
    throw error;
  }

  await admin.from("credit_ledger").insert({
    user_id: userId,
    request_id: null,
    delta: DEFAULT_SIGNUP_CREDITS,
    reason: "signup_grant",
    balance_after: DEFAULT_SIGNUP_CREDITS,
  });

  return { balance: data.balance as number };
}

export async function getCreditBalance(userId: string): Promise<number> {
  const { balance } = await ensureCreditAccount(userId);
  return balance;
}

export async function assertCreditsAvailable(
  userId: string,
  required: number
): Promise<number> {
  const balance = await getCreditBalance(userId);
  if (balance < required) {
    throw new InsufficientCreditsError(balance, required);
  }
  return balance;
}

/** Admin / seed helper — grant credits and append ledger row. */
export async function grantCredits(
  userId: string,
  amount: number,
  reason = "admin_grant"
): Promise<number> {
  if (amount <= 0) throw new Error("Grant amount must be positive");
  await ensureCreditAccount(userId);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("apply_credit_delta", {
    p_user_id: userId,
    p_delta: amount,
    p_request_id: null,
    p_reason: reason,
  });
  if (error) throw error;
  return data as number;
}
