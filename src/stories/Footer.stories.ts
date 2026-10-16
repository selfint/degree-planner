import type { Meta, StoryObj } from '@storybook/sveltekit';
import FooterPreview from './FooterPreview.svelte';

const meta = {
	title: 'Planner/Footer',
	component: FooterPreview,
	args: { installationHelp: false },
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FooterPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const InstallationHelp: Story = { args: { installationHelp: true } };
export const Light: Story = { globals: { theme: 'light' } };
export const HebrewRtl: Story = { globals: { language: 'he' } };
export const Mobile: Story = {
	globals: { viewport: { value: 'mobile', isRotated: false } }
};
