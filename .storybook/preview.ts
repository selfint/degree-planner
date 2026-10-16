import type { Preview } from '@storybook/sveltekit';
import '../src/app.css';
import './preview.css';
import { cms } from '../src/lib/content';
import { content } from './mocks/preferences.svelte';

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
		(story, context) => {
			document.documentElement.dataset.theme =
				context.globals.theme === 'light' ? 'light' : 'dark';
			content.lang = context.globals.language === 'he' ? cms.he : cms.en;
			document.documentElement.lang = content.lang.lang;
			document.documentElement.dir = content.lang.dir;
			return story();
		}
	]
};

export default preview;
