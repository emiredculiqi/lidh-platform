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

/** Did the visitor at least try to type an email? Decides between "that
 *  doesn't look right" and "we do need one to continue". */
export function looksLikeEmailAttempt(text: string): boolean {
  return /@|\b(gmail|hotmail|yahoo|outlook|icloud|mail)\b|\.(com|al|net|org|eu|de|it)\b/i.test(text);
}

export interface IntakePromptOpts {
  /** The visitor's last reply didn't answer the current question. */
  retry?: boolean;
  /** Business name, for the opening line ("to chat with Bela Shoes…"). */
  business?: string;
  /** The visitor's last reply, to pick the right retry wording. */
  reply?: string;
}

/**
 * Bot copy. `locale` is the conversation's; anything not "al" gets English.
 *
 * The first line says up front WHY we ask (a name and an email are required
 * to chat with the business, and the team uses them only to reply). Retries
 * never just repeat the question: a refusal ("I don't want to") gets the
 * reason again and a clear "we can't continue without it"; a mistyped
 * address gets an example.
 */
export function intakePrompt(
  step: Exclude<IntakeStep, "done">,
  locale: string | null | undefined,
  state: IntakeState,
  opts: IntakePromptOpts = {},
): string {
  const al = locale === "al";
  const who = state.name ? `, ${state.name}` : "";
  const biz = opts.business?.trim();
  if (step === "name") {
    if (opts.retry) {
      return al
        ? "Që t'ju njohim, na duhet një emër — mjafton emri i parë. Si quheni?"
        : "So we know who we're talking to, we need a name — a first name is enough. What should we call you?";
    }
    return al
      ? `Përshëndetje, mirë se vini te ${biz || "ne"}! Para se të vazhdojmë, na duhen emri dhe emaili juaj, që t'ju njohim si klient dhe t'ju kthejmë përgjigje. Si quheni?`
      : `Hi, welcome to ${biz || "our chat"}! Before we continue, we need your name and email, so we know who we're talking to and can get back to you. What's your name?`;
  }
  if (opts.retry) {
    const attempt = opts.reply ? looksLikeEmailAttempt(opts.reply) : true;
    if (attempt) {
      return al
        ? `Ky email nuk duket i saktë (p.sh. emri@shembull.com). Mund ta shkruani sërish${who}?`
        : `That email doesn't look right (e.g. name@example.com). Could you type it again${who}?`;
    }
    return al
      ? `E kuptoj${who}. Emailin e përdorim vetëm që t'ju njohim si klient dhe t'ju përgjigjemi — pa të nuk mund të vazhdojmë. Mund ta shkruani këtu?`
      : `I understand${who}. We only use your email to know you as a customer and to reply to you — without it we can't continue. Could you type it here?`;
  }
  return al
    ? `Gëzohem${who}! Dhe emaili juaj, që t'ju gjejmë si klient dhe t'ju përgjigjemi edhe nëse mbyllni faqen?`
    : `Nice to meet you${who}! And your email, so we can find you as a customer and reply even if you close the page?`;
}

/** What the bot says once intake is complete and the TEAM (not the assistant)
 *  will answer. When the assistant answers, it simply replies instead. */
export function intakeHandoffToTeam(locale: string | null | undefined, state: IntakeState): string {
  const who = state.name ? `, ${state.name}` : "";
  return locale === "al"
    ? `Faleminderit${who}! Ekipi do t'ju përgjigjet këtu së shpejti.`
    : `Thanks${who}! The team will reply to you here shortly.`;
}
