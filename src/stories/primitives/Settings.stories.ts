import type { Meta, StoryObj } from '@storybook/sveltekit';
import Settings from '$lib/components/Settings.svelte';

const meta = {
	title: 'Components/Settings',
	component: Settings,
	parameters: { componentPath: 'src/lib/components/Settings.svelte' },
	args: { class: 'text-content-primary', role: 'img', 'aria-label': 'Settings' }
} satisfies Meta<typeof Settings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
