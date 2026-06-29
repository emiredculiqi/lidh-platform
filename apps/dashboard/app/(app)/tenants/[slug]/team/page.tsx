import { redirect } from "next/navigation";
import { api } from "@/lib/api-server";
import { TeamManager } from "@/components/team/TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The API gates this to owner/admin (403 for agents). The nav item is hidden
  // for them, but guard the direct URL too — bounce non-managers to the panel.
  const overview = await api.getTeam(slug).catch(() => null);
  if (!overview) redirect(`/tenants/${slug}`);
  return <TeamManager slug={slug} initial={overview} />;
}
