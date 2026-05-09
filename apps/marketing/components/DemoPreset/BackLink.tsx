"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";

const STRINGS = {
  al: { back: "Kthehu te Lidh.al" },
  en: { back: "Back to Lidh.al" },
};

export function BackLink() {
  const t = useT(STRINGS);
  return (
    <Link
      href="/"
      className="hidden items-center gap-1.5 text-sm font-medium text-brand-deep/70 transition hover:text-brand-deep sm:inline-flex"
    >
      <ArrowLeft className="h-4 w-4" />
      {t.back}
    </Link>
  );
}
