/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    fontFamily: {
      sans: ['Graphik', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
    },
    boxShadow: {
      DEFAULT: '2px 2px 0 rgba(0, 0, 0, 1)',
      lg: '8px 8px 0 rgba(0, 0, 0, 1)'
    },
    extend: {},
  },
  plugins: [],
}

