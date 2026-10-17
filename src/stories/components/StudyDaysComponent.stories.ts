import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './CourseComponentsPreview.svelte';
const meta = {
	title: 'Components/StudyDaysComponent',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/StudyDaysComponent.svelte' },
	args: { kind: 'StudyDaysComponent' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const SingleCourse: Story = { args: { state: 'oneExam' } };
export const Highlighted: Story = { args: { state: 'highlighted' } };
