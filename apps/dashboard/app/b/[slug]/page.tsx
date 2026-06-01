import { apiBase } from "@/lib/api";
import { DemoChat } from "@/components/DemoChat";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated funnel page (ADR-014). Lives outside the (app)
 * route group so Clerk's middleware doesn't gate it. Replaces the legacy
 * /demo/[token] flow with a permanent slug-based URL.
 *
 *   GET /b/:slug
 *     - 404 → branded "not found" page (slug doesn't exist).
 *     - isActive=true → render branded chat (booted from tenantSlug).
 *     - isActive=false → branded "currently offline" message. The URL stays
 *       valid; the *service* is what's gated. Reactivating the tenant (admin
 *       extends trial / grants plan / reactivates from archive) brings the
 *       chat back without the SMB having to update anywhere they shared the
 *       link.
 */
export default async function FunnelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const res = await fetch(`${apiBase}/v1/funnel/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-fog px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            We couldn&apos;t find this business
          </h1>
          <p className="mt-2 text-brand-ink/60">
            The link may be mistyped. Please check the URL and try again.
          </p>
        </div>
      </main>
    );
  }

  if (!res.ok) {
    // 5xx or unexpected — surface generically without leaking detail.
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-fog px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            Something went wrong
          </h1>
          <p className="mt-2 text-brand-ink/60">
            We&apos;re having trouble reaching this business right now.
            Please try again in a moment.
          </p>
        </div>
      </main>
    );
  }

  const funnel = (await res.json()) as {
    tenantSlug: string;
    name: string;
    defaultLocale: string;
    locales: string[];
    isActive: boolean;
  };

  // Inactive → trial expired without a plan, plan lapsed, or archived.
  // We show the BUSINESS NAME but no Lidh.al-billing chrome — keeps the SMB's
  // brand intact in front of their own customers.
  if (!funnel.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-fog px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            {funnel.name}
          </h1>
          <p className="mt-3 text-brand-ink/60">
            This business is currently offline. Please get in touch with them
            directly and check back soon.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-8">
      <DemoChat tenantSlug={funnel.tenantSlug} businessName={funnel.name} />
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-brand-ink/40">
        Powered by Lidh.al
      </p>
    </main>
  );
}
