import "server-only";
import { sendContactEmail, type ContactPayload } from "@/lib/mailer";

export const WHATSAPP_NUMBER = "355695201250";

export type HandoffPayload = {
  reason: string;
  summary: string;
  contact?: Partial<ContactPayload>;
  transcript: string;
};

export async function emailHandoff(payload: HandoffPayload) {
  const contact = payload.contact ?? {};
  const message = [
    `Reason for handoff: ${payload.reason}`,
    "",
    `Summary: ${payload.summary}`,
    "",
    "--- Recent transcript ---",
    payload.transcript,
  ].join("\n");

  return sendContactEmail({
    name: contact.name?.trim() || "Chatbot visitor",
    email: contact.email?.trim() || "no-reply@lidh.al",
    phone: contact.phone,
    business: contact.business,
    preferredTime: contact.preferredTime,
    message,
  });
}

export async function emailLead(payload: {
  contact: Partial<ContactPayload>;
  notes: string;
  transcript: string;
}) {
  const { contact, notes, transcript } = payload;

  if (!contact.name && !contact.email && !contact.phone) {
    throw new Error("capture_lead requires at least one of name/email/phone");
  }

  const message = [
    notes,
    "",
    "--- Captured from chatbot ---",
    transcript,
  ].join("\n");

  return sendContactEmail({
    name: contact.name?.trim() || "Chatbot lead",
    email: contact.email?.trim() || "no-reply@lidh.al",
    phone: contact.phone,
    business: contact.business,
    preferredTime: contact.preferredTime,
    message,
  });
}
