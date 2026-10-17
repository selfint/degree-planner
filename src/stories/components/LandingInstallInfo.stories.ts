import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, within } from 'storybook/test';
import Preview from './ShellPreview.svelte';
const meta = {
	title: 'Components/LandingInstallInfo',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/LandingInstallInfo.svelte' },
	args: { kind: 'LandingInstallInfo' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Expanded: Story = {
	args: { state: 'expanded' },
	play: async ({ canvasElement }) => {
		await userEvent.click(canvasElement.querySelector('summary')!);
	}
};
