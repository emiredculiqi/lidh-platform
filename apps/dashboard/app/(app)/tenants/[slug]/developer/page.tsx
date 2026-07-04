import { T } from "@/components/T";
import { CopyBlock } from "@/components/CopyBlock";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.lidh.al";

const CHANNELS: {
  name: string;
  dot: string;
  status: "connected" | "soon";
}[] = [
  { name: "Web Widget", dot: "bg-brand-blue", status: "connected" },
  { name: "WhatsApp Business", dot: "bg-emerald-500", status: "soon" },
  { name: "Instagram DM", dot: "bg-pink-500", status: "soon" },
  { name: "Facebook Messenger", dot: "bg-cyan-500", status: "soon" },
];

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
  data-locale="al"
  defer
></script>`;

  return (
    <div className="space-y-6">
      {/* Channels */}
      <Card>
        <h3 className="text-[15px] font-bold text-brand-deep">
          <T al="Kanalet" en="Channels" />
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <span className="text-[13.5px] font-semibold text-brand-deep">
                  {c.name}
                </span>
              </div>
              {c.status === "connected" ? (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  <T al="i lidhur" en="connected" />
                </span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  <T al="së shpejti" en="soon" />
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Embed code */}
      <Card>
        <h3 className="text-[15px] font-bold text-brand-deep">
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
