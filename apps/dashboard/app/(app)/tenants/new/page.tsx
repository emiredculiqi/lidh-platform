import Link from "next/link";
import { api, type PersonaPreset } from "@/lib/api-server";
import { NewTenantWizard } from "@/components/NewTenantWizard";
import { T } from "@/components/T";

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
          ← <T al="Bizneset" en="Tenants" />
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-brand-deep">
          <T al="Biznes i ri" en="New tenant" />
        </h1>
        <p className="mt-1 text-sm text-brand-ink/55">
          <T
            al="Konfiguro biznesin, personalitetin e agjentit, URL-në e funelit dhe njohuritë fillestare — të gjitha në një vend."
            en="Set up the business, its agent persona, funnel URL and initial knowledge — all in one place."
          />
        </p>
      </div>
      <NewTenantWizard presets={presets} />
    </div>
  );
}
