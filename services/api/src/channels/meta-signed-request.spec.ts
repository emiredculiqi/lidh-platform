import { describe, it, expect } from "vitest";
import {
  parseSignedRequest,
  buildSignedRequest,
} from "./meta-signed-request";

const SECRET = "test-app-secret";

describe("parseSignedRequest", () => {
  it("accepts a correctly signed payload and returns it", () => {
    const signed = buildSignedRequest(
      { user_id: "12345", algorithm: "HMAC-SHA256", issued_at: 1_700_000_000 },
      SECRET,
    );
    const out = parseSignedRequest(signed, SECRET);
    expect(out).not.toBeNull();
    expect(out?.user_id).toBe("12345");
    expect(out?.issued_at).toBe(1_700_000_000);
  });

  it("rejects a payload signed with a different secret", () => {
    const signed = buildSignedRequest({ user_id: "1" }, "attacker-secret");
    expect(parseSignedRequest(signed, SECRET)).toBeNull();
  });

  it("rejects a tampered payload whose signature no longer matches", () => {
    const signed = buildSignedRequest({ user_id: "victim" }, SECRET);
    const [sig] = signed.split(".");
    const forged = Buffer.from(JSON.stringify({ user_id: "attacker" }), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull();
  });

  it("rejects a downgraded algorithm even when the HMAC is valid", () => {
    // An attacker who somehow got a valid HMAC must still not be able to talk
    // us into honouring a weaker declared algorithm.
    const signed = buildSignedRequest(
      { user_id: "1", algorithm: "none" },
      SECRET,
    );
    expect(parseSignedRequest(signed, SECRET)).toBeNull();
  });

  it.each([
    ["empty string", ""],
    ["no separator", "abcdef"],
    ["too many parts", "a.b.c"],
    ["empty signature", ".eyJ1c2VyX2lkIjoiMSJ9"],
    ["empty payload", "c2ln."],
    ["non-JSON payload", buildSignedRequest({}, SECRET).split(".")[0] + ".bm90anNvbg"],
  ])("rejects malformed input: %s", (_label, input) => {
    expect(parseSignedRequest(input, SECRET)).toBeNull();
  });

  it("rejects when no app secret is configured", () => {
    const signed = buildSignedRequest({ user_id: "1" }, SECRET);
    expect(parseSignedRequest(signed, "")).toBeNull();
  });

  it("does not throw on a signature of the wrong byte length", () => {
    // timingSafeEqual throws on length mismatch; we must return null instead.
    const [, payload] = buildSignedRequest({ user_id: "1" }, SECRET).split(".");
    expect(() => parseSignedRequest(`YWJj.${payload}`, SECRET)).not.toThrow();
    expect(parseSignedRequest(`YWJj.${payload}`, SECRET)).toBeNull();
  });

  it("round-trips base64url payloads containing + and / bytes", () => {
    // Values chosen to produce non-alphanumeric base64 characters.
    const payload = { user_id: "1", note: "??>>>???~~~ûüç" };
    const signed = buildSignedRequest(payload, SECRET);
    expect(signed).not.toMatch(/[+/=]/);
    expect(parseSignedRequest(signed, SECRET)?.note).toBe(payload.note);
  });
});
