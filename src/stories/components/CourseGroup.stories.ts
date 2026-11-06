import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './CourseGroupPreview.svelte';
const meta = {
	title: 'Components/CourseGroup',
	component: Preview,
	parameters: {
		componentPath:
			'src/routes/app/(withCourseData)/catalog/components/CourseGroup.svelte'
	}
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Error: Story = { args: { state: 'error' } };

export const MultipleGroups: Story = { args: { state: 'multipleGroups' } };
