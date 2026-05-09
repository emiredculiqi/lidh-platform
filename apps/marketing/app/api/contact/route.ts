import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const ContactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(1).max(40),
  business: z.string().max(120).optional().or(z.literal("")),
  preferredTime: z.string().max(120).optional().or(z.literal("")),
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[contact] validation failed", {
      received: payload,
      issues: parsed.error.flatten(),
    });
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await sendContactEmail({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      business: parsed.data.business || undefined,
      preferredTime: parsed.data.preferredTime || undefined,
      message: parsed.data.message,
    });
    console.log("[contact] email sent", { id: result.id });
  } catch (err) {
    console.error("[contact] failed to send email", err);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
