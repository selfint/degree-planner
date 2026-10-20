import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './CourseComponentsPreview.svelte';
const meta = {
	title: 'Components/CourseRow',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/CourseRow.svelte' },
	args: { kind: 'CourseRow' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Sortable: Story = { args: { state: 'sortable' } };
export const Indented: Story = { args: { state: 'indented' } };
