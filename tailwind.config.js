/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        palette: {
          violet: '#5003C0',
          'violet-hover': '#6814E0',
          'violet-subtle': 'rgba(80, 3, 192, 0.15)',
          'violet-border': 'rgba(80, 3, 192, 0.35)',
          magenta: '#AB03A9',
          'magenta-hover': '#C413C2',
          'pink-red': '#FF467A',
          'pink-red-hover': '#FF6591',
          yellow: '#FFD51E',
          'yellow-hover': '#FFE054',
          page: '#0D0620',
          card: '#160B30',
          raised: '#1F1240',
          surface: '#1A0E38',
          border: '#2E195E',
          'border-subtle': '#25134A',
          'text-primary': '#F4EFFF',
          'text-secondary': '#B9AEDB',
          'text-muted': '#8E82B0',
        },
        // Strict mapping of color families to the user's exact palette
        slate: {
          950: '#0D0620', // Page background
          900: '#160B30', // Cards / primary panels
          850: '#1A0E38', // Elevated cards
          800: '#1F1240', // Raised elements / secondary cards
          750: '#27164D', // Inputs
          700: '#331E63', // Borders / dividers
          600: '#4D2F8F', // Violet highlights
          500: '#7558B5', // Lavender mid-tone
          400: '#B9AEDB', // Secondary text (muted lavender-grey)
          300: '#D5CCEB', // Light lavender
          200: '#E8E1F7', // Off-white
          100: '#F4EFFF', // Primary text (near-white)
          50: '#FAF7FF',
        },
        amber: {
          950: '#160B30',
          900: '#1F1240',
          800: '#27164D',
          700: '#3D0290',
          600: '#5003C0',
          500: '#FFD51E', // Yellow
          400: '#FFD51E', // Yellow accent
          300: '#FFE054',
          200: '#FFF0A0',
          100: '#F4EFFF',
        },
        sky: {
          950: '#160B30',
          900: '#1F1240',
          800: '#27164D',
          700: '#4002A0',
          600: '#5003C0', // Violet primary CTA
          500: '#AB03A9', // Magenta
          400: '#AB03A9', // Magenta accent
          300: '#C413C2',
          200: '#E8E1F7',
          100: '#F4EFFF',
        },
        rose: {
          950: '#160B30',
          900: '#1F1240',
          800: '#27164D',
          700: '#B01844',
          600: '#D9285C',
          500: '#FF467A', // Pink-red
          400: '#FF467A', // Pink-red key numbers/alerts
          300: '#FF6591',
          200: '#FF94B4',
          100: '#F4EFFF',
        },
        emerald: {
          950: '#160B30',
          900: '#1F1240',
          800: '#27164D',
          700: '#4002A0',
          600: '#5003C0',
          500: '#FFD51E', // Yellow badge
          400: '#FFD51E',
          300: '#FFE054',
          200: '#FFF0A0',
          100: '#F4EFFF',
        },
        purple: {
          950: '#160B30',
          900: '#1F1240',
          800: '#27164D',
          700: '#4002A0',
          600: '#5003C0',
          500: '#AB03A9', // Magenta
          400: '#AB03A9',
          300: '#C413C2',
          200: '#F4EFFF',
        },
        cyan: {
          950: '#160B30',
          900: '#1F1240',
          800: '#27164D',
          700: '#4002A0',
          600: '#5003C0',
          500: '#B9AEDB',
          400: '#B9AEDB',
          300: '#F4EFFF',
        },
      },
    },
  },
  plugins: [],
}
