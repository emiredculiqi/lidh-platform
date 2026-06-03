"use client";

import { motion } from "framer-motion";

/**
 * Decorative animated background using brand colors. Four blurred discs of
 * different sizes orbit independently and cycle hue across the brand palette
 * (#0B2A6B / #1E5FDB / #22D3EE / #5EEAD4), composited with `mix-blend-multiply`
 * onto a soft brand-blue-to-mint base. Disc orbits span the full height so
 * color reaches the bottom of the panel, not just the vertical center.
 *
 * Usage — parent must be `relative` and (usually) `overflow-hidden`:
 *
 *     <section className="relative overflow-hidden">
 *       <AnimatedGradient />
 *       {/* content *\/}
 *     </section>
 *
 * Pure visual, no interactive state. Client component because framer-motion
 * needs the browser.
 */
export function AnimatedGradient() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/25 via-white to-brand-mint/10" />

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 mix-blend-multiply"
        style={{
          filter: "blur(110px)",
          willChange: "background-color, transform",
        }}
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
        style={{
          filter: "blur(80px)",
          willChange: "background-color, transform",
        }}
        initial={{ backgroundColor: "#1E5FDB" }}
        animate={{
          backgroundColor: ["#1E5FDB", "#22D3EE", "#5EEAD4", "#1E5FDB"],
          x: [0, 260, 220, -180, -240, 0],
          y: [-260, -120, 220, 300, -40, -260],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -ml-[190px] -mt-[190px] rounded-full opacity-55 mix-blend-multiply"
        style={{
          filter: "blur(80px)",
          willChange: "background-color, transform",
        }}
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
        style={{
          filter: "blur(70px)",
          willChange: "background-color, transform",
        }}
        initial={{ backgroundColor: "#22D3EE" }}
        animate={{
          backgroundColor: ["#22D3EE", "#1E5FDB", "#5EEAD4", "#22D3EE"],
          x: [-220, 180, 80, -240, -220],
          y: [120, -80, 300, 220, 120],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

    </div>
  );
}
