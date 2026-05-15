import { headers } from "next/headers";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

// Clerk webhook receiver. M1: verifies the signature and logs the event type.
// M2: upserts/deletes our User row in @lidh/db when these fire:
//   - user.created / user.updated → prisma.user.upsert(...)
//   - user.deleted → prisma.user.delete(...) (cascade purges memberships)
//
// Configure in the Clerk dashboard:
//   1. Webhooks → Add endpoint → https://<public-url>/api/webhooks/clerk
//   2. Subscribe to: user.created, user.updated, user.deleted
//   3. Copy "Signing secret" → set as CLERK_WEBHOOK_SECRET in .env(.local)
//
// In local dev you'll want `ngrok http 3001` to expose the dashboard publicly,
// then point Clerk at the ngrok URL.

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("CLERK_WEBHOOK_SECRET not configured (M1 stub)", {
      status: 503,
    });
  }

  const headerList = await headers();
  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix-* headers", { status: 400 });
  }

  const payload = await req.text();

  let event: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response(
      `Signature verification failed: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 400 },
    );
  }

  // M1: just log. M2 replaces this switch with @lidh/db upserts.
  // eslint-disable-next-line no-console
  console.log(
    `[clerk-webhook] received event=${event.type} clerkId=${"id" in event.data ? event.data.id : "?"}`,
  );

  switch (event.type) {
    case "user.created":
      // M2: prisma.user.create({ data: mapClerkUser(event.data) })
      break;
    case "user.updated":
      // M2: prisma.user.update({ where: { clerkId: event.data.id }, data: ... })
      break;
    case "user.deleted":
      // M2: prisma.user.delete({ where: { clerkId: event.data.id } })
      break;
    default:
      // Unhandled event types are not an error — Clerk emits many we don't care about.
      break;
  }

  return new Response("ok", { status: 200 });
}
