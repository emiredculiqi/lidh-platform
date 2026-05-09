"use client";

import { Container } from "./ui/Container";
import { siteContent } from "@/content/site";
import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT(siteContent);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-32 border-t border-brand-deep/10 bg-white/40 py-12 backdrop-blur">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <div className="font-display text-xl font-bold text-brand-deep">
            Lidh<span className="text-accent-orange">.</span>al
          </div>
          <p className="mt-1 max-w-md text-sm text-brand-deep/70">
            {t.footer.tagline}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-brand-deep/70 md:items-end">
          <a
            href="mailto:info@lidh.al"
            className="font-medium text-brand-deep transition hover:text-brand-blue"
          >
            info@lidh.al
          </a>
          <span>
            © {year} Lidh.al · {t.footer.rights}
          </span>
        </div>
      </Container>
    </footer>
  );
}
