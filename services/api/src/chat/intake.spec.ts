import { describe, it, expect } from "vitest";
import {
  applyIntakeReply,
  firstEmail,
  intakePrompt,
  intakeStep,
  looksLikeEmailAttempt,
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
    // The forms people actually type (found in testing, 2026-10-05).
    ["un ja redi", "Redi"],
    ["Un jam Redi", "Redi"],
    ["une ja Era", "Era"],
    ["emri im është Era", "Era"],
    ["emri im eshte besnik hoxha", "Besnik Hoxha"],
    ["me thone Beni", "Beni"],
    ["më quajnë Arta", "Arta"],
    ["pershendetje jam Redi", "Redi"],
    ["tung, un ja Redi", "Redi"],
    ["call me Ana", "Ana"],
    ["it's Ana", "Ana"],
    ["redi", "Redi"],
    ["McDonald", "McDonald"],
  ])("%s → %s", (input, expected) => {
    expect(parseName(input)).toBe(expected);
  });

  it("refuses things that are not a name", () => {
    expect(parseName("do you deliver on Sunday?")).toBeNull();
    expect(parseName("ana@x.al")).toBeNull();
    expect(parseName("")).toBeNull();
    expect(parseName("I would like to know the price of the apartment in Tirana")).toBeNull();
    expect(parseName("12345")).toBeNull();
    // Four words after stripping is a sentence — ask again, don't store it.
    expect(parseName("nuk dua ta them tani")).toBeNull();
    expect(parseName("jam ketu per nje oferte")).toBeNull();
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
    expect(intakePrompt("email", "en", { name: "Ana", email: null })).toMatch(/Nice to meet you, Ana/);
  });

  it("says up front that name + email are required, and names the business", () => {
    const al = intakePrompt("name", "al", empty, { business: "Bela Shoes" });
    expect(al).toMatch(/Bela Shoes/);
    expect(al).toMatch(/emri dhe emaili/);
    const en = intakePrompt("name", "en", empty, { business: "Bela Shoes" });
    expect(en).toMatch(/welcome to Bela Shoes/);
    expect(en).toMatch(/we need your name and email/);
    expect(en).toMatch(/know who we're talking to/);
  });

  it("answers a refusal with the reason, not with 'invalid email'", () => {
    const ana = { name: "Ana", email: null };
    const refusal = intakePrompt("email", "al", ana, { retry: true, reply: "Nuk dua te ta jap" });
    expect(refusal).toMatch(/nuk mund të vazhdojmë/);
    expect(refusal).toMatch(/njohim si klient/);
    expect(refusal).not.toMatch(/nuk duket/);
    const typo = intakePrompt("email", "al", ana, { retry: true, reply: "ana@gmail" });
    expect(typo).toMatch(/nuk duket i saktë/);
    expect(typo).toMatch(/emri@shembull\.com/);
    expect(intakePrompt("email", "en", ana, { retry: true, reply: "no" })).toMatch(/without it we can't continue/);
  });

  it("retry for the name explains that a first name is enough", () => {
    expect(intakePrompt("name", "al", empty, { retry: true })).toMatch(/mjafton emri i parë/);
    expect(intakePrompt("name", "al", empty, { business: "Bela" })).toMatch(/njohim si klient/);
  });
});

describe("looksLikeEmailAttempt", () => {
  it.each([
    ["ana@gmail", true],
    ["ana at gmail.com", true],
    ["ana.b@x.al", true],
    ["Nuk dua te ta jap", false],
    ["no thanks", false],
  ])("%s → %s", (input, expected) => {
    expect(looksLikeEmailAttempt(input)).toBe(expected);
  });
});
