/**
 * Seed the local database with a demo user and sample data.
 *
 * Run with:  pnpm db:seed
 * (Loads .env.local, uses the service role key to create the demo account.)
 *
 * Idempotent: re-running resets the demo user's memories and documents.
 */
import { createClient } from "@supabase/supabase-js";
import { LocalEmbeddingProvider } from "../src/lib/embeddings";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_EMAIL = "demo@contextvault.local";
const DEMO_PASSWORD = "demo-password-123";

const embedder = new LocalEmbeddingProvider();
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function embed(text: string): Promise<string> {
  const [e] = await embedder.embed([text]);
  return `[${e.join(",")}]`;
}

async function getOrCreateUser(): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

const MEMORIES: {
  content: string;
  type: string;
  category: string;
  source: string;
  status: string;
  is_sensitive?: boolean;
  confidence?: number;
}[] = [
  { content: "My name is Sam Rivera.", type: "profile", category: "About me", source: "onboarding", status: "active" },
  { content: "I live in Lisbon, Portugal.", type: "profile", category: "About me", source: "onboarding", status: "active" },
  { content: "I work as a freelance product designer.", type: "profile", category: "Work", source: "onboarding", status: "active" },
  { content: "I prefer concise, direct answers without fluff.", type: "preference", category: "Preferences", source: "manual", status: "active" },
  { content: "I like using TypeScript and React for web projects.", type: "preference", category: "Tools", source: "manual", status: "active" },
  { content: "I follow a vegetarian diet.", type: "preference", category: "Lifestyle", source: "manual", status: "active" },
  { content: "I am learning to play the piano.", type: "semantic", category: "Hobbies", source: "manual", status: "active" },
  { content: "I am building a habit-tracking app called Streaks.", type: "project", category: "Projects", source: "manual", status: "active" },
  { content: "I prefer dark mode in all my apps.", type: "preference", category: "Preferences", source: "chat_extraction", status: "proposed", confidence: 0.7 },
  { content: "I usually do my best work late at night.", type: "semantic", category: "Notes", source: "chat_extraction", status: "proposed", confidence: 0.6 },
];

async function main() {
  const userId = await getOrCreateUser();
  console.log(`Demo user: ${DEMO_EMAIL} (${userId})`);

  await admin
    .from("profiles")
    .update({
      display_name: "Sam Rivera",
      persona: "Freelance product designer who values concise, practical answers.",
      onboarding_completed: true,
      default_model: "openai.gpt-4o-mini",
    })
    .eq("id", userId);

  // Ensure demo wallet has credits for platform inference.
  await admin.from("credit_accounts").upsert(
    { user_id: userId, balance: 1_000_000 },
    { onConflict: "user_id" }
  );

  // Reset existing demo data for idempotency.
  await admin.from("memories").delete().eq("user_id", userId);
  await admin.from("documents").delete().eq("user_id", userId);

  const rows = [];
  for (const m of MEMORIES) {
    rows.push({
      user_id: userId,
      content: m.content,
      type: m.type,
      category: m.category,
      source: m.source,
      status: m.status,
      confidence: m.confidence ?? 1,
      is_sensitive: m.is_sensitive ?? false,
      embedding: await embed(m.content),
    });
  }
  const { error: memErr } = await admin.from("memories").insert(rows);
  if (memErr) throw memErr;
  console.log(`Inserted ${rows.length} memories.`);

  // Sample document + chunks (metadata only; no physical file needed for demo).
  const docId = crypto.randomUUID();
  await admin.from("documents").insert({
    id: docId,
    user_id: userId,
    filename: "streaks-product-brief.pdf",
    storage_path: `${userId}/${docId}/streaks-product-brief.pdf`,
    mime_type: "application/pdf",
    size_bytes: 24000,
    page_count: 2,
    status: "ready",
  });
  const chunks = [
    { text: "Streaks is a minimalist habit-tracking app focused on daily consistency and gentle reminders.", page: 1 },
    { text: "The core metric for Streaks is the current streak length, shown prominently on the home screen.", page: 2 },
  ];
  const chunkRows = [];
  for (let i = 0; i < chunks.length; i++) {
    chunkRows.push({
      document_id: docId,
      user_id: userId,
      content: chunks[i].text,
      page_number: chunks[i].page,
      chunk_index: i,
      embedding: await embed(chunks[i].text),
    });
  }
  await admin.from("document_chunks").insert(chunkRows);
  console.log(`Inserted 1 document with ${chunkRows.length} chunks.`);
  console.log("\nSeed complete. Log in with:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
