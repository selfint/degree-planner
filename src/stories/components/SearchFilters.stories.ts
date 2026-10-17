import type { Meta, StoryObj } from '@storybook/sveltekit';
import Preview from './SearchFiltersPreview.svelte';
const meta = {
	title: 'Components/SearchFilters',
	component: Preview,
	parameters: { componentPath: 'src/lib/components/SearchFilters.svelte' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { selected: true, expanded: true } };
export const EmptyFaculties: Story = { args: { empty: true, expanded: true } };
export const UnknownFaculty: Story = {
	args: { selected: true, unknownFaculty: true, expanded: true }
};

export const Expanded: Story = { args: { expanded: true } };
export const CollapsedWithFilters: Story = { args: { selected: true } };
