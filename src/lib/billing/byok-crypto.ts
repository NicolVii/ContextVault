import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
export type { ByokProvider } from "./byok-providers";
export { BYOK_PROVIDERS } from "./byok-providers";

const ALGO = "aes-256-gcm";
/** Salt version — bump when rotating derivation params (see docs). */
export const BYOK_KEY_DERIVATION_VERSION = "cortaix-byok-v1";

export class MissingByokEncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingByokEncryptionKeyError";
  }
}

/**
 * Resolve the BYOK encryption secret.
 * Production requires a dedicated BYOK_ENCRYPTION_KEY — never fall back to the
 * service role key outside local development.
 */
export function resolveByokEncryptionSecret(
  env: NodeJS.ProcessEnv = process.env
): string {
  const dedicated = env.BYOK_ENCRYPTION_KEY?.trim();
  if (dedicated) return dedicated;

  if (env.NODE_ENV === "production") {
    throw new MissingByokEncryptionKeyError(
      "BYOK_ENCRYPTION_KEY is required in production to store provider API keys"
    );
  }

  const fallback = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (fallback) return fallback;

  throw new MissingByokEncryptionKeyError(
    "BYOK_ENCRYPTION_KEY is required to store provider API keys (or set SUPABASE_SERVICE_ROLE_KEY for local-only fallback)"
  );
}

function deriveKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  return scryptSync(resolveByokEncryptionSecret(env), BYOK_KEY_DERIVATION_VERSION, 32);
}

export function encryptSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env
): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(env), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(
  ciphertext: string,
  iv: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const raw = Buffer.from(ciphertext, "base64");
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, deriveKey(env), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
