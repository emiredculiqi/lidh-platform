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
  { match: (s) => s.startsWith("/leads"), al: ["Klientë potencialë", "Kontaktet e kapura nga asistenti"], en: ["Leads", "Contacts captured by the assistant"] },
  { match: (s) => s.startsWith("/developer"), al: ["Integrime", "Kanale, widget dhe origjina për zhvilluesit"], en: ["Integrations", "Channels, widget and origins for developers"] },
  { match: (s) => s.startsWith("/agent"), al: ["Asistenti AI", "Konfiguro personën, tonin dhe njohuritë"], en: ["AI Assistant", "Configure persona, tone and knowledge"] },
  { match: (s) => s.startsWith("/usage"), al: ["Përdorimi", "Sa po përdoret asistenti këtë muaj"], en: ["Usage", "How much the assistant is used this month"] },
  { match: (s) => s.startsWith("/test"), al: ["Testo agjentin", "Provoje asistentin para se ta nisësh"], en: ["Test agent", "Try the assistant before going live"] },
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
        <div className="relative hidden sm:block">
          <input
            placeholder={al ? "Kërko…" : "Search…"}
            className="w-[200px] rounded-[10px] border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[13px] text-brand-ink outline-none focus:border-brand-blue"
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            className="absolute left-3 top-2.5"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
        </div>
        <NotificationBell slug={slug} />
        <LanguageToggle />
      </div>
    </header>
  );
}
