import { redirect } from "next/navigation";

// AI-assistant configuration moved to the platform-admin console
// (/admin/businesses/<slug>/assistant). The business panel no longer
// configures the agent — bounce any stale link to the dashboard.
export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/tenants/${slug}`);
}
