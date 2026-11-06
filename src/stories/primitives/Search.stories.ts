import type { Meta, StoryObj } from '@storybook/sveltekit';
import { tick } from 'svelte';
import SearchPreview from './SearchPreview.svelte';

const meta = {
	title: 'Components/Search',
	component: SearchPreview,
	parameters: { componentPath: 'src/lib/components/Search.svelte' }
} satisfies Meta<typeof SearchPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Focused: Story = {
	play: async ({ canvasElement }) => {
		canvasElement.querySelector<HTMLInputElement>('input')?.focus();
		await tick();
	}
};
export const WithQuery: Story = {
	play: async ({ canvasElement }) => {
		const input = canvasElement.querySelector<HTMLInputElement>('input');
		if (!input) throw new Error('The Search input is missing.');
		input.focus();
		input.value = 'Calculus';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
	}
};
export const Submitted: Story = {
	play: async ({ canvasElement }) => {
		const input = canvasElement.querySelector<HTMLInputElement>('input');
		if (!input) throw new Error('The Search input is missing.');
		input.value = '104031';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		canvasElement.querySelector('form')?.requestSubmit();
		await tick();
	}
};
