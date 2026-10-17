import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './PwaStatusPreview.svelte';
const meta = {
	title: 'Components/PwaStatus',
	component: Preview,
	parameters: {
		componentPath: 'src/lib/components/PwaStatusView.svelte',
		covers: ['src/lib/components/PwaStatus.svelte']
	}
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Preparing: Story = { args: { state: 'preparing' } };
export const Initial: Story = { args: { state: 'initial' } };
export const Ready: Story = { args: { state: 'ready' } };
export const Unavailable: Story = { args: { state: 'unavailable' } };
export const Outdated: Story = { args: { state: 'outdated' } };
export const Update: Story = { args: { state: 'update' } };
