import * as defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    fontFamily: {
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
      },
    },
    extend: {
      colors: {
        'dark-950': 'rgb(22, 22, 26)',
        'dark-900': 'rgb(25, 25, 29)',
        'dark-800': 'rgb(28, 28, 33)',
        'dark-700': 'rgb(31, 31, 36)',
        'dark-600': 'rgb(34, 34, 39)',
        'dark-500': 'rgb(37, 37, 42)',
        'dark-400': 'rgb(40, 40, 44)',
        'dark-300': 'rgb(43, 43, 47)',
        'dark-200': 'rgb(46, 46, 50)',
        'dark-100': 'rgb(49, 49, 53)',
        'dark-50': 'rgb( 51, 51, 55)',
        'background': '#19191D',
        'card-primary': '#28282C',
        'card-secondary': '#4E4E55',
        'content-primary': '#FFFFFF',
        'content-secondary': '#868D8D',
        'accent-primary': '#4CA9A1',
        'border': '#252529',
      },
    },
  },
  plugins: [],
}

