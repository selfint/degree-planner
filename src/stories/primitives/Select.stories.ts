import type { Meta, StoryObj } from '@storybook/sveltekit';
import SelectPreview from './SelectPreview.svelte';

const meta = {
	title: 'Components/Select',
	component: SelectPreview,
	parameters: { componentPath: 'src/lib/components/Select.svelte' },
	args: { initialValue: '', disabled: false, emptyOptions: false },
	argTypes: {
		initialValue: {
			control: 'select',
			options: ['', 'winter', 'spring', 'summer']
		}
	}
} satisfies Meta<typeof SelectPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unselected: Story = {};
export const Selected: Story = { args: { initialValue: 'spring' } };
export const Disabled: Story = {
	args: { initialValue: 'winter', disabled: true }
};
export const EmptyOptions: Story = { args: { emptyOptions: true } };
