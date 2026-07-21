import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionContext } from "@/lib/auth";
import { extractPdf, extractText } from "@/lib/documents/extract";
import { chunkPages } from "@/lib/documents/chunk";
import { getEmbeddingProvider, toVectorLiteral } from "@/lib/embeddings";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";

export const maxDuration = 60;

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { getPlanUsageSnapshot } = await import("@/lib/billing/plan-usage");
  const usage = await getPlanUsageSnapshot(ctx.user.id);
  if (!usage.entitlements.attachments) {
    return NextResponse.json(
      {
        error: "File uploads are available on Lite and Pro.",
        code: "attachments_locked",
      },
      { status: 403 }
    );
  }

  const { data: existingDocs } = await ctx.supabase
    .from("documents")
    .select("size_bytes");
  const usedBytes = (existingDocs ?? []).reduce(
    (n, d) => n + (Number(d.size_bytes) || 0),
    0
  );

  const limit = await checkRateLimit(ctx.user.id, "document_upload", 20, 3600);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Upload limit reached" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (usedBytes + file.size > usage.entitlements.storageBytes) {
    return NextResponse.json(
      {
        error: "File library storage limit reached for your plan.",
        code: "storage_full",
      },
      { status: 403 }
    );
  }

  // --- Validate file type and size ---
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_UPLOAD_TYPES.includes(mime as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mime}. Only PDF and text files are allowed.` },
      { status: 400 }
    );
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File must be between 1 byte and ${MAX_UPLOAD_BYTES / 1024 / 1024} MiB.` },
      { status: 400 }
    );
  }

  const { supabase, user } = ctx;
  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = randomUUID();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const storagePath = `${user.id}/${docId}/${safeName}`;

  // --- Store the file (storage RLS restricts writes to the user's folder) ---
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      id: docId,
      user_id: user.id,
      filename: file.name,
      storage_path: storagePath,
      mime_type: mime,
      size_bytes: file.size,
      status: "processing",
    })
    .select()
    .single();
  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  // --- Extract text, chunk, embed ---
  try {
    const extracted =
      mime === "application/pdf" ? await extractPdf(buffer) : extractText(buffer);
    const chunks = chunkPages(extracted.pages);

    if (chunks.length > 0) {
      const embedder = getEmbeddingProvider();
      const texts = chunks.map((c) => c.content);
      const embeddings = await embedder.embed(texts);
      const { meterEmbeddingUsage } = await import("@/lib/billing/meter-embed");
      await meterEmbeddingUsage({ userId: user.id, texts });
      const rows = chunks.map((c, i) => ({
        document_id: docId,
        user_id: user.id,
        content: c.content,
        page_number: c.pageNumber,
        chunk_index: c.index,
        embedding: toVectorLiteral(embeddings[i]),
      }));
      const { error: chunkError } = await supabase.from("document_chunks").insert(rows);
      if (chunkError) throw new Error(chunkError.message);
    }

    await supabase
      .from("documents")
      .update({ status: "ready", page_count: extracted.pageCount })
      .eq("id", docId);

    await recordAudit({
      userId: user.id,
      action: "document.upload",
      entityType: "document",
      entityId: docId,
      metadata: { filename: file.name, chunks: chunks.length },
    });

    return NextResponse.json(
      { document: { ...doc, status: "ready", page_count: extracted.pageCount }, chunks: chunks.length },
      { status: 201 }
    );
  } catch (err) {
    const messageText = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("documents")
      .update({ status: "failed", error: messageText })
      .eq("id", docId);
    return NextResponse.json({ error: `Processing failed: ${messageText}` }, { status: 500 });
  }
}
