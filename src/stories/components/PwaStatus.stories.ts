import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './PwaStatusPreview.svelte';
const meta = {
	title: 'Components/PwaStatus',
	component: Preview,
	parameters: {
		sveltekit_experimental: {
			hrefs: {
				'#offline-status': () =>
					document.getElementById('offline-status')?.focus()
			}
		},
		componentPath: 'src/lib/components/PwaStatusView.svelte',
		covers: [
			'src/lib/components/PwaStatus.svelte',
			'src/lib/components/PwaStatusDetails.svelte',
			'src/lib/components/PwaUpdateBanner.svelte',
			'src/lib/components/FooterVersion.svelte'
		]
	}
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Preparing: Story = { args: { state: 'preparing' } };
export const Initial: Story = { args: { state: 'initial' } };
export const Ready: Story = { args: { state: 'ready' } };
export const Offline: Story = { args: { state: 'offline' } };
export const OfflineUpdate: Story = { args: { state: 'offlineUpdate' } };
export const Unavailable: Story = { args: { state: 'unavailable' } };
export const Outdated: Story = { args: { state: 'outdated' } };
export const Update: Story = { args: { state: 'update' } };
export const UnsavedPlanUpdate: Story = { args: { state: 'updateDirty' } };
export const SavingPlanUpdate: Story = { args: { state: 'updateSaving' } };
export const ApplyingUpdate: Story = { args: { state: 'updateApplying' } };
export const OtherTabsUpdate: Story = { args: { state: 'updateOtherTabs' } };

export const CachedRefreshFailure: Story = { args: { state: 'refresh' } };
export const UpdateRefreshFailure: Story = { args: { state: 'refreshUpdate' } };
export const CachedRefreshShellUnavailable: Story = {
	args: { state: 'refreshShellUnavailable' }
};

// Real failure states use the shared theme, language, and direction controls.
export const ShellFailure: Story = {
	args: { state: 'shellUnavailable' }
};
export const ShellFailureDetails: Story = {
	args: { state: 'shellUnavailable', showErrorDetails: true }
};
