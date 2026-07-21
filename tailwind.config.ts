import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1A1C1E",
          muted: "#5C6570",
          faint: "#8B939E",
        },
        mist: {
          50: "#F7F8FA",
          100: "#EEF1F4",
          200: "#E2E6EB",
          300: "#C9D0D8",
        },
        accent: {
          DEFAULT: "#3D5A80",
          soft: "#E8EEF5",
          strong: "#2E4563",
        },
        // Keep legacy brand/sand aliases mapped to the calm system so existing
        // components keep working during the Stage 1 migration.
        brand: {
          50: "#F7F8FA",
          100: "#EEF1F4",
          200: "#E2E6EB",
          300: "#C9D0D8",
          400: "#8B939E",
          500: "#5C6570",
          600: "#3D5A80",
          700: "#2E4563",
          800: "#243652",
          900: "#1A1C1E",
        },
        sand: {
          50: "#F7F8FA",
          100: "#EEF1F4",
          200: "#E2E6EB",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26, 28, 30, 0.04), 0 8px 24px rgba(26, 28, 30, 0.06)",
        sheet: "0 -8px 40px rgba(26, 28, 30, 0.12)",
      },
      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "panel-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "sheet-up": "sheet-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "panel-in": "panel-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
