"use client";

import { Container } from "../ui/Container";
import { Reveal } from "../animations/Reveal";
import { siteContent } from "@/content/site";
import { useCases } from "@/content/use-cases";
import { useLocale, useT } from "@/lib/i18n";

export function UseCases() {
  const t = useT(siteContent);
  const { locale } = useLocale();

  const sorted = [...useCases].sort(
    (a, b) => Number(b.highlight ?? false) - Number(a.highlight ?? false),
  );

  return (
    <section id="use-cases" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-brand-mint/5 to-transparent" />
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-blue">
            {t.useCases.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-deep sm:text-4xl">
            {t.useCases.title}
          </h2>
          <p className="mt-4 text-brand-deep/70">{t.useCases.subtitle}</p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {sorted.map((uc, i) => {
            const Icon = uc.icon;
            return (
              <Reveal key={uc.id} delay={i * 0.06}>
                <div
                  className={`card-surface group relative h-full overflow-hidden transition hover:-translate-y-1 hover:shadow-glow ${
                    uc.highlight ? "ring-1 ring-brand-blue/20" : ""
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-deep/5 text-brand-deep transition group-hover:bg-brand-gradient group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-brand-deep">
                    {uc.title[locale]}
                  </h3>
                  <p className="mt-2 text-sm text-brand-deep/70">
                    {uc.body[locale]}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
