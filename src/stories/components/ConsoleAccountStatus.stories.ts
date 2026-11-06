import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './ConsoleAccountStatusPreview.svelte';
const meta = {
	title: 'Components/ConsoleAccountStatus',
	component: Preview,
	parameters: {
		componentPath: 'src/lib/components/ConsoleAccountStatus.svelte'
	}
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Offline: Story = { args: { state: 'offline' } };
export const AuthPending: Story = { args: { state: 'authPending' } };
export const AccountUnavailable: Story = {
	args: { state: 'accountUnavailable' }
};
export const OfflineAccountUnavailable: Story = {
	args: { state: 'offlineAccountUnavailable' }
};
