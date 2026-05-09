/**
 * Standalone Resend diagnostic.
 * Run:  npm run test:smtp
 * Sends a test email to CONTACT_TO_EMAIL using the configured RESEND_FROM sender.
 */
import { config as loadEnv } from "dotenv";
import { Resend } from "resend";

loadEnv({ path: ".env.local" });

async function main() {
  const { RESEND_API_KEY, RESEND_FROM, CONTACT_TO_EMAIL } = process.env;

  if (!RESEND_API_KEY || !RESEND_FROM || !CONTACT_TO_EMAIL) {
    console.error("Missing RESEND_API_KEY / RESEND_FROM / CONTACT_TO_EMAIL in .env.local");
    process.exit(1);
  }

  console.log("From: ", RESEND_FROM);
  console.log("To:   ", CONTACT_TO_EMAIL);
  console.log("Key:  ", RESEND_API_KEY.slice(0, 6) + "…");

  const resend = new Resend(RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to: CONTACT_TO_EMAIL,
    subject: "Lidh.al Resend test",
    text: "If you can read this, Resend is wired up correctly.",
  });

  if (error) {
    console.error("\nResend rejected the send:", error);
    process.exit(2);
  }

  console.log("\nSent OK. Email id:", data?.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
