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
			description: 'Application language',
			toolbar: {
				icon: 'globe',
				items: [
					{ value: 'en', title: 'English' },
					{ value: 'he', title: 'עברית' }
				],
				dynamicTitle: true
			}
		},
		direction: {
			description: 'Reading direction',
			toolbar: {
				icon: 'transfer',
				items: [
					{ value: 'auto', title: 'Language default' },
					{ value: 'ltr', title: 'Left to right' },
					{ value: 'rtl', title: 'Right to left' }
				],
				dynamicTitle: true
			}
		}
	},
	initialGlobals: { theme: 'dark', language: 'en', direction: 'auto' },
	parameters: {
		layout: 'padded',
		controls: { expanded: true }
	},
	afterEach: async ({ id }) => {
		document
			.querySelector('[data-story-ready]')
			?.setAttribute('data-story-rendered', id);
	},
	decorators: [
		(_story, context) => ({
			Component: StoryFrame,
			props: {
				theme: context.globals.theme,
				language: context.globals.language,
				direction: context.globals.direction,
				storyId: context.id,
				planner: context.parameters.planner ?? {},
				pageUrl: context.parameters.sveltekit_experimental?.state?.page?.url
			}
		})
	]
};

export default preview;
