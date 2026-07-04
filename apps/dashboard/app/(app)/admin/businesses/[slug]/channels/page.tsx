import { api } from "@/lib/api-server";
import { CopyBlock } from "@/components/CopyBlock";
import { WidgetOriginsEditor } from "@/components/WidgetOriginsEditor";
import { Card } from "@/components/ui/Card";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.lidh.al";

// Channels tab: the web widget embed snippet + allowed-origins (security).
export default async function ChannelsTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allowedOrigins = await api
    .getWebOrigins(slug)
    .then((r) => r.allowedOrigins)
    .catch(() => [] as string[]);

  const basic = `<script\n  src="${APP_URL}/widget.js"\n  data-tenant="${slug}"\n  defer\n></script>`;

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="text-[15px] font-bold text-brand-deep">
          <T al="Kodi i integrimit" en="Embed code" />
        </h3>
        <p className="mb-3 mt-1 max-w-2xl text-[13px] text-slate-500">
          <T
            al="Ngjiteni pak para tag-ut "
            en="Paste it just before the closing "
          />
          <code className="rounded bg-slate-100 px-1">&lt;/body&gt;</code>
          <T al=" në faqen e biznesit." en=" tag on the business's site." />
        </p>
        <CopyBlock code={basic} />
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold text-brand-deep">
          <T al="Origjinat e lejuara (siguri)" en="Allowed origins (security)" />
        </h3>
        <p className="mb-3 mt-1 max-w-2xl text-[13px] text-slate-500">
          <T
            al="Cilat faqe mund ta ngarkojnë widget-in. Lëre bosh për ta lejuar kudo."
            en="Which sites may load the widget. Leave empty to allow anywhere."
          />
        </p>
        <WidgetOriginsEditor slug={slug} initial={allowedOrigins} />
      </Card>
    </div>
  );
}
