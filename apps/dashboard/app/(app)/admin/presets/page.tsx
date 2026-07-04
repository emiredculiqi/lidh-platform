import { api } from "@/lib/api-server";
import { PersonaPresetsAdmin } from "@/components/PersonaPresetsAdmin";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

// Persona presets management, inside the admin console (the /admin layout
// already gates to platform admins). The standard personas offered when
// creating a NEW business — existing businesses keep their personas (edit
// those per-business in the Assistant tab).
export default async function AdminPresetsPage() {
  let presets;
  try {
    presets = await api.listPersonaPresets(true);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return (
      <div className="mx-auto max-w-4xl space-y-2 text-red-600">
        <p className="font-medium">
          <T
            al="Personalitetet nuk u ngarkuan."
            en="Couldn't load persona presets."
          />
        </p>
        <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs">{m}</pre>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-brand-deep">
          <T al="Personalitete" en="Persona presets" />
        </h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          <T
            al="Personalitetet standarde që ofrohen kur krijon një biznes të ri — aplikohen vetëm te bizneset e reja."
            en="The standard personas offered when creating a new business — applied to new businesses only."
          />
        </p>
      </div>
      <PersonaPresetsAdmin initial={presets} />
    </div>
  );
}
