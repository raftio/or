/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        grotesk: ["Space Grotesk", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}

