/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B1020",
        card: "#131A2A",
        cardSecondary: "#181F32",
        accent: "#6C63FF",
        success: "#34D399",
        danger: "#FF5D73",
        textPrimary: "#FFFFFF",
        textSecondary: "#B8C0D0",
        textMuted: "#7E8798",
        borderCustom: "rgba(255, 255, 255, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 15px rgba(108, 99, 255, 0.35)",
        dangerGlow: "0 0 15px rgba(255, 93, 115, 0.35)",
      }
    },
  },
  plugins: [],
}
