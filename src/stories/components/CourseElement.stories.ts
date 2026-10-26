import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, waitFor, expect } from 'storybook/test';
import Preview from './CourseComponentsPreview.svelte';
const meta = {
	title: 'Components/CourseElement',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/CourseElement.svelte' },
	args: { kind: 'CourseElement' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Compact: Story = { args: { state: 'compact' } };
export const Loading: Story = { args: { state: 'loading' } };
export const MissingDetails: Story = { args: { state: 'missingDetails' } };
export const NoExams: Story = { args: { state: 'noExams' } };
export const WithNote: Story = { args: { state: 'note' } };
export const StudyDays: Story = { args: { state: 'studyDays' } };
export const CheckingRequirements: Story = { args: { state: 'checking' } };
export const UnmetRequirements: Story = { args: { state: 'requirements' } };
export const Unavailable: Story = { args: { state: 'unavailable' } };

export const Interactive: Story = { args: { state: 'interactive' } };
export const InteractiveWarning: Story = {
	args: { state: 'interactiveRequirements' }
};
export const ExpandedRequirements: Story = {
	args: { state: 'requirements' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('button[aria-expanded]')
			).not.toBeNull()
		);
		await userEvent.click(
			canvasElement.querySelector('button[aria-expanded]')!
		);
		await expect(
			canvasElement.querySelector('button[aria-expanded]')
		).toHaveAttribute('aria-expanded', 'true');
	}
};
