import { describe, it, expect } from "vitest";
import {
  applyIntakeReply,
  firstEmail,
  firstPhone,
  intakePrompt,
  intakeStep,
  looksLikeContactAttempt,
  parseName,
} from "./intake";

const empty = { name: null, email: null, phone: null };
const ana = { name: "Ana", email: null, phone: null };

describe("intake step order", () => {
  it("asks for the name first, then a contact, then is done", () => {
    expect(intakeStep(empty)).toBe("name");
    expect(intakeStep(ana)).toBe("contact");
    expect(intakeStep({ ...ana, email: "ana@x.al" })).toBe("done");
    expect(intakeStep({ ...ana, phone: "+355691234567" })).toBe("done");
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

describe("firstPhone", () => {
  it.each([
    ["069 311 3543", "+355693113543"],
    ["0693113543", "+355693113543"],
    ["69 311 3543", "+355693113543"],
    ["+355 69 311 3543", "+355693113543"],
    ["00355693113543", "+355693113543"],
    ["355693113543", "+355693113543"],
    ["+49 170 1234567", "+491701234567"],
    ["numri im: 069-311-3543 faleminderit", "+355693113543"],
  ])("%s → %s", (input, expected) => {
    expect(firstPhone(input)).toBe(expected);
  });
  it("ignores short numbers and years", () => {
    expect(firstPhone("2026")).toBeNull();
    expect(firstPhone("rreth 1500 lekë")).toBeNull();
    expect(firstPhone("Ana")).toBeNull();
  });
  it("does not read the digits of an email as a number", () => {
    expect(firstPhone("redi12345678@gmail.com")).toBeNull();
  });
});

describe("applyIntakeReply", () => {
  it("takes a name at the name prompt", () => {
    expect(applyIntakeReply(empty, "Ana")).toEqual({ ...empty, name: "Ana" });
  });
  it("completes in one message when name and a contact are volunteered", () => {
    expect(applyIntakeReply(empty, "Ana, ana@x.al")).toEqual({ ...ana, email: "ana@x.al" });
    expect(applyIntakeReply(empty, "Ana, 069 311 3543")).toEqual({ ...ana, phone: "+355693113543" });
  });
  it("accepts either an email or a phone at the contact prompt", () => {
    expect(applyIntakeReply(ana, "ana@x.al")).toEqual({ ...ana, email: "ana@x.al" });
    expect(applyIntakeReply(ana, "069 311 3543")).toEqual({ ...ana, phone: "+355693113543" });
    expect(intakeStep(applyIntakeReply(ana, "069 311 3543"))).toBe("done");
  });
  it("does not treat a reply to the contact prompt as a name", () => {
    expect(applyIntakeReply(ana, "ana@x.al").name).toBe("Ana");
  });
  it("keeps a contact typed at the name prompt and still asks for the name", () => {
    const s = applyIntakeReply(empty, "ana@x.al");
    expect(s).toEqual({ ...empty, email: "ana@x.al" });
    expect(intakeStep(s)).toBe("name");
  });
  it("a question at the name prompt leaves intake where it was", () => {
    expect(applyIntakeReply(empty, "do you deliver on Sunday?")).toEqual(empty);
  });
  it("never overwrites a detail already collected", () => {
    const full = { name: "Ana", email: "ana@x.al", phone: null };
    expect(applyIntakeReply(full, "Besnik, b@y.al")).toEqual(full);
  });

  describe("the first message, before the bot has asked anything", () => {
    it("is a greeting or a question, never a name", () => {
      expect(applyIntakeReply(empty, "Pershendetje", { asked: false })).toEqual(empty);
      expect(applyIntakeReply(empty, "Dua një ofertë", { asked: false })).toEqual(empty);
      expect(applyIntakeReply(empty, "Ana", { asked: false })).toEqual(empty);
    });
    it("still keeps a volunteered contact, and a name that came with it", () => {
      expect(applyIntakeReply(empty, "ana@x.al", { asked: false })).toEqual({
        ...empty,
        email: "ana@x.al",
      });
      expect(applyIntakeReply(empty, "Jam Ana, ana@x.al", { asked: false })).toEqual({
        ...ana,
        email: "ana@x.al",
      });
    });
  });
});

describe("intakePrompt copy", () => {
  it("is Albanian for al and English otherwise, and uses the name once known", () => {
    expect(intakePrompt("name", "al", empty)).toMatch(/quheni/);
    expect(intakePrompt("name", "en", empty)).toMatch(/your name/);
    expect(intakePrompt("contact", "en", ana)).toMatch(/Nice to meet you, Ana/);
  });

  it("says up front that a name and a contact are required, and names the business", () => {
    const al = intakePrompt("name", "al", empty, { business: "Bela Shoes" });
    expect(al).toMatch(/Bela Shoes/);
    expect(al).toMatch(/emri juaj dhe një email ose numër telefoni/);
    expect(al).toMatch(/njohim si klient/);
    const en = intakePrompt("name", "en", empty, { business: "Bela Shoes" });
    expect(en).toMatch(/welcome to Bela Shoes/);
    expect(en).toMatch(/your name and an email or phone number/);
  });

  it("asks for email OR phone, reason first, request last", () => {
    const al = intakePrompt("contact", "al", ana);
    expect(al).toMatch(/^Gëzohem që ju njoh, Ana!/);
    expect(al).toMatch(/na lini një email ose një numër telefoni\.$/);
  });

  it("answers a refusal with the reason, not with 'invalid'", () => {
    const refusal = intakePrompt("contact", "al", ana, { retry: true, reply: "Nuk dua te ta jap" });
    expect(refusal).toMatch(/nuk mund të vazhdojmë/);
    expect(refusal).toMatch(/njohim si klient/);
    expect(refusal).not.toMatch(/nuk duket/);
    const typo = intakePrompt("contact", "al", ana, { retry: true, reply: "ana@gmail" });
    expect(typo).toMatch(/nuk duket i saktë/);
    expect(typo).toMatch(/emri@shembull\.com ose 069 123 4567/);
    const shortNumber = intakePrompt("contact", "en", ana, { retry: true, reply: "069 31" });
    expect(shortNumber).toMatch(/doesn't look like a valid email or phone number/);
    expect(intakePrompt("contact", "en", ana, { retry: true, reply: "no" })).toMatch(/without one of them we can't continue/);
  });

  it("retry for the name explains that a first name is enough", () => {
    expect(intakePrompt("name", "al", empty, { retry: true })).toMatch(/mjafton emri i parë/);
  });
});

describe("looksLikeContactAttempt", () => {
  it.each([
    ["ana@gmail", true],
    ["ana at gmail.com", true],
    ["ana.b@x.al", true],
    ["069 31", true],
    ["0693113543", true],
    ["Nuk dua te ta jap", false],
    ["no thanks", false],
  ])("%s → %s", (input, expected) => {
    expect(looksLikeContactAttempt(input)).toBe(expected);
  });
});
