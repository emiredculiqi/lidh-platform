import { apiBase } from "@/lib/api";
import { FunnelChat } from "@/components/FunnelChat";
import { T } from "@/components/T";

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
            <T
              al="Nuk e gjetëm këtë biznes"
              en="We couldn't find this business"
            />
          </h1>
          <p className="mt-2 text-brand-ink/60">
            <T
              al="Lidhja mund të jetë e shkruar gabim. Të lutemi kontrollo URL-në dhe provo përsëri."
              en="The link may be mistyped. Please check the URL and try again."
            />
          </p>
        </div>
      </main>
    );
  }

  if (!res.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-fog px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            <T al="Diçka shkoi keq" en="Something went wrong" />
          </h1>
          <p className="mt-2 text-brand-ink/60">
            <T
              al="Po hasim vështirësi për të arritur këtë biznes në këtë moment. Provo përsëri pas pak."
              en="We're having trouble reaching this business right now. Please try again in a moment."
            />
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

  if (!funnel.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-fog px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            {funnel.name}
          </h1>
          <p className="mt-3 text-brand-ink/60">
            <T
              al="Ky biznes është momentalisht offline. Të lutemi kontaktoje drejtpërdrejt dhe kthehu më vonë."
              en="This business is currently offline. Please get in touch with them directly and check back soon."
            />
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-8">
      <FunnelChat tenantSlug={funnel.tenantSlug} businessName={funnel.name} />
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-brand-ink/40">
        <T al="Mundësuar nga Lidh.al" en="Powered by Lidh.al" />
      </p>
    </main>
  );
}
