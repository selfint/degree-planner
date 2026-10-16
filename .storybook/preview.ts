import type { Preview } from '@storybook/sveltekit';
import '../src/app.css';
import './preview.css';
import StoryFrame from './StoryFrame.svelte';

const preview: Preview = {
	globalTypes: {
		theme: {
			description: 'Application color theme',
			toolbar: {
				icon: 'circlehollow',
				items: ['dark', 'light'],
				dynamicTitle: true
			}
		},
		language: {
			description: 'Language and reading direction',
			toolbar: {
				icon: 'globe',
				items: [
					{ value: 'en', title: 'English · LTR' },
					{ value: 'he', title: 'עברית · RTL' }
				],
				dynamicTitle: true
			}
		}
	},
	initialGlobals: { theme: 'dark', language: 'en' },
	parameters: {
		layout: 'padded',
		controls: { expanded: true },
		viewport: {
			options: {
				mobile: {
					name: 'Mobile (390px)',
					styles: { width: '390px', height: '844px' },
					type: 'mobile'
				},
				desktop: {
					name: 'Desktop',
					styles: { width: '1280px', height: '900px' },
					type: 'desktop'
				}
			}
		}
	},
	decorators: [
		(_story, context) => ({
			Component: StoryFrame,
			props: {
				theme: context.globals.theme,
				language: context.globals.language
			}
		})
	]
};

export default preview;
