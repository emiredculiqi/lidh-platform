"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Container } from "../ui/Container";
import { siteContent } from "@/content/site";
import { useT } from "@/lib/i18n";

export function Hero() {
  const t = useT(siteContent);

  return (
    <section id="top" className="relative overflow-hidden pt-10 pb-24 sm:pt-16">
      <HeroBackdrop />

      <Container className="relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-deep/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent-orange" />
            {t.hero.eyebrow}
          </span>

          <h1 className="mt-6 font-display text-[2rem] font-extrabold leading-[1.05] tracking-tight text-balance text-brand-deep sm:text-6xl">
            {t.hero.title}{" "}
            <span className="gradient-text">{t.hero.titleAccent}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-brand-deep/75 sm:text-lg">
            {t.hero.subtitle}
          </p>

          <div className="mt-5 flex justify-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-deep/60">
              <span className="gradient-text">{t.hero.poweredBy}</span>
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#contact" className="btn-primary">
              {t.hero.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#benefits" className="btn-secondary">
              {t.hero.secondaryCta}
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-brand-deep/60">
            {t.hero.badges.map((b) => (
              <span
                key={b}
                className="rounded-full border border-brand-deep/10 bg-white/60 px-3 py-1 backdrop-blur"
              >
                {b}
              </span>
            ))}
          </div>
        </motion.div>

        <HeroVisual />
      </Container>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/25 via-white to-brand-mint/10" />

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 mix-blend-multiply"
        style={{ filter: "blur(110px)", willChange: "background-color, transform" }}
        initial={{ backgroundColor: "#1E5FDB" }}
        animate={{
          backgroundColor: ["#1E5FDB", "#0B2A6B", "#1E5FDB"],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -ml-[210px] -mt-[210px] rounded-full opacity-60 mix-blend-multiply"
        style={{ filter: "blur(80px)", willChange: "background-color, transform" }}
        initial={{ backgroundColor: "#1E5FDB" }}
        animate={{
          backgroundColor: ["#1E5FDB", "#22D3EE", "#5EEAD4", "#1E5FDB"],
          x: [0, 260, 220, -180, -240, 0],
          y: [-220, -120, 140, 180, -40, -220],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -ml-[190px] -mt-[190px] rounded-full opacity-55 mix-blend-multiply"
        style={{ filter: "blur(80px)", willChange: "background-color, transform" }}
        initial={{ backgroundColor: "#0B2A6B" }}
        animate={{
          backgroundColor: ["#0B2A6B", "#1E5FDB", "#22D3EE", "#0B2A6B"],
          x: [240, -100, -260, 60, 240],
          y: [180, 240, -60, -220, 180],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -ml-[150px] -mt-[150px] rounded-full opacity-65 mix-blend-multiply"
        style={{ filter: "blur(70px)", willChange: "background-color, transform" }}
        initial={{ backgroundColor: "#22D3EE" }}
        animate={{
          backgroundColor: ["#22D3EE", "#1E5FDB", "#5EEAD4", "#22D3EE"],
          x: [-180, 200, 60, -220, -180],
          y: [-60, 100, 220, 40, -60],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-brand-fog" />
    </div>
  );
}

function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="relative mx-auto mt-16 max-w-4xl"
    >
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-brand-gradient opacity-20 blur-3xl" />

      <div className="card-surface overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-brand-deep/5 bg-white/50 px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <span className="ml-3 text-xs font-medium text-brand-deep/50">
            lidh.al · live conversation
          </span>
        </div>

        <div className="grid gap-4 p-6 sm:p-8">
          <ChatBubble side="customer" delay={0.4}>
            Përshëndetje! A keni takim të lirë nesër në mëngjes?
          </ChatBubble>
          <ChatBubble side="bot" delay={0.9}>
            Sigurisht — kemi 09:30 dhe 11:00 të lira. Cila orë ju shkon më mirë?
          </ChatBubble>
          <ChatBubble side="customer" delay={1.4}>
            09:30 është perfekt. Si ta rezervoj?
          </ChatBubble>
          <LeadCard delay={1.9} />
        </div>
      </div>
    </motion.div>
  );
}

function ChatBubble({
  side,
  children,
  delay = 0,
}: {
  side: "customer" | "bot";
  children: React.ReactNode;
  delay?: number;
}) {
  const isBot = side === "bot";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`flex ${isBot ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isBot
            ? "bg-brand-gradient text-white"
            : "bg-white text-brand-deep border border-brand-deep/10"
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

function LeadCard({ delay = 0 }: { delay?: number }) {
  const t = useT(siteContent);
  const [name, ...contactRest] = t.hero.leadCard.contact.split(" · ");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="mt-2 rounded-2xl border border-accent-orange/30 bg-accent-orange/5 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
          {t.hero.leadCard.label}
        </span>
        <span className="text-[10px] font-medium text-brand-deep/50">
          {t.hero.leadCard.timestamp}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-sm text-brand-deep">
        <span>
          <strong>{name}</strong>
          {contactRest.length > 0 && ` · ${contactRest.join(" · ")}`}
        </span>
        <span className="text-brand-deep/70">{t.hero.leadCard.detail}</span>
      </div>
    </motion.div>
  );
}
