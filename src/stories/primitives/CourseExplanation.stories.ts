import type { Meta, StoryObj } from '@storybook/sveltekit';
import CourseExplanation from '$lib/components/CourseExplanation.svelte';

const meta = {
	title: 'Components/CourseExplanation',
	component: CourseExplanation,
	parameters: { componentPath: 'src/lib/components/CourseExplanation.svelte' },
	args: {
		width: 265,
		height: 141,
		role: 'img',
		'aria-label': 'Explanation of course card details'
	}
} satisfies Meta<typeof CourseExplanation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
