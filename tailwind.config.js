/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fire-accent': '#E84E1B', // Vibrant Orange
        'fire-heading': '#1C2E4A', // Deep Navy Blue
        'fire-text': '#333333', // Charcoal / Dark Grey
        'fire-text-secondary': '#707070', // Medium Grey
        'fire-bg-light': '#F2F2F2', // Light Grey / Off-White
        'fire-navy': '#1C2E4A',
        'fire-orange': '#E84E1B',
      }
    },
  },
  plugins: [],
}
