import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7f6",
          100: "#dbecea",
          200: "#bad9d6",
          300: "#8fbfba",
          400: "#5f9f99",
          500: "#43837e",
          600: "#356a66",
          700: "#2d5652",
          800: "#274744",
          900: "#233c3a",
        },
        sand: {
          50: "#faf9f6",
          100: "#f3f1ea",
          200: "#e7e3d6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(35, 60, 58, 0.06), 0 8px 24px rgba(35, 60, 58, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
