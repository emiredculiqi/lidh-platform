"use client";

import { Check } from "lucide-react";
import { Container } from "../ui/Container";
import { Reveal } from "../animations/Reveal";
import { siteContent } from "@/content/site";
import { useT } from "@/lib/i18n";

export function About() {
  const t = useT(siteContent);

  return (
    <section id="about" className="relative py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-blue">
            {t.about.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-deep sm:text-4xl">
            {t.about.title}
          </h2>
          <div className="mt-5 space-y-4 text-brand-deep/75">
            {t.about.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <ul className="mt-7 space-y-3">
            {t.about.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-brand-deep">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-gradient text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[36px] bg-brand-gradient opacity-25 blur-3xl" />
            <div className="card-surface space-y-4">
              <Stat value="< 24h" label={{ al: "Implementim", en: "Onboarding" }} />
              <Stat value="24/7" label={{ al: "Mbështetje", en: "Support" }} />
              <Stat value="100%" label={{ al: "Të dhënat janë tuajat", en: "Your data stays yours" }} />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function Stat({
  value,
  label,
}: {
  value: string;
  label: { al: string; en: string };
}) {
  const text = useT(label);
  return (
    <div className="flex items-baseline justify-between border-b border-brand-deep/10 pb-3 last:border-none last:pb-0">
      <span className="font-display text-3xl font-extrabold text-brand-deep">
        {value}
      </span>
      <span className="text-sm font-medium text-brand-deep/70">{text}</span>
    </div>
  );
}
