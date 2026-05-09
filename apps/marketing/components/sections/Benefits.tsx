"use client";

import { Clock, Zap, Database, Plug, LayoutDashboard } from "lucide-react";
import { Container } from "../ui/Container";
import { Reveal } from "../animations/Reveal";
import { siteContent } from "@/content/site";
import { useT } from "@/lib/i18n";

const icons = [Clock, Zap, Database, Plug, LayoutDashboard];

export function Benefits() {
  const t = useT(siteContent);

  return (
    <section id="benefits" className="relative py-24">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-blue">
            {t.benefits.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-deep sm:text-4xl">
            {t.benefits.title}
          </h2>
          <p className="mt-4 text-brand-deep/70">{t.benefits.subtitle}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {t.benefits.items.map((item, i) => {
            const Icon = icons[i % icons.length];
            const isOrphan =
              t.benefits.items.length % 2 === 1 &&
              i === t.benefits.items.length - 1;
            return (
              <Reveal
                key={item.title}
                delay={i * 0.08}
                className={isOrphan ? "sm:col-span-2" : undefined}
              >
                <div className="card-surface group h-full transition hover:-translate-y-1 hover:shadow-glow">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-brand-deep">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-brand-deep/70">{item.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
