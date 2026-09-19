/**
 * One rule for what to call a contact, everywhere: name → phone → email.
 *
 * WhatsApp contacts always have a phone, so they show their number the moment
 * they write. Web contacts show whatever the pre-chat form collected. Only a
 * legacy anonymous web visitor (no name, no email) returns null — callers
 * render their own "Anonymous visitor" fallback for that case.
 */
export function contactDisplayName(c: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): string | null {
  return c.name?.trim() || c.phone?.trim() || c.email?.trim() || null;
}

/** Two-letter avatar seed from the same rule, "·" when nothing is known. */
export function contactInitials(c: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const n = contactDisplayName(c);
  if (!n) return "·";
  // Phone numbers: last two digits read better than "+3".
  if (/^\+?\d/.test(n)) return n.replace(/\D/g, "").slice(-2) || "·";
  return n.slice(0, 2).toUpperCase();
}
