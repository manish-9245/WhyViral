import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        ink: "hsl(var(--ink))",
        paper: "hsl(var(--paper))",
        stone: "hsl(var(--stone))",
        amber: "hsl(var(--amber))",
        line: "hsl(var(--line))",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: { sans: ["var(--font-geist-sans)"], mono: ["var(--font-geist-mono)"], display: ["var(--font-sora)"] },
      boxShadow: {
        evidence: "0 1px 0 0 hsl(var(--line)), 0 8px 24px -12px rgba(10,10,11,0.08)",
        pin: "0 1px 3px rgba(10,10,11,0.12), 0 0 0 1px hsl(var(--ink))",
      },
      keyframes: {
        "string-draw": { "0%": { strokeDashoffset: "24" }, "100%": { strokeDashoffset: "0" } },
        "log-in": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "string-draw": "string-draw 600ms cubic-bezier(0.16,1,0.3,1)",
        "log-in": "log-in 340ms cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
export default config;
