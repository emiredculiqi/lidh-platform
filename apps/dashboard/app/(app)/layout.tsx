import { api } from "@/lib/api-server";
import type { Me } from "@/lib/api-server";
import { AppChrome } from "@/components/shell/AppChrome";

// Top-level authenticated shell. Reads /me once to know admin vs business.
// AppChrome renders a simple header for admin/onboarding routes and gets out
// of the way on tenant workspace routes (which provide their own sidebar shell).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let me: Me | null = null;
  try {
    me = await api.me();
  } catch {
    // /me failed (no session, network) — render bare; pages surface the error.
  }

  return (
    <AppChrome
      isAdmin={me?.user.isPlatformAdmin ?? false}
      mySlug={me?.memberships[0]?.tenant.slug ?? null}
    >
      {children}
    </AppChrome>
  );
}
