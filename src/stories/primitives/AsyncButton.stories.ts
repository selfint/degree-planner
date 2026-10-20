import type { Meta, StoryObj } from '@storybook/sveltekit';
import { tick } from 'svelte';
import AsyncButtonPreview from './AsyncButtonPreview.svelte';

const meta = {
	title: 'Components/AsyncButton',
	component: AsyncButtonPreview,
	parameters: { componentPath: 'src/lib/components/AsyncButton.svelte' },
	args: { variant: 'primary', disabled: false, sharedNamespace: false },
	argTypes: {
		variant: { control: 'select', options: ['primary', 'secondary'] }
	}
} satisfies Meta<typeof AsyncButtonPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
const startAction: Story['play'] = async ({ canvasElement }) => {
	const button = canvasElement.querySelector<HTMLButtonElement>('button');
	if (!button) throw new Error('The AsyncButton action is missing.');
	button.click();
	await tick();
	if (button.getAttribute('aria-busy') !== 'true' || !button.disabled) {
		throw new Error('The AsyncButton did not enter its loading state.');
	}
};
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { play: startAction };
export const SharedActionLock: Story = {
	args: { sharedNamespace: true },
	play: startAction
};
