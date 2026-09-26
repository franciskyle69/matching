/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./frontend/**/*.{js,jsx,ts,tsx,html}",
    "./templates/**/*.{html,js}",
    "./accounts/templates/**/*.{html,js}",
    "./matching/templates/**/*.{html,js}",
    "./profiles/templates/**/*.{html,js}",
  ],
  theme: {
    extend: {
      colors: {
        darkBase: "#0f172a",
        darkElevated: "#1e1b4b",
        darkCard: "#1e293b",
        lightBase: "#f0f3f8",
        lightCard: "#ffffff",
      },
      boxShadow: {
        neuCardDark: "4px 4px 10px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.05)",
        neuCardLight: "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
        neuInsetDark: "inset 2px 2px 5px rgba(0,0,0,0.3)",
        neuInsetLight: "inset 4px 4px 8px #c5d0e0, inset -4px -4px 8px #ffffff",
      },
      borderRadius: {
        xl: "16px",
      },
    },
  },
  plugins: [],
};
