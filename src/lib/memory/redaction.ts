/**
 * Guards for automatic memory extraction.
 *
 * - `scanForForbiddenSecrets` blocks content that must NEVER be stored
 *   automatically (passwords, API keys, payment data, government identifiers).
 * - `isSensitive` flags content that may be stored only after explicit human
 *   review — it can never be auto-approved (medical, financial, identity
 *   attributes, etc.).
 */

const FORBIDDEN_PATTERNS: { label: string; re: RegExp }[] = [
  // Passwords / PINs
  { label: "password", re: /\b(pass(word)?|passcode|pin)\b\s*(is|:|=|->)?\s*\S+/i },
  // Generic API keys / secrets / tokens
  { label: "api_key", re: /\b(api[\s_-]?key|secret[\s_-]?key|access[\s_-]?token|bearer)\b\s*[:=]?\s*\S{6,}/i },
  // Common key formats
  { label: "key_format", re: /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
  // Credit / debit card numbers (13-16 digits, optionally grouped)
  { label: "payment_card", re: /\b(?:\d[ -]?){13,16}\b/ },
  { label: "payment_terms", re: /\b(credit\s*card|debit\s*card|cvv|card\s*number|iban|routing\s*number)\b/i },
  // US SSN
  { label: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: "ssn_terms", re: /\b(social\s*security\s*(number|no|#)|national\s*id|passport\s*(number|no|#)|driver'?s?\s*licen[cs]e)\b/i },
];

const MEDICAL_PATTERNS: RegExp[] = [
  /\b(diagnos(ed|is)|prescri(bed|ption)|medication|dosage|mg\b|blood\s*type|HIV|cancer|diabetes|depression|anxiety|disorder|therapy|surgery)\b/i,
];

const SENSITIVE_PATTERNS: RegExp[] = [
  ...MEDICAL_PATTERNS,
  /\b(salary|income|net\s*worth|bank\s*account|religion|religious|sexual\s*orientation|ethnicity|political)\b/i,
];

export interface SecretScan {
  blocked: boolean;
  reasons: string[];
}

export function scanForForbiddenSecrets(text: string): SecretScan {
  const reasons: string[] = [];
  for (const { label, re } of FORBIDDEN_PATTERNS) {
    // A bare 13-16 digit run is only a card if it also looks card-like; skip
    // pure years / short numbers already excluded by the digit count.
    if (re.test(text)) reasons.push(label);
  }
  return { blocked: reasons.length > 0, reasons };
}

export function isSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(text));
}
