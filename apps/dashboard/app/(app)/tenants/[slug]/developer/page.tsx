import { redirect } from "next/navigation";

/** Integrations moved into Settings (Channels + Widget & page). Old links land here. */
export default async function DeveloperRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/tenants/${slug}/settings/channels`);
}
