import type { Meta, StoryObj } from '@storybook/sveltekit';
import SearchIcon from '$lib/components/SearchIcon.svelte';

const meta = {
	title: 'Components/SearchIcon',
	component: SearchIcon,
	parameters: { componentPath: 'src/lib/components/SearchIcon.svelte' },
	args: {
		class: 'h-5 w-5 text-content-secondary',
		role: 'img',
		'aria-label': 'Search'
	}
} satisfies Meta<typeof SearchIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Active: Story = {
	args: { class: 'h-5 w-5 text-content-primary' }
};
