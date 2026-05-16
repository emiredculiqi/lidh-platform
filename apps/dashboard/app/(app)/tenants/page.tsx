import Link from "next/link";
import { api } from "@/lib/api";
import { NewTenantForm } from "@/components/NewTenantForm";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  let tenants;
  try {
    tenants = await api.listTenants();
  } catch {
    return (
      <p className="text-red-600">
        Could not reach the API. Is it running on{" "}
        <code>localhost:4000</code>?
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          Tenants
        </h1>
        <NewTenantForm />
      </div>

      {tenants.length === 0 ? (
        <p className="text-brand-ink/60">
          No tenants yet. Create one to generate a demo link.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-fog text-left text-brand-ink/60">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Demo link</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-brand-ink/5 hover:bg-brand-fog/50"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/tenants/${t.slug}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-brand-ink/70">{t.slug}</td>
                  <td className="px-4 py-2">
                    {t.isDemo ? (
                      <span className="rounded bg-accent-orange/15 px-2 py-0.5 text-xs font-medium text-accent-orange">
                        demo
                      </span>
                    ) : (
                      <span className="rounded bg-brand-mint/20 px-2 py-0.5 text-xs font-medium text-brand-deep">
                        paid
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-brand-ink/60">
                    {t.demoUrl ? (
                      <code className="break-all text-xs">{t.demoUrl}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
