import type { Config } from "tailwindcss";

// Brand tokens mirror the lidh.al marketing site (separate repo, ADR-012)
// so the dashboard is visually a member of the same family. If a shared
// packages/ui ever lands, both apps would consume a single Tailwind preset.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: "#0B2A6B",
          blue: "#1E5FDB",
          sky: "#22D3EE",
          mint: "#5EEAD4",
          ink: "#0A0A23",
          fog: "#F8FAFC",
        },
        accent: {
          orange: "#F97316",
          orangeSoft: "#FFB07A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #0B2A6B 0%, #1E5FDB 35%, #22D3EE 70%, #5EEAD4 100%)",
      },
      boxShadow: {
        glow: "0 30px 80px -30px rgba(30, 95, 219, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
