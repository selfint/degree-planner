import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent } from 'storybook/test';
import Preview from './SettingsSectionsPreview.svelte';
const meta = {
	title: 'Components/DegreeSection',
	component: Preview,
	parameters: {
		componentPath:
			'src/routes/app/(withCourseData)/settings/components/DegreeSection.svelte'
	},
	args: { kind: 'DegreeSection' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Offline: Story = { parameters: { planner: { online: false } } };
export const Unselected: Story = { args: { state: 'unselected' } };
export const Recommended: Story = { args: { state: 'recommended' } };
export const LoadingPaths: Story = {
	parameters: { planner: { loading: true } }
};

export const WithPaths: Story = {
	parameters: { planner: { pathChoices: true } }
};
export const SelectedPath: Story = {
	parameters: { planner: { pathChoices: true } },
	args: { state: 'selectedPath' }
};
