import type { Meta, StoryObj } from '@storybook/sveltekit';
import UserFlowVideo from '../../routes/components/UserFlowVideo.svelte';
const meta = {
	title: 'User flows/Student journeys',
	component: UserFlowVideo,
	parameters: {
		layout: 'padded',
		componentPath: 'src/routes/components/UserFlowVideo.svelte'
	},
	argTypes: { topic: { control: false } }
} satisfies Meta<typeof UserFlowVideo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RecoverSetupAndReopen: Story = {
	args: { topic: 'setup-recovery' }
};
export const ShareWithIndependentGuest: Story = {
	args: { topic: 'independent-share' }
};
export const ChooseCurrentBeforeImport: Story = {
	args: { topic: 'shorter-import' }
};
export const SafelyShortenPlan: Story = { args: { topic: 'safe-shortening' } };
