import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './ConsoleLoadingPreview.svelte';
const meta = {
	title: 'Components/ConsoleLoading',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/ConsoleLoading.svelte' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Courses: Story = {
	args: {
		state: {
			phase: 'data',
			completed: 1,
			total: 2,
			pending: ['/courseData.json']
		}
	}
};
export const Opening: Story = { args: { state: { phase: 'opening' } } };
export const CheckingSavedData: Story = {
	args: { state: { phase: 'checking' } }
};
export const Catalogs: Story = {
	args: {
		state: {
			phase: 'data',
			completed: 1,
			total: 2,
			pending: ['/catalogs.json']
		}
	}
};
export const Finishing: Story = { args: { state: { phase: 'finishing' } } };
export const Failed: Story = { args: { state: { phase: 'error' } } };
