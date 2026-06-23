import { TenantNav } from "@/components/TenantNav";
import { T } from "@/components/T";
import { CopyBlock } from "@/components/CopyBlock";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.lidh.al";

export default async function DeveloperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const basic = `<script
  src="${APP_URL}/widget.js"
  data-tenant="${slug}"
  defer
></script>`;

  const advanced = `<script
  src="${APP_URL}/widget.js"
  data-tenant="${slug}"
  data-title="Përshëndetje 👋"
  data-greeting="Si mund t'ju ndihmoj sot?"
  data-color="#2563eb"
  data-locale="al"
  defer
></script>`;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">
        <T al="Integrimi" en="Developers" />
      </h1>
      <TenantNav slug={slug} active="developer" />

      <p className="max-w-2xl text-sm text-brand-ink/70">
        <T
          al="Shtoni agjentin tuaj në faqen tuaj të internetit. Kopjoni kodin më poshtë dhe ngjiteni pak para tag-ut "
          en="Add your agent to your website. Copy the snippet below and paste it just before the closing "
        />
        <code className="rounded bg-brand-ink/[0.06] px-1">
          &lt;/body&gt;
        </code>
        <T
          al=" në çdo faqe ku doni të shfaqet bisedë."
          en=" tag on every page where you want the chat to appear."
        />
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-brand-deep">
          <T al="Kodi i integrimit" en="Embed code" />
        </h2>
        <CopyBlock code={basic} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-brand-deep">
          <T al="Me opsione (jo i detyrueshëm)" en="With options (optional)" />
        </h2>
        <CopyBlock code={advanced} />
        <div className="overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["data-title", <T key="t" al="Titulli në krye të dritares" en="Title shown in the panel header" />],
                ["data-greeting", <T key="g" al="Mesazhi i parë i agjentit kur hapet biseda" en="Opening message shown when the chat opens" />],
                ["data-color", <T key="c" al="Ngjyra kryesore (hex), p.sh. #2563eb" en="Primary color (hex), e.g. #2563eb" />],
                ["data-locale", <T key="l" al="Gjuha e përgjigjeve: al ose en" en="Reply language: al or en" />],
              ].map(([attr, desc]) => (
                <tr key={attr as string} className="border-t border-brand-ink/5 first:border-t-0">
                  <td className="whitespace-nowrap px-4 py-2 align-top">
                    <code className="text-xs text-brand-blue">{attr}</code>
                  </td>
                  <td className="px-4 py-2 text-brand-ink/70">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="max-w-2xl text-xs text-brand-ink/50">
        <T
          al="Pas ngjitjes, rifreskoni faqen tuaj — do të shfaqet një buton bisede poshtë djathtas. Nuk keni faqe interneti? Përdorni lidhjen e drejtpërdrejtë te skeda Përmbledhje."
          en="After pasting, refresh your site — a chat button appears in the bottom-right. No website? Use the direct funnel link from the Overview tab."
        />
      </p>
    </div>
  );
}
