import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BackLink } from "@/components/DemoPreset/BackLink";
import { PresetDemoView } from "@/components/DemoPreset/PresetDemoView";
import { loadPreset } from "@/lib/demo/preset";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const preset = loadPreset(slug);
  if (!preset) return { title: "Demo not found" };
  return {
    title: `${preset.company.name} · Demo`,
    description: `Live demo of a Lidh.al assistant trained on ${preset.company.name}'s website.`,
    robots: { index: false, follow: false },
  };
}

export default async function PresetDemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const preset = loadPreset(slug);
  if (!preset) notFound();

  const productPagesCount = preset.pages.filter((p) =>
    p.title.startsWith("Category:"),
  ).length;
  const cmsPagesCount = preset.pages.length - productPagesCount - 1;

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-fog/40 to-white">
      <header className="border-b border-brand-deep/10 bg-white/70 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
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
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <BackLink />
          </div>
        </Container>
      </header>

      <PresetDemoView
        preset={preset}
        productPagesCount={productPagesCount}
        cmsPagesCount={cmsPagesCount}
      />
    </main>
  );
}
