/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aura-purple': '#8B5CF6',
        'aura-pink': '#EC4899',
        'aura-orange': '#F97316',
      },
      backgroundImage: {
        'gradient-aura': 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F97316 100%)',
      },
    },
  },
  plugins: [],
}
