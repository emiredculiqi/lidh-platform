import Link from "next/link";
import { api, type PersonaPreset } from "@/lib/api-server";
import { NewTenantWizard } from "@/components/NewTenantWizard";

export const dynamic = "force-dynamic";

export default async function NewTenantPage() {
  // Presets feed the persona picker; if the call fails the wizard still
  // works via the "Custom" persona option.
  let presets: PersonaPreset[];
  try {
    presets = await api.listPersonaPresets();
  } catch {
    presets = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tenants"
          className="text-sm text-brand-blue hover:underline"
        >
          ← Tenants
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-brand-deep">
          New tenant
        </h1>
        <p className="mt-1 text-sm text-brand-ink/55">
          Set up the business, its agent persona, demo link and initial
          knowledge — all in one place.
        </p>
      </div>
      <NewTenantWizard presets={presets} />
    </div>
  );
}
