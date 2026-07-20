/**
 * Conservative gate: skip calling the extraction model for messages that
 * almost never contain durable personal memories. Prefer false negatives
 * (call the model) over false positives (skip a real memory).
 */

const GREETING_ONLY =
  /^(hi|hello|hey|howdy|hiya|yo|sup|good\s+(morning|afternoon|evening|night)|greetings)([\s,!.]*|[\s,!.]+(there|all|everyone|folks)?)?$/i;

const ACK_ONLY =
  /^(thanks|thank\s*you|thx|ty|ok|okay|k|sure|cool|got\s*it|great|perfect|awesome|nice|alright|all\s*right|yes|yep|yeah|yup|no|nope|nah|nm|np|cheers|appreciate\s*it)[\s!.]*$/i;

const FIRST_PERSON =
  /\b(i|i['’]m|i['’]ve|i['’]d|i['’]ll|me|my|mine|myself|we|we['’]re|we['’]ve|our|ours)\b/i;

/** Question openers typical of impersonal factual asks. */
const QUESTION_OPENER =
  /^(who|what|when|where|why|how|which|is|are|was|were|do|does|did|can|could|would|will|should|may|might)\b/i;

export function hasFirstPersonReference(text: string): boolean {
  return FIRST_PERSON.test(text);
}

/**
 * Return true when extraction can be skipped entirely (no LLM, no heuristics).
 * Only matches obviously empty, greeting-only, acknowledgement-only, or
 * impersonal factual questions with no first-person content.
 */
export function shouldSkipExtraction(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Collapse whitespace for whole-message pattern checks.
  const compact = trimmed.replace(/\s+/g, " ").trim();

  if (compact.length <= 40 && GREETING_ONLY.test(compact)) return true;
  if (compact.length <= 40 && ACK_ONLY.test(compact)) return true;

  if (looksLikeImpersonalQuestion(compact)) return true;

  return false;
}

function looksLikeImpersonalQuestion(text: string): boolean {
  if (hasFirstPersonReference(text)) return false;

  const endsWithQuestion = /[?？]\s*$/.test(text);
  const opensLikeQuestion = QUESTION_OPENER.test(text);
  if (!endsWithQuestion && !opensLikeQuestion) return false;

  // Keep it conservative: only short-to-medium impersonal asks.
  if (text.length > 240) return false;

  return endsWithQuestion || opensLikeQuestion;
}
