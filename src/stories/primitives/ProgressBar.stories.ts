import type { Meta, StoryObj } from '@storybook/sveltekit';
import ProgressBarPreview from './ProgressBarPreview.svelte';

const meta = {
	title: 'Components/ProgressBar',
	component: ProgressBarPreview,
	parameters: { componentPath: 'src/lib/components/ProgressBar.svelte' },
	args: { value: 48, value2: 72, max: 120 },
	argTypes: { color: { control: 'color' } }
} satisfies Meta<typeof ProgressBarPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InProgress: Story = {};
export const Empty: Story = { args: { value: 0, value2: 0 } };
export const PlannedOnly: Story = { args: { value: 0, value2: 72 } };
export const Complete: Story = { args: { value: 120, value2: 120 } };
export const OverTarget: Story = { args: { value: 132, value2: 150 } };
export const NoFixedTarget: Story = { args: { value: 30, value2: 60, max: 0 } };
export const CustomColor: Story = { args: { color: '#8b5cf6' } };
