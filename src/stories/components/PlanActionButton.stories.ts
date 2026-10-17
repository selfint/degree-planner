import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, within } from 'storybook/test';
import Preview from './PlanActionPreview.svelte';
const meta = {
	title: 'Components/PlanActionButton',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/PlanActionButton.svelte' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Disabled: Story = { args: { disabled: true } };
export const Offline: Story = { parameters: { planner: { online: false } } };
export const Loading: Story = {
	args: { pending: true },
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole('button'));
	}
};
