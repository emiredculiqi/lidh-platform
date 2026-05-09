"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageToggle } from "./LanguageToggle";
import { Container } from "./ui/Container";
import { siteContent } from "@/content/site";
import { useT } from "@/lib/i18n";

export function Header() {
  const t = useT(siteContent);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition ${
        scrolled
          ? "border-b border-white/40 bg-white/70 backdrop-blur"
          : "bg-transparent"
      }`}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link href="#top" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Lidh.al"
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          <span className="font-display text-lg font-bold tracking-tight text-brand-deep">
            Lidh<span className="text-accent-orange">.</span>al
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-brand-deep/80 md:flex">
          <a href="#benefits" className="transition hover:text-brand-deep">
            {t.nav.benefits}
          </a>
          <a href="#demo" className="transition hover:text-brand-deep">
            {t.nav.demo}
          </a>
          <a href="#use-cases" className="transition hover:text-brand-deep">
            {t.nav.useCases}
          </a>
          <a href="#about" className="transition hover:text-brand-deep">
            {t.nav.about}
          </a>
          <a href="#contact" className="transition hover:text-brand-deep">
            {t.nav.contact}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <a href="#contact" className="hidden btn-primary sm:inline-flex">
            {t.nav.bookCall}
          </a>
        </div>
      </Container>
    </header>
  );
}
