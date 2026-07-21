import type { CvMem0Metadata } from "./mapping";

const DEFAULT_BASE_URL = "https://api.mem0.ai";

export interface Mem0AddResponse {
  message?: string;
  status?: string;
  event_id?: string;
}

export interface Mem0EventResult {
  id?: string;
  memory?: string;
  event?: string;
}

export interface Mem0EventResponse {
  id?: string;
  status?: "PENDING" | "RUNNING" | "FAILED" | "SUCCEEDED";
  results?: Mem0EventResult[];
  error?: string;
}

export interface Mem0SearchResult {
  id: string;
  memory: string;
  score?: number;
  metadata?: Partial<CvMem0Metadata> & Record<string, unknown>;
  categories?: string[];
  created_at?: string;
}

export interface Mem0SearchResponse {
  results: Mem0SearchResult[];
}

export interface Mem0ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Max time to wait for async add processing. */
  addTimeoutMs?: number;
  /** Poll interval while waiting for add events. */
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

export class Mem0Client {
  readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly addTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: Mem0ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.addTimeoutMs = options.addTimeoutMs ?? 15_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 300;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async addMemory(params: {
    userId: string;
    content: string;
    metadata: CvMem0Metadata;
    expirationDate?: string | null;
  }): Promise<string> {
    const body = {
      user_id: params.userId,
      messages: [{ role: "user", content: params.content }],
      infer: false,
      metadata: params.metadata,
      ...(params.expirationDate ? { expiration_date: params.expirationDate } : {}),
    };

    const queued = await this.request<Mem0AddResponse>("POST", "/v3/memories/add/", body);
    if (!queued.event_id) {
      throw new Error("Mem0 add did not return an event_id");
    }

    const event = await this.waitForEvent(queued.event_id);
    const mem0Id = this.extractMemoryId(event);
    if (!mem0Id) {
      throw new Error("Mem0 add completed without a memory id");
    }
    return mem0Id;
  }

  async searchMemories(params: {
    userId: string;
    query: string;
    topK?: number;
    threshold?: number;
  }): Promise<Mem0SearchResult[]> {
    const body = {
      query: params.query,
      filters: { user_id: params.userId },
      top_k: params.topK ?? 10,
      threshold: params.threshold ?? 0.05,
    };
    const response = await this.request<Mem0SearchResponse>("POST", "/v3/memories/search/", body);
    return response.results ?? [];
  }

  async updateMemory(
    mem0Id: string,
    params: { text: string; metadata?: CvMem0Metadata }
  ): Promise<void> {
    await this.request("PUT", `/v1/memories/${mem0Id}/`, {
      text: params.text,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  }

  async deleteMemory(mem0Id: string): Promise<void> {
    await this.request("DELETE", `/v1/memories/${mem0Id}/`);
  }

  private async waitForEvent(eventId: string): Promise<Mem0EventResponse> {
    const deadline = Date.now() + this.addTimeoutMs;
    while (Date.now() < deadline) {
      const event = await this.request<Mem0EventResponse>("GET", `/v1/event/${eventId}/`);
      if (event.status === "SUCCEEDED") return event;
      if (event.status === "FAILED") {
        throw new Error(event.error ?? "Mem0 memory processing failed");
      }
      await sleep(this.pollIntervalMs);
    }
    throw new Error(`Timed out waiting for Mem0 event ${eventId}`);
  }

  private extractMemoryId(event: Mem0EventResponse): string | null {
    for (const result of event.results ?? []) {
      if (result.id) return result.id;
    }
    return null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Token ${this.apiKey}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload && "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error: unknown }).error)
            : text || response.statusText;
      throw new Error(`Mem0 API ${method} ${path} failed (${response.status}): ${detail}`);
    }

    return payload as T;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
