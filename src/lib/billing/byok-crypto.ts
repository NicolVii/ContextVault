import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
export type { ByokProvider } from "./byok-providers";
export { BYOK_PROVIDERS } from "./byok-providers";

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.BYOK_ENCRYPTION_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("BYOK_ENCRYPTION_KEY (or service role key) is required to store provider keys");
  }
  return scryptSync(secret, "cortaix-byok-v1", 32);
}

export function encryptSecret(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, deriveKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
