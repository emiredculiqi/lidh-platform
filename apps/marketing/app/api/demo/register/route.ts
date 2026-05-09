import { NextResponse } from "next/server";
import { z } from "zod";
import { CrawlError, crawlSite, normalizeUrl } from "@/lib/demo/crawler";
import { checkRateLimit } from "@/lib/demo/ratelimit";
import {
  createSession,
  getSession,
  hasEmailBeenUsed,
  markEmailUsed,
  setSessionFailed,
  setSessionReady,
  type DemoLead,
} from "@/lib/demo/store";
import {
  emailDemoManualPrep,
  emailDemoRegistration,
} from "@/lib/demo/leadEmail";

export const runtime = "nodejs";
export const maxDuration = 60;

const RegisterSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  company: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(4).max(40),
  websiteUrl: z.string().trim().min(3).max(200),
  locale: z.enum(["al", "en"]).default("al"),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const data = parsed.data;

  if (hasEmailBeenUsed(data.email)) {
    return NextResponse.json({ error: "already_used" }, { status: 409 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(data.websiteUrl).toString();
  } catch (err) {
    const code = err instanceof CrawlError ? err.code : "invalid_url";
    return NextResponse.json(
      { error: "invalid_url", code },
      { status: 422 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limit = checkRateLimit(ip, data.email);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", reason: limit.reason },
      { status: 429 },
    );
  }

  const lead: DemoLead = {
    firstName: data.firstName,
    lastName: data.lastName,
    company: data.company,
    email: data.email,
    phone: data.phone,
    websiteUrl: normalizedUrl,
  };

  const session = createSession(lead, data.locale);

  emailDemoRegistration(lead).catch((err) => {
    console.error("[demo/register] email failed", err);
  });

  try {
    const crawl = await crawlSite(normalizedUrl);
    setSessionReady(session.id, crawl);
    markEmailUsed(data.email);
    return NextResponse.json({
      demoId: session.id,
      status: "ready",
      pagesIndexed: crawl.pages.length,
    });
  } catch (err) {
    const code = err instanceof CrawlError ? err.code : "unreachable";
    const message = err instanceof Error ? err.message : "crawl failed";
    setSessionFailed(session.id, message);
    console.error("[demo/register] crawl failed", err);

    if (code === "invalid_url") {
      return NextResponse.json(
        { error: "invalid_url", code },
        { status: 422 },
      );
    }

    markEmailUsed(data.email);
    emailDemoManualPrep(lead, `${code}: ${message}`).catch((e) => {
      console.error("[demo/register] manual-prep email failed", e);
    });
    return NextResponse.json({
      demoId: session.id,
      status: "manual",
    });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    demoId: session.id,
    status: session.status,
    promptsUsed: session.promptsUsed,
    pagesIndexed: session.crawl?.pages.length ?? 0,
  });
}
