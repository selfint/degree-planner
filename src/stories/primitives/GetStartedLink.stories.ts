import type { Meta, StoryObj } from '@storybook/sveltekit';
import GetStartedLink from '$lib/components/GetStartedLink.svelte';

const meta = {
	title: 'Components/GetStartedLink',
	component: GetStartedLink,
	parameters: { componentPath: 'src/lib/components/GetStartedLink.svelte' }
} satisfies Meta<typeof GetStartedLink>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Navigating: Story = {
	parameters: {
		sveltekit_experimental: {
			state: {
				navigating: {
					to: {
						route: { id: '/app' },
						params: {},
						url: new URL('https://storybook.invalid/app')
					}
				}
			}
		}
	}
};
