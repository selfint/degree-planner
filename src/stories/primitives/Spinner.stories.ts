import type { Meta, StoryObj } from '@storybook/sveltekit';
import SpinnerPreview from './SpinnerPreview.svelte';

const meta = {
	title: 'Components/Spinner',
	component: SpinnerPreview,
	parameters: { componentPath: 'src/lib/components/Spinner.svelte' },
	args: { size: 'compact' },
	argTypes: { size: { control: 'select', options: ['compact', 'large'] } }
} satisfies Meta<typeof SpinnerPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compact: Story = {};
export const Large: Story = { args: { size: 'large' } };
