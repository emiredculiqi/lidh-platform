import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { ConnectWhatsApp } from "@/components/ConnectWhatsApp";
import { api, type ChannelStatus } from "@/lib/api-server";

export const dynamic = "force-dynamic";

// WhatsApp is interactive (connect flow) so it's rendered separately; these
// are the static status pills.
const OTHER_CHANNELS: {
  name: string;
  dot: string;
  status: "connected" | "soon";
}[] = [
  { name: "Web Widget", dot: "bg-brand-blue", status: "connected" },
  { name: "Instagram DM", dot: "bg-pink-500", status: "soon" },
  { name: "Facebook Messenger", dot: "bg-cyan-500", status: "soon" },
];

/** Settings › Channels — where a business connects the places customers write from. */
export default async function ChannelsSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let whatsapp: ChannelStatus | null = null;
  try {
    const channels = await api.getChannels(slug);
    whatsapp = channels.find((c) => c.kind === "whatsapp") ?? null;
  } catch {
    whatsapp = null; // API unreachable → treat as not connected
  }

  return (
    <Card>
      <h3 className="text-[15px] font-bold text-brand-deep">
        <T al="Kanalet" en="Channels" />
      </h3>
      <p className="mt-1 text-[13px] text-slate-500">
        <T
          al="Lidh kanalet ku klientët të shkruajnë. Të gjitha bisedat mbërrijnë në të njëjtin inbox."
          en="Connect the channels your customers write on. Every conversation lands in the same inbox."
        />
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* WhatsApp — interactive connect flow (spans the row). */}
        <div className="rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2">
          <ConnectWhatsApp slug={slug} initial={whatsapp} />
        </div>
        {OTHER_CHANNELS.map((c) => (
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
  );
}
