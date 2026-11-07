import type { Meta, StoryObj } from '@storybook/sveltekit';
import UnavailableCurriculum from '$lib/components/UnavailableCurriculum.svelte';
const meta = {
	title: 'Components/UnavailableCurriculum',
	component: UnavailableCurriculum,
	parameters: {
		componentPath: 'src/lib/components/UnavailableCurriculum.svelte'
	}
} satisfies Meta<typeof UnavailableCurriculum>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
