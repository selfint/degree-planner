import type { Meta, StoryObj } from '@storybook/sveltekit';
import CourseWidthPreview from './CourseWidthPreview.svelte';

const meta = {
	title: 'Components/CourseWidth',
	component: CourseWidthPreview,
	parameters: { componentPath: 'src/lib/components/CourseWidth.svelte' },
	args: { longContent: false }
} satisfies Meta<typeof CourseWidthPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LongContent: Story = { args: { longContent: true } };
