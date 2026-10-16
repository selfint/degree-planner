import type { Meta, StoryObj } from '@storybook/sveltekit';
import CoursePreview from './CoursePreview.svelte';

const meta = {
	title: 'Planner/Course cards',
	component: CoursePreview,
	args: { state: 'default' },
	argTypes: {
		state: {
			control: 'select',
			options: ['default', 'loading', 'empty', 'requirements']
		}
	}
} satisfies Meta<typeof CoursePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { state: 'loading' } };
export const Empty: Story = { args: { state: 'empty' } };
export const UnmetRequirements: Story = { args: { state: 'requirements' } };
export const Light: Story = { globals: { theme: 'light' } };
export const HebrewRtl: Story = { globals: { language: 'he' } };
export const Mobile: Story = {
	globals: { viewport: { value: 'mobile', isRotated: false } }
};
