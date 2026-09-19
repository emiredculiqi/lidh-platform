import { describe, it, expect } from "vitest";
import {
  applyIntakeReply,
  firstEmail,
  intakePrompt,
  intakeStep,
  parseName,
} from "./intake";

const empty = { name: null, email: null };

describe("intake step order", () => {
  it("asks for the name first, then the email, then is done", () => {
    expect(intakeStep(empty)).toBe("name");
    expect(intakeStep({ name: "Ana", email: null })).toBe("email");
    expect(intakeStep({ name: "Ana", email: "ana@x.al" })).toBe("done");
  });
});

describe("parseName", () => {
  it.each([
    ["Ana", "Ana"],
    ["I'm Ana", "Ana"],
    ["my name is Ana B.", "Ana B"],
    ["Jam Ana", "Ana"],
    ["Unë jam Besnik Hoxha", "Besnik Hoxha"],
    ["Përshëndetje, quhem Era", "Era"],
    ["Ana, ana@x.al", "Ana"],
  ])("%s → %s", (input, expected) => {
    expect(parseName(input)).toBe(expected);
  });

  it("refuses things that are not a name", () => {
    expect(parseName("do you deliver on Sunday?")).toBeNull();
    expect(parseName("ana@x.al")).toBeNull();
    expect(parseName("")).toBeNull();
    expect(parseName("I would like to know the price of the apartment in Tirana")).toBeNull();
    expect(parseName("12345")).toBeNull();
  });
});

describe("firstEmail", () => {
  it("finds and lowercases an address inside text", () => {
    expect(firstEmail("it's Ana.B@Gmail.com thanks")).toBe("ana.b@gmail.com");
  });
  it("rejects near-misses", () => {
    expect(firstEmail("ana at gmail")).toBeNull();
    expect(firstEmail("ana@gmail")).toBeNull();
  });
});

describe("applyIntakeReply", () => {
  it("takes a name at the name prompt", () => {
    expect(applyIntakeReply(empty, "Ana")).toEqual({ name: "Ana", email: null });
  });
  it("completes in one message when both are volunteered", () => {
    expect(applyIntakeReply(empty, "Ana, ana@x.al")).toEqual({ name: "Ana", email: "ana@x.al" });
  });
  it("does not treat a reply to the email prompt as a name", () => {
    const s = applyIntakeReply({ name: "Ana", email: null }, "ana@x.al");
    expect(s).toEqual({ name: "Ana", email: "ana@x.al" });
  });
  it("keeps an email typed at the name prompt and still asks for the name", () => {
    const s = applyIntakeReply(empty, "ana@x.al");
    expect(s).toEqual({ name: null, email: "ana@x.al" });
    expect(intakeStep(s)).toBe("name");
  });
  it("a question at the name prompt leaves intake where it was", () => {
    const s = applyIntakeReply(empty, "do you deliver on Sunday?");
    expect(s).toEqual(empty);
  });
  it("never overwrites a detail already collected", () => {
    const s = applyIntakeReply({ name: "Ana", email: "ana@x.al" }, "Besnik, b@y.al");
    expect(s).toEqual({ name: "Ana", email: "ana@x.al" });
  });

  describe("the first message, before the bot has asked anything", () => {
    it("is a greeting or a question, never a name", () => {
      expect(applyIntakeReply(empty, "Pershendetje", { asked: false })).toEqual(empty);
      expect(applyIntakeReply(empty, "Dua një ofertë", { asked: false })).toEqual(empty);
      expect(applyIntakeReply(empty, "Ana", { asked: false })).toEqual(empty);
    });
    it("still keeps a volunteered email, and a name that came with it", () => {
      expect(applyIntakeReply(empty, "ana@x.al", { asked: false })).toEqual({
        name: null,
        email: "ana@x.al",
      });
      expect(applyIntakeReply(empty, "Jam Ana, ana@x.al", { asked: false })).toEqual({
        name: "Ana",
        email: "ana@x.al",
      });
    });
  });
});

describe("intakePrompt copy", () => {
  it("is Albanian for al and English otherwise, and uses the name once known", () => {
    expect(intakePrompt("name", "al", empty)).toMatch(/quheni/);
    expect(intakePrompt("name", "en", empty)).toMatch(/your name/);
    expect(intakePrompt("email", "en", { name: "Ana", email: null })).toMatch(/Thanks, Ana/);
    expect(intakePrompt("email", "al", { name: "Ana", email: null }, { retry: true })).toMatch(/nuk duket/i);
  });
});
