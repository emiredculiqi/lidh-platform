import { describe, it, expect } from "vitest";
import { conversationListWhere, MAX_QUERY_CHARS } from "./list-query";

const T = "tenant_1";

describe("conversationListWhere", () => {
  it("always scopes by tenant, hides previews and intake-pending threads", () => {
    expect(conversationListWhere(T, {})).toEqual({
      tenantId: T,
      kind: "customer",
      intakePending: false,
    });
  });

  it("keeps the intake gate even when previews are included", () => {
    const w = conversationListWhere(T, { includePreview: true });
    expect(w.kind).toBeUndefined();
    expect(w.intakePending).toBe(false);
  });

  it("filters by channel and contact stage", () => {
    const w = conversationListWhere(T, { channel: "whatsapp", stage: "lead" });
    expect(w.AND).toEqual([
      { channel: { kind: "whatsapp" } },
      { contact: { stage: "lead" } },
    ]);
  });

  it("searches the contact AND the message bodies", () => {
    const w = conversationListWhere(T, { q: "  durrës " });
    const or = (w.AND as { OR: unknown[] }[])[0].OR;
    expect(or).toHaveLength(4);
    expect(or).toContainEqual({
      contact: { name: { contains: "durrës", mode: "insensitive" } },
    });
    expect(or).toContainEqual({
      messages: {
        some: { contentText: { contains: "durrës", mode: "insensitive" } },
      },
    });
  });

  it("ignores a blank search", () => {
    expect(conversationListWhere(T, { q: "   " }).AND).toBeUndefined();
  });

  it("caps the search string", () => {
    const w = conversationListWhere(T, { q: "x".repeat(500) });
    const or = (w.AND as { OR: { contact?: { name?: { contains: string } } }[] }[])[0].OR;
    expect(or[0].contact?.name?.contains).toHaveLength(MAX_QUERY_CHARS);
  });

  it("expresses 'unanswered' as the caller's id list, empty when none", () => {
    expect(conversationListWhere(T, { only: "unanswered" }).AND).toEqual([
      { id: { in: [] } },
    ]);
    expect(
      conversationListWhere(T, { only: "unanswered" }, { awaiting: ["a", "b"] }).AND,
    ).toEqual([{ id: { in: ["a", "b"] } }]);
  });

  it("expresses 'favorites' as the user's starred id list", () => {
    expect(
      conversationListWhere(T, { only: "favorites" }, { starred: ["s1"] }).AND,
    ).toEqual([{ id: { in: ["s1"] } }]);
    expect(conversationListWhere(T, { only: "favorites" }).AND).toEqual([
      { id: { in: [] } },
    ]);
  });
});
