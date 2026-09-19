/**
 * Web intake gate (ADR-021) — the deterministic part.
 *
 * Before a web visitor can talk to the business they give a name and an
 * email. It is done as two short bot messages in the chat window, not a form,
 * and it is scripted rather than model-driven on purpose: zero tokens, works
 * even when the business has the assistant switched off, and cannot be argued
 * out of ("just answer this first"). WhatsApp never goes through this — the
 * phone number is the identity.
 *
 * Pure functions; the persistence and streaming live in ChatService.
 */

export interface IntakeState {
  name: string | null;
  email: string | null;
}

export type IntakeStep = "name" | "email" | "done";

/** Which detail is still missing, in the order we ask for them. */
export function intakeStep(s: IntakeState): IntakeStep {
  if (!s.name) return "name";
  if (!s.email) return "email";
  return "done";
}

// Deliberately permissive: we want "ana.b@gmail.com" and "ana@shop.al" to pass
// and "ana at gmail" to fail. Full RFC validation would reject real addresses.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function firstEmail(text: string): string | null {
  const m = EMAIL.exec(text);
  return m ? m[0].toLowerCase() : null;
}

/**
 * Turn a free-text reply into a name. Handles "Ana", "I'm Ana", "Jam Ana",
 * "my name is Ana B." and "Ana, ana@x.com" (the email is stripped first).
 * Refuses things that are clearly not a name: questions, long sentences,
 * bare emails, empty strings.
 */
export function parseName(text: string): string | null {
  let t = text.replace(EMAIL, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // Strip common lead-ins in AL/EN/IT so "Jam Ana" → "Ana".
  t = t
    .replace(/^(hi|hello|hey|pershendetje|përshëndetje|ciao|salut)[,!. ]+/i, "")
    .replace(/^(i am|i'm|im|my name is|this is|jam|une jam|unë jam|quhem|me quajne|më quajnë|sono|mi chiamo)\s+/i, "")
    .replace(/[.!,;:]+$/, "")
    .trim();
  if (!t || t.length > 60) return null;
  if (t.includes("?")) return null;
  // More than five words is a sentence, not a name.
  if (t.split(" ").length > 5) return null;
  // Must contain at least one letter.
  if (!/\p{L}/u.test(t)) return null;
  return t;
}

/**
 * Apply one visitor message to the intake state. Both fields are looked for
 * in every reply, so "Ana, ana@x.com" completes intake in one go, and an
 * email typed at the name prompt is not lost.
 *
 * `asked` says whether the bot has already put a question to the visitor.
 * The FIRST message of a conversation is their greeting or their question
 * ("Përshëndetje", "sa kushton?", "dua një ofertë") — never an answer — so
 * it is not read as a name. A volunteered email still counts, and a name is
 * taken from an unasked message only when it comes with an email.
 */
export function applyIntakeReply(
  prev: IntakeState,
  text: string,
  opts: { asked?: boolean } = {},
): IntakeState {
  const asked = opts.asked ?? true;
  const email = prev.email ?? firstEmail(text);
  const step = intakeStep(prev);
  // Only read a name from the reply when we are asking for one (or when the
  // visitor volunteered both); a reply to the email prompt is not a name.
  const name =
    prev.name ??
    ((asked && step === "name") || firstEmail(text) ? parseName(text) : null);
  return { name, email };
}

/** Bot copy. `locale` is the conversation's; anything not "al" gets English. */
export function intakePrompt(
  step: Exclude<IntakeStep, "done">,
  locale: string | null | undefined,
  state: IntakeState,
  opts: { retry?: boolean } = {},
): string {
  const al = locale === "al";
  const who = state.name ? state.name : "";
  if (step === "name") {
    return al
      ? opts.retry
        ? "Nuk e kapa emrin. Si quheni?"
        : "Përshëndetje! Para se të fillojmë, si quheni?"
      : opts.retry
        ? "I didn't catch your name. What should we call you?"
        : "Hi! Before we start, what's your name?";
  }
  return al
    ? opts.retry
      ? `Ky nuk duket si email i saktë. Cili është emaili juaj${who ? `, ${who}` : ""}?`
      : `Faleminderit${who ? `, ${who}` : ""}! Cili është emaili juaj, që të mund t'ju kontaktojmë?`
    : opts.retry
      ? `That doesn't look like a valid email. What's your email${who ? `, ${who}` : ""}?`
      : `Thanks${who ? `, ${who}` : ""}! And your email, so we can follow up?`;
}

/** What the bot says once intake is complete and the TEAM (not the assistant)
 *  will answer. When the assistant answers, it simply replies instead. */
export function intakeHandoffToTeam(locale: string | null | undefined, state: IntakeState): string {
  const who = state.name ? `, ${state.name}` : "";
  return locale === "al"
    ? `Faleminderit${who}! Ekipi do t'ju përgjigjet këtu së shpejti.`
    : `Thanks${who}! The team will reply to you here shortly.`;
}
