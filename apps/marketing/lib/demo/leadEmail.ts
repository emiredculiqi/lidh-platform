import "server-only";
import { sendContactEmail } from "@/lib/mailer";
import type { DemoLead } from "./store";

export async function emailDemoRegistration(lead: DemoLead) {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const message = [
    "New demo registration from lidh.al website.",
    "",
    `Website to demo: ${lead.websiteUrl}`,
    "",
    "The visitor will try the live preview assistant on their own site (3-prompt cap).",
  ].join("\n");

  return sendContactEmail({
    name: fullName || "Demo visitor",
    email: lead.email,
    phone: lead.phone,
    business: lead.company,
    message,
  });
}

export async function emailDemoManualPrep(
  lead: DemoLead,
  failureReason: string,
) {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const message = [
    "🚨 MANUAL DEMO PREP NEEDED",
    "",
    "The automated demo crawler could not handle this visitor's website.",
    "The visitor has been told their custom demo is being prepared and the team will reach out within 24 hours.",
    "",
    `Website: ${lead.websiteUrl}`,
    `Why automation failed: ${failureReason}`,
    "",
    "Action required:",
    "1. Inspect the site to find the right data source (public API, sitemap, headless scrape).",
    "2. Build a preset at content/demos/<slug>.json (see scripts/scrape-barex.ts as a reference).",
    "3. Reply to the prospect with the private link: https://lidh.al/d/<slug>",
    "4. Target turnaround: 24 hours.",
  ].join("\n");

  return sendContactEmail({
    name: fullName || "Demo visitor",
    email: lead.email,
    phone: lead.phone,
    business: lead.company,
    message,
  });
}
