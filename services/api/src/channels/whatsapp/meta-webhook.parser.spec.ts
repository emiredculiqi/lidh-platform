import { describe, it, expect } from "vitest";
import { parseMetaWebhook } from "./meta-webhook.parser";

const PHONE_ID = "1234567890";
const WABA_ID = "9876543210";

/** Wrap a `value` payload in Meta's entry/changes envelope. */
function envelope(field: string, value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: WABA_ID, changes: [{ field, value }] }],
  };
}

const metadata = {
  display_phone_number: "+355691112222",
  phone_number_id: PHONE_ID,
};

describe("parseMetaWebhook — coexistence history", () => {
  /**
   * Direction is the subtle bit. Per Meta's payload reference a thread message
   * carries `to` ONLY when the business sent it; a customer message has `from`
   * and no `to`. Getting this backwards would attribute every past customer
   * message to the business and vice versa — silently, and only visible as a
   * scrambled inbox.
   */
  it("marks a message WITH `to` as sent by the business", () => {
    const out = parseMetaWebhook(
      envelope("history", {
        messaging_product: "whatsapp",
        metadata,
        history: [
          {
            metadata: { phase: 0, chunk_order: 1, progress: 50 },
            threads: [
              {
                id: "355699998888",
                messages: [
                  {
                    id: "wamid.OUT",
                    from: "355691112222",
                    to: "355699998888",
                    timestamp: "1750000000",
                    type: "text",
                    text: { body: "Faleminderit!" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(out.historyChunks).toHaveLength(1);
    const [msg] = out.historyChunks[0].messages;
    expect(msg.fromBusiness).toBe(true);
    expect(msg.customer).toBe("+355699998888");
    expect(msg.text).toBe("Faleminderit!");
  });

  it("marks a message WITHOUT `to` as sent by the customer", () => {
    const out = parseMetaWebhook(
      envelope("history", {
        metadata,
        history: [
          {
            metadata: { phase: 1, chunk_order: 2, progress: 75 },
            threads: [
              {
                id: "355699998888",
                messages: [
                  {
                    id: "wamid.IN",
                    from: "355699998888",
                    timestamp: "1750000001",
                    type: "text",
                    text: { body: "A jeni hapur?" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    const [msg] = out.historyChunks[0].messages;
    expect(msg.fromBusiness).toBe(false);
    expect(msg.customer).toBe("+355699998888");
  });

  it("exposes phase / chunk_order / progress for completion tracking", () => {
    const out = parseMetaWebhook(
      envelope("history", {
        metadata,
        history: [
          { metadata: { phase: 2, chunk_order: 7, progress: 100 }, threads: [] },
        ],
      }),
    );
    const chunk = out.historyChunks[0];
    expect(chunk.phase).toBe(2);
    expect(chunk.chunkOrder).toBe(7);
    expect(chunk.progress).toBe(100);
  });

  it("accepts numeric metadata delivered as strings", () => {
    const out = parseMetaWebhook(
      envelope("history", {
        metadata,
        history: [
          {
            metadata: { phase: "1", chunk_order: "3", progress: "40" },
            threads: [],
          },
        ],
      }),
    );
    expect(out.historyChunks[0].phase).toBe(1);
    expect(out.historyChunks[0].progress).toBe(40);
  });

  it("converts UNIX-second timestamps to Date", () => {
    const out = parseMetaWebhook(
      envelope("history", {
        metadata,
        history: [
          {
            metadata: { progress: 10 },
            threads: [
              {
                id: "355699998888",
                messages: [
                  {
                    id: "wamid.T",
                    from: "355699998888",
                    timestamp: "1750000000",
                    type: "text",
                    text: { body: "hi" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(out.historyChunks[0].messages[0].sentAt).toEqual(
      new Date(1_750_000_000 * 1000),
    );
  });

  it("flattens multiple threads and chunks in one webhook", () => {
    const thread = (id: string, wamid: string) => ({
      id,
      messages: [
        { id: wamid, from: id, timestamp: "1750000000", type: "text", text: { body: "x" } },
      ],
    });
    const out = parseMetaWebhook(
      envelope("history", {
        metadata,
        history: [
          { metadata: { progress: 30 }, threads: [thread("111", "a"), thread("222", "b")] },
          { metadata: { progress: 60 }, threads: [thread("333", "c")] },
        ],
      }),
    );
    expect(out.historyChunks).toHaveLength(2);
    expect(out.historyChunks[0].messages).toHaveLength(2);
    expect(out.historyChunks[1].messages).toHaveLength(1);
  });
});

describe("parseMetaWebhook — coexistence contact sync", () => {
  it("parses added contacts with a full name", () => {
    const out = parseMetaWebhook(
      envelope("smb_app_state_sync", {
        metadata,
        state_sync: [
          {
            type: "contact",
            contact: {
              full_name: "Ana Hoxha",
              first_name: "Ana",
              phone_number: "+355 69 999 8888",
            },
            action: "add",
            metadata: { timestamp: "1750000000" },
          },
        ],
      }),
    );
    expect(out.contactSync).toEqual([
      {
        businessNumber: PHONE_ID,
        phone: "+355699998888",
        fullName: "Ana Hoxha",
        action: "add",
      },
    ]);
  });

  it("preserves the remove action for the service to decide on", () => {
    const out = parseMetaWebhook(
      envelope("smb_app_state_sync", {
        metadata,
        state_sync: [
          { type: "contact", contact: { phone_number: "355699998888" }, action: "remove" },
        ],
      }),
    );
    expect(out.contactSync[0].action).toBe("remove");
  });

  it("ignores non-contact state_sync rows", () => {
    const out = parseMetaWebhook(
      envelope("smb_app_state_sync", {
        metadata,
        state_sync: [{ type: "something_else", action: "add" }],
      }),
    );
    expect(out.contactSync).toHaveLength(0);
  });
});

describe("parseMetaWebhook — robustness", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "nope"],
    ["empty object", {}],
    ["entry not an array", { entry: "x" }],
    ["changes missing value", { entry: [{ id: WABA_ID, changes: [{ field: "history" }] }] }],
  ])("returns empty buckets for %s", (_label, input) => {
    const out = parseMetaWebhook(input);
    expect(out.historyChunks).toEqual([]);
    expect(out.contactSync).toEqual([]);
    expect(out.messages).toEqual([]);
  });

  it("does not regress existing inbound message parsing", () => {
    const out = parseMetaWebhook(
      envelope("messages", {
        metadata,
        contacts: [{ wa_id: "355699998888", profile: { name: "Ana" } }],
        messages: [
          {
            id: "wamid.NEW",
            from: "355699998888",
            type: "text",
            text: { body: "Përshëndetje" },
          },
        ],
      }),
    );
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].senderName).toBe("Ana");
    expect(out.messages[0].from).toBe("+355699998888");
  });
});
