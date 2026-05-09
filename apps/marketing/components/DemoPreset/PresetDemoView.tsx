"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useT } from "@/lib/i18n";
import { PresetChat } from "./PresetChat";
import type { DemoPreset } from "@/content/demos/types";

const STRINGS = {
  al: {
    eyebrow: (name: string) => `Demo i personalizuar për ${name}`,
    titlePrefix: "Provo asistentin e trajnuar në",
    subtitle:
      "Ky asistent është përgatitur nga ekipi i Lidh.al duke përdorur katalogun, FAQ-të dhe politikat e biznesit tënd. Pyet çdo gjë që një klient mund të pyesë — për produktet, përbërësit, dorëzimin, kthimet, ose brendin.",
    indexed: (cat: number, pages: number) =>
      `Të indeksuara: ${cat} kategori · ${pages} faqe informative`,
    back: "Kthehu te Lidh.al",
    tryAskingTitle: "Provo të pyesësh:",
    tryAsking: [
      "Çfarë shamponi më rekomandon për flokë të dëmtuar?",
      "Sa kohë zgjat dorëzimi në Shqipëri?",
      "Më trego për linjën OLIOSETA.",
      "A mund ta kthej një produkt nëse nuk jam i kënaqur?",
      "A janë produktet tuaja origjinale nga Italia?",
    ],
  },
  en: {
    eyebrow: (name: string) => `Custom demo for ${name}`,
    titlePrefix: "Try the assistant trained on",
    subtitle:
      "This assistant has been prepared by the Lidh.al team using your product catalog, FAQs and policies. Ask anything a customer might ask — about products, ingredients, shipping, returns, or your brand.",
    indexed: (cat: number, pages: number) =>
      `Indexed: ${cat} categories · ${pages} information pages`,
    back: "Back to Lidh.al",
    tryAskingTitle: "Try asking:",
    tryAsking: [
      "What shampoo do you recommend for damaged hair?",
      "How long does delivery take in Albania?",
      "Tell me about the OLIOSETA line.",
      "Can I return a product if I'm not satisfied?",
      "Are your products original from Italy?",
    ],
  },
};

type Props = {
  preset: DemoPreset;
  productPagesCount: number;
  cmsPagesCount: number;
};

export function PresetDemoView({
  preset,
  productPagesCount,
  cmsPagesCount,
}: Props) {
  const t = useT(STRINGS);
  const hostname = new URL(preset.origin).hostname;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-orange">
          <Sparkles className="h-3.5 w-3.5" />
          {t.eyebrow(preset.company.name)}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-brand-deep sm:text-4xl">
          {t.titlePrefix}{" "}
          <a
            href={preset.origin}
            target="_blank"
            rel="noopener noreferrer"
            className="gradient-text hover:underline"
          >
            {hostname}
          </a>
        </h1>
        <p className="mt-4 text-brand-deep/70">{t.subtitle}</p>
        <p className="mt-3 text-xs font-medium text-brand-deep/50">
          {t.indexed(productPagesCount, cmsPagesCount)}
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <PresetChat
          slug={preset.slug}
          company={preset.company.name}
          welcome={preset.welcome}
        />
      </div>

      <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-brand-deep/10 bg-white/60 p-5 text-sm text-brand-deep/70">
        <p className="font-semibold text-brand-deep">{t.tryAskingTitle}</p>
        <ul className="mt-2 grid gap-1.5">
          {t.tryAsking.map((q) => (
            <li key={q}>• {q}</li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-8 flex max-w-2xl justify-center sm:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep/70 transition hover:text-brand-deep"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Link>
      </div>
    </Container>
  );
}
