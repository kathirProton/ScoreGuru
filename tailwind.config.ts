import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        cream: {
          DEFAULT: "#FFFDF1", // warm off-white background
          50: "#FFFEFA",
          100: "#FFFDF1",
          200: "#F7F4E4",
          300: "#ECE8D4",
        },
        // Brand green — bright, for fills/buttons/accents only
        brand: {
          DEFAULT: "#59C749",
          50: "#EEFBEB",
          100: "#D6F5CF",
          200: "#A9E89C",
          300: "#7FDB6E",
          400: "#59C749", // hero green
          500: "#3FA831",
          600: "#2F8526", // AA text-on-cream
          700: "#26681F",
          800: "#1F4F1A",
          900: "#163813",
        },
        // Ink — primary text (green-tinted charcoal)
        ink: {
          DEFAULT: "#16231A",
          soft: "#3A4A3C",
          muted: "#6B7A6D",
          faint: "#9AA79B",
        },
        // Destructive / out / wicket
        wicket: {
          DEFAULT: "#E23D33",
          dark: "#B72A22",
          soft: "#FBE6E4",
        },
        // Awards
        gold: {
          DEFAULT: "#D9A300",
          dark: "#A87D00",
          soft: "#FBF1CF",
        },
        // Boundary highlight
        boundary: "#1E7FD6",
        line: "#E7E3D2", // hairline borders
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(22,35,26,0.04), 0 4px 16px rgba(22,35,26,0.06)",
        card: "0 2px 6px rgba(22,35,26,0.05), 0 12px 32px rgba(22,35,26,0.07)",
        lift: "0 8px 24px rgba(22,35,26,0.12)",
        glow: "0 6px 20px rgba(89,199,73,0.35)",
      },
      keyframes: {
        "count-pop": {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "boundary-burst": {
          "0%": { transform: "scale(0.2)", opacity: "0" },
          "40%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "count-pop": "count-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        "boundary-burst": "boundary-burst 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
};

export default config;
