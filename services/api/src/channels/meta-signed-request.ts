import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta's `signed_request` — the payload format used by the app-level
 * Deauthorize and Data Deletion Request callbacks (Facebook Login for
 * Business). Wire format:
 *
 *   <base64url(HMAC-SHA256(appSecret, encodedPayload))>.<base64url(JSON)>
 *
 * Note the HMAC is computed over the ENCODED payload string, not the decoded
 * JSON — re-encoding would change the bytes and never match.
 *
 * Distinct from the WhatsApp webhook's X-Hub-Signature-256 (see
 * whatsapp.controller.ts): that signs a raw request body in a header; this is a
 * self-contained form field.
 */
export interface MetaSignedRequest {
  /** The app-scoped Meta user id that triggered the callback. */
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
  [key: string]: unknown;
}

/** Decode Meta's base64url (no padding, `-`/`_` instead of `+`/`/`). */
function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * Verify and decode a signed_request. Returns null on ANY failure — malformed
 * input, wrong algorithm, or a signature mismatch — so callers can treat a null
 * as "reject" without having to distinguish causes.
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): MetaSignedRequest | null {
  if (!signedRequest || !appSecret) return null;

  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;
  if (!encodedSig || !encodedPayload) return null;

  let expected: Buffer;
  let actual: Buffer;
  try {
    actual = fromBase64Url(encodedSig);
    expected = createHmac("sha256", appSecret)
      .update(encodedPayload)
      .digest();
  } catch {
    return null;
  }

  // timingSafeEqual throws on length mismatch — check first.
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  let payload: MetaSignedRequest;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;

  // Meta only ever signs with HMAC-SHA256. Reject anything else rather than
  // trusting a payload that claims a weaker algorithm.
  if (
    typeof payload.algorithm === "string" &&
    payload.algorithm.toUpperCase() !== "HMAC-SHA256"
  ) {
    return null;
  }

  return payload;
}

/** Build the signed_request a test (or Meta) would send. Used by specs. */
export function buildSignedRequest(
  payload: Record<string, unknown>,
  appSecret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${sig}.${encodedPayload}`;
}
