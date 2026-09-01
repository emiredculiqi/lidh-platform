import { describe, it, expect } from "vitest";
import {
  normalizeKeyword,
  OPT_OUT_KEYWORDS,
  OPT_IN_KEYWORDS,
} from "./whatsapp.service";

const isOptOut = (msg: string) => OPT_OUT_KEYWORDS.has(normalizeKeyword(msg));
const isOptIn = (msg: string) => OPT_IN_KEYWORDS.has(normalizeKeyword(msg));

/**
 * Consent keyword matching. Two failure modes matter and they are asymmetric:
 *   - a MISSED opt-out breaks a promise made in the published privacy policy;
 *   - a FALSE opt-out silently mutes a paying customer's real conversation,
 *     which is worse because nobody notices until the lead is lost.
 * The false-positive cases below are therefore the point of this file.
 */
describe("WhatsApp consent keywords", () => {
  describe("opt-out is recognised", () => {
    for (const msg of [
      "STOP",
      "stop",
      "Stop!",
      "  stop  ",
      "stop.",
      "UNSUBSCRIBE",
      "unsubscribe",
      "UNSUBSCRIBE 🙏",
      "NDALO",
      "ndalo",
    ]) {
      it(`"${msg}"`, () => expect(isOptOut(msg)).toBe(true));
    }

    // Albanian ç must match with or without the cedilla — the keyword set
    // stores the unaccented form and normalizeKeyword folds the accent away.
    for (const msg of ["ÇREGJISTROHU", "çregjistrohu", "Çregjistrohu.", "cregjistrohu"]) {
      it(`accent-folded: "${msg}"`, () => expect(isOptOut(msg)).toBe(true));
    }
  });

  describe("ordinary messages containing a keyword are NOT opt-outs", () => {
    for (const msg of [
      "stop by our store tomorrow",
      "can you stop sending these at night",
      "Do you have a bus stop nearby?",
      "I want to unsubscribe from your competitor",
      "ndalo makinen te hyrja",
    ]) {
      it(`"${msg}"`, () => expect(isOptOut(msg)).toBe(false));
    }
  });

  describe("unrelated messages", () => {
    for (const msg of ["Përshëndetje", "po", "faleminderit", "", "   ", "👍"]) {
      it(`"${msg}"`, () => {
        expect(isOptOut(msg)).toBe(false);
        expect(isOptIn(msg)).toBe(false);
      });
    }
  });

  describe("opt-in is recognised", () => {
    for (const msg of ["START", "start", "Start!", "subscribe", "Rifillo"]) {
      it(`"${msg}"`, () => expect(isOptIn(msg)).toBe(true));
    }
  });

  it("opt-in and opt-out sets do not overlap", () => {
    for (const k of OPT_OUT_KEYWORDS) expect(OPT_IN_KEYWORDS.has(k)).toBe(false);
  });

  it("every stored keyword is already in normalized form", () => {
    // Guards against someone adding "ÇREGJISTROHU" or "Stop" to the set, which
    // would never match because lookups happen post-normalization.
    for (const k of [...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS]) {
      expect(normalizeKeyword(k)).toBe(k);
    }
  });
});
