import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/sections/Hero";
import { Benefits } from "@/components/sections/Benefits";
import { Demo } from "@/components/sections/Demo";
import { UseCases } from "@/components/sections/UseCases";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Benefits />
        <Demo />
        <UseCases />
        <About />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
