import type { ReactNode } from "react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

/** Business settings: one place, tabbed. Who answers · Channels · Widget & page. */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-6">
      <SettingsTabs slug={slug} />
      {children}
    </div>
  );
}
