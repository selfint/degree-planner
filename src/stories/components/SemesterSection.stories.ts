import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent } from 'storybook/test';
import Preview from './SettingsSectionsPreview.svelte';
const meta = {
	title: 'Components/SemesterSection',
	component: Preview,
	parameters: {
		componentPath:
			'src/routes/app/(withCourseData)/settings/components/SemesterSection.svelte'
	},
	args: { kind: 'SemesterSection' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Offline: Story = { parameters: { planner: { online: false } } };
export const UnsavedChanges: Story = { args: { state: 'changed' } };
