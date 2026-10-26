import type { Meta, StoryObj } from '@storybook/sveltekit';
import ButtonPreview from './ButtonPreview.svelte';

const meta = {
	title: 'Components/Button',
	component: ButtonPreview,
	parameters: { componentPath: 'src/lib/components/Button.svelte' },
	args: { variant: 'primary', disabled: false },
	argTypes: {
		variant: { control: 'select', options: ['primary', 'secondary'] }
	}
} satisfies Meta<typeof ButtonPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const DisabledPrimary: Story = { args: { disabled: true } };
export const DisabledSecondary: Story = {
	args: { variant: 'secondary', disabled: true }
};
