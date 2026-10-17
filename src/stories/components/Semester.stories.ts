import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, waitFor, expect } from 'storybook/test';
import Preview from './CourseComponentsPreview.svelte';
const meta = {
	title: 'Components/Semester',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/Semester.svelte' },
	args: { kind: 'Semester' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Current: Story = { args: { state: 'current' } };
export const ExpandedExams: Story = {
	args: { state: 'current' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.semester-exams summary')
			).not.toBeNull()
		);
		await userEvent.click(
			canvasElement.querySelector('.semester-exams summary')!
		);
		await waitFor(() =>
			expect(canvasElement.querySelector('.semester-exams')).toHaveAttribute(
				'open'
			)
		);
	}
};
export const Summer: Story = { args: { state: 'summer' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const ExcludedFromSummary: Story = { args: { state: 'excluded' } };
export const Sortable: Story = { args: { state: 'sortable' } };
export const Linked: Story = { args: { state: 'linked' } };
