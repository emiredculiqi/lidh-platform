import { describe, it, expect } from "vitest";
import { buildRetrievalQuery } from "./retrieval.service";

type Turn = { role: string; content: string };

const web = (...turns: Turn[]): Turn[] => turns;

describe("buildRetrievalQuery", () => {
  it("keeps the subject of the thread in a short follow-up", () => {
    // The case this exists for: "for my face, anti-wrinkle" has no product
    // noun, so on its own it matches masks and serums instead of creams.
    const history = web(
      { role: "user", content: "Do you have a cream?" },
      { role: "assistant", content: "Yes, we have several." },
    );
    const q = buildRetrievalQuery(history, "for my face, anti-wrinkle");

    expect(q).toContain("cream");
    expect(q).toContain("anti-wrinkle");
  });

  it("excludes assistant turns so the agent's own wording can't steer the search", () => {
    const history = web(
      { role: "user", content: "opening hours" },
      { role: "assistant", content: "We sell mattresses and bed frames." },
    );
    const q = buildRetrievalQuery(history, "and on Sunday?");

    expect(q).not.toContain("mattresses");
    expect(q).toContain("opening hours");
  });

  it("uses only the last two customer turns, not the whole thread", () => {
    const history = web(
      { role: "user", content: "ANCIENT" },
      { role: "user", content: "older" },
      { role: "user", content: "recent" },
    );
    const q = buildRetrievalQuery(history, "now");

    expect(q).toBe("older recent now");
    expect(q).not.toContain("ANCIENT");
  });

  // The two runtimes read history at different moments: the web path BEFORE
  // persisting the inbound, the WhatsApp path AFTER. The helper must behave
  // identically for both.
  describe("history that already contains the new message (WhatsApp shape)", () => {
    it("does not weight the new message twice", () => {
      const history = web(
        { role: "user", content: "Do you have a cream?" },
        { role: "assistant", content: "Yes, several." },
        { role: "user", content: "anti-wrinkle" },
      );
      const q = buildRetrievalQuery(history, "anti-wrinkle");

      expect(q).toBe("Do you have a cream? anti-wrinkle");
    });

    it("produces the same query as the web shape for the same conversation", () => {
      const priorOnly = web(
        { role: "user", content: "Do you have a cream?" },
        { role: "assistant", content: "Yes, several." },
      );
      const withInbound = [
        ...priorOnly,
        { role: "user", content: "anti-wrinkle" },
      ];

      expect(buildRetrievalQuery(withInbound, "anti-wrinkle")).toBe(
        buildRetrievalQuery(priorOnly, "anti-wrinkle"),
      );
    });

    it("still keeps an earlier turn that genuinely repeats the new message", () => {
      // Only a TRAILING duplicate is the re-read inbound; an identical question
      // asked earlier is real history and should stay.
      const history = web(
        { role: "user", content: "price?" },
        { role: "assistant", content: "Which model?" },
        { role: "user", content: "the blue one" },
      );
      const q = buildRetrievalQuery(history, "price?");

      expect(q).toBe("price? the blue one price?");
    });
  });

  it("handles a first message with no history", () => {
    expect(buildRetrievalQuery([], "Do you deliver to Durrës?")).toBe(
      "Do you deliver to Durrës?",
    );
  });

  it("caps the query so one embedding call stays cheap", () => {
    const history = web({ role: "user", content: "x".repeat(5000) });
    expect(buildRetrievalQuery(history, "y").length).toBe(1000);
  });
});
