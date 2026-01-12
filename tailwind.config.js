/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fire-accent': 'var(--color-fire-accent)', 
        'fire-heading': 'var(--color-fire-heading)',
        'fire-text': 'var(--color-fire-text)',
        'fire-text-secondary': 'var(--color-fire-text-secondary)',
        'fire-bg-light': 'var(--color-fire-bg-light)',
        'fire-navy': 'var(--color-fire-navy)',
        'fire-orange': 'var(--color-fire-orange)',
      },
      fontFamily: {
        sans: ['var(--font-main)', 'Calibri', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
