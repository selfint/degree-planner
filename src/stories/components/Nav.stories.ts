import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, within } from 'storybook/test';
import Preview from './ShellPreview.svelte';
const meta = {
	title: 'Components/Nav',
	component: Preview,
	parameters: { componentPath: 'src/routes/components/Nav.svelte' },
	args: { kind: 'Nav' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Active: Story = {
	args: { state: 'active' },
	parameters: {
		sveltekit_experimental: {
			state: { page: { url: new URL('https://storybook.invalid/app/plan') } }
		}
	}
};
