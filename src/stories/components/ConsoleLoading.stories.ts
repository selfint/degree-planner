import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './ConsoleLoadingPreview.svelte';
const meta = {
	title: 'Components/ConsoleLoading',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/ConsoleLoading.svelte' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Courses: Story = {};
export const Opening: Story = { args: { phase: 'opening' } };
