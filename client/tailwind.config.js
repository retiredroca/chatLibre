/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kf-bg-primary': '#0D1117',
        'kf-bg-secondary': '#161B22',
        'kf-bg-tertiary': '#21262D',
        'kf-text-primary': '#E6EDF3',
        'kf-text-secondary': '#8B949E',
        'kf-accent': '#58A6FF',
        'kf-success': '#3FB950',
        'kf-warning': '#D29922',
        'kf-danger': '#F85149',
        'kf-encryption': '#A371F7',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
