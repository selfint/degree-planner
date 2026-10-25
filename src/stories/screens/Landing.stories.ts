import type { Meta, StoryObj } from '@storybook/sveltekit';
import LandingPage from '../../routes/+page.svelte';
import { routeState } from './fixtures';

const meta = {
	title: 'Pages/Landing',
	component: LandingPage,
	parameters: {
		componentPath: 'src/routes/+page.svelte',
		covers: [
			'src/lib/components/CourseExplanation.svelte',
			'src/routes/components/ImgDemo.svelte',
			'src/routes/components/FeatureVideo.svelte',
			'src/routes/components/NativeVideo.svelte'
		],
		layout: 'fullscreen',
		sveltekit_experimental: routeState('/')
	}
} satisfies Meta<typeof LandingPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OpeningPlanner: Story = {
	parameters: {
		sveltekit_experimental: {
			...routeState('/'),
			state: {
				...routeState('/').state,
				navigating: {
					to: {
						url: new URL('https://storybook.example/app/'),
						params: {},
						route: { id: '/app' }
					},
					type: 'link',
					willUnload: false,
					complete: new Promise<void>(() => {})
				}
			}
		}
	}
};
