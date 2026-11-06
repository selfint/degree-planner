import type { Meta, StoryObj } from '@storybook/sveltekit';
import Arrow from '$lib/components/Arrow.svelte';

const meta = {
	title: 'Components/Arrow',
	component: Arrow,
	parameters: { componentPath: 'src/lib/components/Arrow.svelte' },
	args: {
		class: 'h-3 w-6 text-content-primary',
		role: 'img',
		'aria-label': 'Expand'
	}
} satisfies Meta<typeof Arrow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Collapsed: Story = {};
export const Expanded: Story = {
	args: {
		class: 'h-3 w-6 rotate-180 text-content-primary',
		'aria-label': 'Collapse'
	}
};
