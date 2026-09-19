"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NotificationBell } from "./NotificationBell";

// Title + subtitle per section, keyed by the path suffix after /tenants/<slug>.
const TITLES: { match: (s: string) => boolean; al: [string, string]; en: [string, string] }[] = [
  { match: (s) => s === "" || s === "/", al: ["Paneli kryesor", "Pamje e përgjithshme e aktivitetit të asistentit"], en: ["Dashboard", "Overview of your assistant's activity"] },
  { match: (s) => s.startsWith("/inbox"), al: ["Bisedat", "Të gjitha bisedat nga çdo kanal"], en: ["Conversations", "All conversations across every channel"] },
  { match: (s) => s.startsWith("/contacts"), al: ["Kontakte", "Të gjithë kontaktet e biznesit tënd"], en: ["Contacts", "All your business contacts"] },
  { match: (s) => s.startsWith("/calendar"), al: ["Kalendari", "Takime dhe rezervime të kapura automatikisht"], en: ["Calendar", "Appointments & bookings captured automatically"] },
  { match: (s) => s.startsWith("/settings") || s.startsWith("/developer"), al: ["Cilësimet", "Kush përgjigjet, kanalet, widget-i dhe faqja"], en: ["Settings", "Who answers, channels, widget and page"] },
  { match: (s) => s.startsWith("/team"), al: ["Ekipi", "Anëtarët e ekipit dhe ftesat"], en: ["Team", "Team members and invitations"] },
  { match: (s) => s.startsWith("/usage"), al: ["Përdorimi", "Sa po përdoret asistenti këtë muaj"], en: ["Usage", "How much the assistant is used this month"] },
];

export function Topbar({ slug }: { slug: string }) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const al = locale === "al";

  const suffix = pathname.replace(`/tenants/${slug}`, "") || "";
  const entry = TITLES.find((t) => t.match(suffix)) ?? TITLES[0];
  const [title, sub] = al ? entry.al : entry.en;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/85 px-7 py-4 backdrop-blur">
      <div>
        <h1 className="text-[21px] font-bold tracking-tight text-brand-deep">
          {title}
        </h1>
        <p className="mt-0.5 text-[13px] text-slate-400">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell slug={slug} />
        <LanguageToggle />
      </div>
    </header>
  );
}
