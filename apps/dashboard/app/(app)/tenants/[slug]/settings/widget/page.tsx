import Link from "next/link";
import { T } from "@/components/T";
import { CopyBlock } from "@/components/CopyBlock";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api-server";
import type { Tenant } from "@/lib/api-core";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.lidh.al";

/** Settings › Widget & page — the public chat page link and the embed code. */
export default async function WidgetSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let tenant: Tenant | null = null;
  try {
    tenant = await api.getTenant(slug);
  } catch {
    tenant = null;
  }

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
  data-locale="al"
  defer
></script>`;

  return (
    <div className="space-y-6">
      {/* Public page — the shareable link customers can chat on without a widget */}
      <Card className="bg-gradient-to-br from-brand-deep to-[#071E4F] text-white">
        <div className="text-[12px] font-semibold text-brand-sky">
          <T al="✦ FAQJA JOTE" en="✦ YOUR PAGE" />
        </div>
        <p className="mt-2 text-[13px] text-[#CADBF5]">
          <T
            al="Ndaje këtë lidhje kudo — klientët mund të shkruajnë pa pasur nevojë për widget."
            en="Share this link anywhere — customers can message you without needing the widget."
          />
        </p>
        {tenant?.funnelUrl ? (
          <a
            href={tenant.funnelUrl}
            target="_blank"
            rel="noopener"
            className="mt-3 block break-all rounded-lg bg-white/10 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-white/15"
          >
            {tenant.funnelUrl.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
        <Link
          href="#embed"
          className="mt-3 inline-block text-[12.5px] font-semibold text-brand-sky hover:underline"
        >
          <T al="Kodi i widget-it është më poshtë ↓" en="Widget code is below ↓" />
        </Link>
      </Card>

      {/* Embed code */}
      <Card>
        <h3 id="embed" className="text-[15px] font-bold text-brand-deep">
          <T al="Kodi i integrimit" en="Embed code" />
        </h3>
        <p className="mb-3 mt-1 max-w-2xl text-sm text-slate-500">
          <T
            al="Kopjoni kodin dhe ngjiteni pak para tag-ut "
            en="Copy the snippet and paste it just before the closing "
          />
          <code className="rounded bg-slate-100 px-1">&lt;/body&gt;</code>
          <T
            al=" në faqen tuaj."
            en=" tag on your site."
          />
        </p>
        <CopyBlock code={basic} />
      </Card>

      {/* Advanced */}
      <Card>
        <h3 className="text-[15px] font-bold text-brand-deep">
          <T al="Me opsione (jo i detyrueshëm)" en="With options (optional)" />
        </h3>
        <div className="mt-3">
          <CopyBlock code={advanced} />
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {[
                ["data-title", <T key="t" al="Titulli në krye të dritares" en="Title in the panel header" />],
                ["data-greeting", <T key="g" al="Mesazhi i parë kur hapet biseda" en="Opening message when the chat opens" />],
                ["data-locale", <T key="l" al="Gjuha e përgjigjeve: al ose en" en="Reply language: al or en" />],
              ].map(([attr, desc]) => (
                <tr key={attr as string}>
                  <td className="whitespace-nowrap px-4 py-2.5 align-top">
                    <code className="text-xs text-brand-blue">{attr}</code>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
