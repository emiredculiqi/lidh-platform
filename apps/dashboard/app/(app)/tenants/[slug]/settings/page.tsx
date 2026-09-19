import { redirect } from "next/navigation";

/** /settings → the first tab. */
export default async function SettingsIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/tenants/${slug}/settings/responder`);
}
