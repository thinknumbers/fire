/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fire-accent': '#E03A3E',
        'fire-heading': '#1A1A1A',
        'fire-text': '#6C6C6C',
        'fire-bg-light': '#F5F5F5',
      }
    },
  },
  plugins: [],
}
