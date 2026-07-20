import { createHash } from "node:crypto";

export const EMBEDDING_DIM = 1536;

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }
  return tokens;
}

function hashToIndex(token: string, salt: string): number {
  const h = createHash("md5").update(salt + token).digest();
  return h.readUInt32BE(0);
}

/**
 * Deterministic, dependency-free embedding using the feature-hashing trick.
 * Produces L2-normalised vectors so cosine similarity reflects token overlap.
 * Good enough to demonstrate semantic retrieval fully offline; swap in a real
 * model via EMBEDDING_PROVIDER=openai for production-grade quality.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dimensions = EMBEDDING_DIM;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);
    for (const token of tokens) {
      const idx = hashToIndex(token, "idx:") % this.dimensions;
      const sign = (hashToIndex(token, "sgn:") & 1) === 0 ? 1 : -1;
      vec[idx] += sign;
    }
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm);
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions = EMBEDDING_DIM;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });
    if (!res.ok) {
      throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  const provider = process.env.EMBEDDING_PROVIDER ?? "local";
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    cached = new OpenAIEmbeddingProvider(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"
    );
  } else {
    cached = new LocalEmbeddingProvider();
  }
  return cached;
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
