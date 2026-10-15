import * as defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		fontFamily: {
			sans: ['Noto Sans Hebrew', ...defaultTheme.fontFamily.sans]
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
				background: 'rgb(var(--color-background) / <alpha-value>)',
				'card-primary': 'rgb(var(--color-card-primary) / <alpha-value>)',
				'card-secondary': 'rgb(var(--color-card-secondary) / <alpha-value>)',
				'content-primary': 'rgb(var(--color-content-primary) / <alpha-value>)',
				'content-secondary':
					'rgb(var(--color-content-secondary) / <alpha-value>)',
				'accent-primary': 'rgb(var(--color-accent-primary) / <alpha-value>)',
				border: 'rgb(var(--color-border) / <alpha-value>)',
				'content-on-accent':
					'rgb(var(--color-content-on-accent) / <alpha-value>)',
				link: 'rgb(var(--color-link) / <alpha-value>)'
			}
		}
	},
	plugins: []
};
