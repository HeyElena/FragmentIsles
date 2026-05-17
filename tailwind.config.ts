import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-solid-rgb) / <alpha-value>)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        sage: "rgb(var(--sage-rgb) / <alpha-value>)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        input: "rgb(var(--border-rgb) / <alpha-value>)",
        ring: "rgb(var(--primary-rgb) / <alpha-value>)",
        card: "rgb(var(--surface-solid-rgb) / <alpha-value>)",
      },
      backgroundImage: {
        "isles-glow":
          "radial-gradient(circle at top, rgba(115, 129, 73, 0.28), transparent 34%), radial-gradient(circle at bottom right, rgba(110, 82, 54, 0.22), transparent 40%), linear-gradient(180deg, rgba(248,242,232,0.36), rgba(255,255,255,0))",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2rem",
      },
      boxShadow: {
        shell: "0 24px 70px rgba(58, 54, 37, 0.16)",
        float: "0 18px 45px rgba(78, 102, 64, 0.18)",
        paper: "0 10px 28px rgba(56, 47, 33, 0.14)",
      },
      fontFamily: {
        sans: ["'Avenir Next'", "Avenir", "'Segoe UI'", "sans-serif"],
        serif: ["'Iowan Old Style'", "'Palatino Linotype'", "serif"],
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -8px, 0)" },
        },
      },
      animation: {
        drift: "drift 7s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
