import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, type ByokProvider } from "./byok-crypto";

export async function saveUserProviderKey(input: {
  userId: string;
  provider: ByokProvider;
  apiKey: string;
  label?: string | null;
}): Promise<void> {
  const { ciphertext, iv } = encryptSecret(input.apiKey.trim());
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("user_provider_keys").upsert(
    {
      user_id: input.userId,
      provider: input.provider,
      ciphertext,
      iv,
      label: input.label ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
}

export async function deleteUserProviderKey(
  userId: string,
  provider: ByokProvider
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("user_provider_keys")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function loadUserProviderKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_provider_keys")
    .select("ciphertext, iv")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  return decryptSecret(data.ciphertext as string, data.iv as string);
}

export async function listUserProviderKeys(
  userId: string
): Promise<{ provider: string; label: string | null; created_at: string }[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_provider_keys")
    .select("provider, label, created_at")
    .eq("user_id", userId);
  return (data ?? []) as { provider: string; label: string | null; created_at: string }[];
}
