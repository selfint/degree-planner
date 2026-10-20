import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './CourseComponentsPreview.svelte';
const meta = {
	title: 'Components/RequirementsElement',
	component: Preview,
	parameters: {
		componentPath: 'src/lib/components/RequirementsElement.svelte'
	},
	args: { kind: 'RequirementsElement' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: 'default' } };
export const Single: Story = { args: { state: 'single' } };
export const Empty: Story = { args: { state: 'empty' } };
export const LastOnly: Story = { args: { state: 'lastOnly' } };
export const Truncated: Story = { args: { state: 'truncated' } };
