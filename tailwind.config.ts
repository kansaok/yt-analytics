import type { Config } from "tailwindcss";

// Token Gaya Laut (DESIGN.md) sebagai CSS variables => mengikuti tema aktif.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        sea: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          text: "var(--text)",
          muted: "var(--text-muted)",
          primary: "var(--primary)",
          "on-primary": "var(--on-primary)",
          accent: "var(--accent)",
          line: "var(--border)",
          success: "var(--success)",
          danger: "var(--danger)",
          tint: "var(--primary-tint)",
        },
      },
      borderRadius: {
        tag: "var(--radius-tag)",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        overlay: "var(--radius-overlay)",
      },
      boxShadow: { overlay: "var(--shadow-overlay)" },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: { task: "720px", overview: "1040px" },
      keyframes: { "nav-progress": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } } },
      animation: { "nav-progress": "nav-progress 1.2s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
