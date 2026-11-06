import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './CourseComponentsPreview.svelte';
const meta = {
	title: 'Components/ScheduleErrorComponent',
	component: Preview,
	parameters: {
		componentPath: 'src/lib/components/ScheduleErrorComponent.svelte'
	},
	args: { kind: 'ScheduleErrorComponent' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllWarnings: Story = { args: { state: 'default' } };
export const NoWarnings: Story = { args: { state: 'empty' } };
export const Season: Story = { args: { state: 'season' } };
export const Adjacent: Story = { args: { state: 'adjacent' } };
export const Exclusive: Story = { args: { state: 'exclusive' } };
export const SatisfiedPrerequisite: Story = { args: { state: 'satisfied' } };
