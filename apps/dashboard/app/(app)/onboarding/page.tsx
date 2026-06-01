import { redirect } from "next/navigation";
import { api } from "@/lib/api-server";
import { OnboardingForm } from "@/components/OnboardingForm";
import type { PersonaPreset } from "@/lib/api-server";

export const dynamic = "force-dynamic";

// First-time signup landing (ADR-013). Asks for business name + slug + a
// persona preset, then creates Tenant + Agent + Persona + web Channel +
// Membership(owner) in a single API call. If the user already has a tenant
// (or is platform admin) → send them where they belong.
export default async function OnboardingPage() {
  const me = await api.me();

  if (me.user.isPlatformAdmin) redirect("/tenants");
  if (me.memberships.length > 0) {
    redirect(`/tenants/${me.memberships[0].tenant.slug}`);
  }

  // Active presets feed the picker (same endpoint the New-tenant wizard
  // uses). If it fails the form falls back to the Custom persona option.
  let presets: PersonaPreset[];
  try {
    presets = await api.listPersonaPresets();
  } catch {
    presets = [];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          Set up your business
        </h1>
        <p className="mt-1 text-sm text-brand-ink/55">
          One short step and your AI assistant is ready to test. Welcome,{" "}
          <strong>{me.user.name ?? me.user.email}</strong>.
        </p>
      </div>
      <OnboardingForm presets={presets} />
    </div>
  );
}
