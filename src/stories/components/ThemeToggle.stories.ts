import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, within } from 'storybook/test';
import Preview from './ShellPreview.svelte';
const meta = {
	title: 'Components/ThemeToggle',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/ThemeToggle.svelte' },
	args: { kind: 'ThemeToggle' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Compact: Story = { args: { state: 'compact' } };
