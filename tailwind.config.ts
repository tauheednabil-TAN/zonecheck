import type { Config } from "tailwindcss";

/**
 * Palette is fixed by the design brief. See MISSION.md.
 * The map is deliberately muted so the zone overlay and the journey line are
 * the only saturated things on screen.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        green: {
          900: "#0F4429",
          700: "#1B6B3A",
        },
        map: {
          land: "#D4E5C1",
          green: "#C3DDA9",
          urban: "#E8EDE4",
          water: "#AAD3F0",
          road: "#FFFFFF",
          hwy: "#F5B93F",
        },
        accent: "#F5851F",
        ink: {
          DEFAULT: "#1A1A1A",
          muted: "#6B7280",
        },
        surface: "#FFFFFF",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
