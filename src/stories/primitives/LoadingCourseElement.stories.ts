import type { Meta, StoryObj } from '@storybook/sveltekit';
import LoadingCourseElementPreview from './LoadingCourseElementPreview.svelte';

const meta = {
	title: 'Components/LoadingCourseElement',
	component: LoadingCourseElementPreview,
	parameters: {
		componentPath: 'src/lib/components/LoadingCourseElement.svelte'
	},
	args: { squeeze: false, withNote: false }
} satisfies Meta<typeof LoadingCourseElementPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Squeezed: Story = { args: { squeeze: true } };
export const WithNote: Story = { args: { withNote: true } };
