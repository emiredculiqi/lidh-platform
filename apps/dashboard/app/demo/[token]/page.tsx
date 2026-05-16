import { apiBase } from "@/lib/api";
import { DemoChat } from "@/components/DemoChat";

export const dynamic = "force-dynamic";

// Public, unauthenticated (outside the (app) group; middleware doesn't gate
// /demo/*). Resolves the demo token → tenant, then renders the branded chat.
export default async function DemoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await fetch(`${apiBase}/v1/demo/${token}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const expired = res.status === 410;
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-fog px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            {expired ? "This demo has expired" : "Demo not found"}
          </h1>
          <p className="mt-2 text-brand-ink/60">
            {expired
              ? "The link is no longer active. Please ask for a fresh demo link."
              : "This demo link is invalid. Check the URL or request a new one."}
          </p>
        </div>
      </main>
    );
  }

  const demo = (await res.json()) as {
    tenantSlug: string;
    name: string;
    defaultLocale: string;
    locales: string[];
    expiresAt: string;
  };

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-8">
      <DemoChat tenantSlug={demo.tenantSlug} businessName={demo.name} />
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-brand-ink/40">
        Demo expires {new Date(demo.expiresAt).toLocaleDateString()} ·
        Lidh.al
      </p>
    </main>
  );
}
