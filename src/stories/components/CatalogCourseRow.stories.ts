import type { Meta, StoryObj } from '@storybook/sveltekit';
import CatalogCourseRow from '$lib/components/CatalogCourseRow.svelte';
import { railCourses } from '../screens/railFixtures';

const meta = {
	title: 'Components/CatalogCourseRow',
	component: CatalogCourseRow,
	parameters: { componentPath: 'src/lib/components/CatalogCourseRow.svelte' },
	args: { courses: railCourses, getNote: () => undefined }
} satisfies Meta<typeof CatalogCourseRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { courses: [] } };
export const WithNote: Story = {
	args: { getNote: () => ({ symbol: '🌟', label: 'Wish list' }) }
};
