import type { Meta, StoryObj } from '@storybook/sveltekit';
import StagingBanner from '$lib/components/StagingBanner.svelte';

const meta = {
	title: 'Components/StagingBanner',
	component: StagingBanner,
	parameters: {
		componentPath: 'src/lib/components/StagingBanner.svelte'
	}
} satisfies Meta<typeof StagingBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Compact header label; no services or storage are started. */
export const HeaderLabel: Story = {};
