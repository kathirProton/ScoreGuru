import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces — dark theme. "cream" keeps its name for compatibility but
        // now maps to near-black surfaces layered by elevation.
        cream: {
          DEFAULT: "#141414", // page background ("Silver")
          50: "#0E0E0E", // deepest well
          100: "#141414", // page
          200: "#232323", // raised: inputs, rows, secondary buttons, chips
          300: "#2E2E2E", // hover / stronger surface
        },
        // Card / panel surfaces
        surface: {
          DEFAULT: "#1B1B1B",
          raised: "#242424",
        },
        // Brand — Luminous Moss neon green. Scale is intentionally non-monotonic
        // for dark mode: 50–100 are dark green tints (selected backgrounds),
        // 400 is the neon, 500–700 are bright accent TEXT, 900 is near-black
        // (text on a neon fill).
        brand: {
          DEFAULT: "#2BEE34",
          50: "#102A13", // dark tint — selected row bg
          100: "#163A1A", // dark tint
          200: "#1E5C24",
          300: "#23A02C",
          400: "#2BEE34", // neon
          500: "#48F050",
          600: "#5FF566", // bright accent text on dark
          700: "#86F98B", // lighter emphasis text
          800: "#1F4F1A",
          900: "#06210A", // near-black green — text on neon fills
        },
        // Ink — primary text (near-white, cool)
        ink: {
          DEFAULT: "#F3F5F1",
          soft: "#B9C0B7",
          muted: "#868D85",
          faint: "#5A605A",
        },
        // Destructive / out / wicket
        wicket: {
          DEFAULT: "#FF5147",
          dark: "#FF908A", // light red text on dark tint
          soft: "#331311", // dark red tint bg
        },
        // Awards
        gold: {
          DEFAULT: "#F2C230",
          dark: "#F6D573", // light gold text on dark tint
          soft: "#2C2410", // dark gold tint bg
        },
        // Boundary highlight
        boundary: "#3D9BFF",
        line: "#2E2E2E", // hairline borders on dark
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
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.35)",
        card: "0 2px 6px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.45)",
        lift: "0 10px 30px rgba(0,0,0,0.55)",
        glow: "0 6px 22px rgba(43,238,52,0.35)",
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
