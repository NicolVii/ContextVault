import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { LocalEmbeddingProvider } from "../src/lib/embeddings";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const embedder = new LocalEmbeddingProvider();

export function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient; // authenticated, RLS-enforced
}

/** Create a fresh confirmed user and return a signed-in, RLS-scoped client. */
export async function createTestUser(): Promise<TestUser> {
  const admin = adminClient();
  const email = `test-${randomUUID()}@example.com`;
  const password = "password-123456";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user!.id;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: userId, email, client };
}

export async function deleteTestUser(id: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(id);
}

export async function vecFor(text: string): Promise<string> {
  const [e] = await embedder.embed([text]);
  return `[${e.join(",")}]`;
}
