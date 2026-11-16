import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './StartupLoadingPreview.svelte';
const meta = {
	title: 'User flows/Startup loading',
	component: Preview,
	parameters: {
		layout: 'fullscreen',
		componentPath: 'src/lib/components/ConsoleLoading.svelte'
	}
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ColdEntry: Story = { args: { scenario: 'cold' } };
export const NetworkPause: Story = { args: { scenario: 'paused' } };
export const CachedEntry: Story = { args: { scenario: 'cached' } };
export const UnknownSize: Story = { args: { scenario: 'unknown' } };
export const FailedDownload: Story = { args: { scenario: 'error' } };
