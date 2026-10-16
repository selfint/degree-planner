import type { Meta, StoryObj } from '@storybook/sveltekit';
import ControlsPreview from './ControlsPreview.svelte';

const meta = {
	title: 'Planner/Controls',
	component: ControlsPreview,
	args: { disabled: false, loading: false, empty: false }
} satisfies Meta<typeof ControlsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { empty: true } };
export const Light: Story = { globals: { theme: 'light' } };
export const HebrewRtl: Story = { globals: { language: 'he' } };
export const Mobile: Story = {
	globals: { viewport: { value: 'mobile', isRotated: false } }
};
