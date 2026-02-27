/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        grotesk: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        secondary: "var(--color-secondary)",
        glow: "var(--color-glow)",
        surface: "var(--color-surface)",
        "surface-alt": "var(--color-surface-alt)",
        base: "var(--color-bg)",
        "base-text": "var(--color-text)",
        "base-text-muted": "var(--color-text-muted)",
        "base-border": "var(--color-border)",
      },
    },
  },
  plugins: [],
}

