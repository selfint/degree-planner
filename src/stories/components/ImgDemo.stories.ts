import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, within } from 'storybook/test';
import Preview from './ShellPreview.svelte';
const meta = {
	title: 'Components/ImgDemo',
	component: Preview,
	parameters: { componentPath: 'src/routes/components/ImgDemo.svelte' },
	args: { kind: 'ImgDemo' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const LongText: Story = { args: { state: 'longText' } };
