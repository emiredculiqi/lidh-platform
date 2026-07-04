import { api } from "@/lib/api-server";
import { FunnelPanel } from "@/components/FunnelPanel";

export const dynamic = "force-dynamic";

// Overview tab: funnel URL, plan/trial lifecycle, owner. FunnelPanel's
// admin actions (extend trial, grant plan, set owner) are enabled here.
export default async function OverviewTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await api.getTenant(slug);
  return <FunnelPanel tenant={tenant} isPlatformAdmin />;
}
