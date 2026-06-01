import { api } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { PersonaPresetsAdmin } from "@/components/PersonaPresetsAdmin";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

// Platform-level admin screen (ADR-010). Edit the wording of the standard
// persona presets or add new ones — no deploy. Changes affect FUTURE
// tenants only (presets are copied at create time). Admin-only (ADR-013).
export default async function PersonaPresetsPage() {
  const me = await api.me();
  if (!me.user.isPlatformAdmin) {
    if (me.memberships.length === 0) redirect("/onboarding");
    redirect(`/tenants/${me.memberships[0].tenant.slug}`);
  }

  let presets;
  try {
    presets = await api.listPersonaPresets(true);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return (
      <div className="space-y-2 text-red-600">
        <p className="font-medium">
          <T
            al="Personalitetet nuk u ngarkuan."
            en="Couldn't load persona presets."
          />
        </p>
        <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs">
          {m}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          <T al="Personalitete" en="Persona presets" />
        </h1>
        <p className="mt-1 text-sm text-brand-ink/55">
          <T
            al={
              <>
                Personalitetet standarde që ofrohen kur krijon një biznes. Ndrysho
                tekstin ose shto të tuat — aplikohen vetëm te biznese{" "}
                <strong>të reja</strong> (bizneset ekzistuese ruajnë
                personalitetet e tyre; ndryshoji ato në faqen Agjenti të çdo
                biznesi).
              </>
            }
            en={
              <>
                The standard personas offered when creating a tenant. Edit the
                wording or add your own — applied to <strong>new</strong> tenants
                only (existing tenants keep their personas; tweak those on each
                tenant&apos;s Agent page).
              </>
            }
          />
        </p>
      </div>
      <PersonaPresetsAdmin initial={presets} />
    </div>
  );
}
