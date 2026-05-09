import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
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
        "hero-base":
          "linear-gradient(180deg, rgba(30,95,219,0.10) 0%, rgba(248,250,252,0) 70%)",
      },
      boxShadow: {
        glow: "0 30px 80px -30px rgba(30, 95, 219, 0.45)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite",
        "gradient-shift": "gradient-shift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
