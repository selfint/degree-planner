import type { Meta, StoryObj } from '@storybook/sveltekit';
import CatalogPage from '../../routes/app/(withCourseData)/catalog/+page.svelte';
import { getCourseData, pending } from '../../../.storybook/fixtures';
import { baseRouteData, routeState } from './fixtures';

const meta = {
	title: 'Pages/Catalog',
	component: CatalogPage,
	args: { data: { ...baseRouteData, getCourseData } },
	parameters: {
		componentPath: 'src/routes/app/(withCourseData)/catalog/+page.svelte',
		planner: { plan: 'populated' },
		sveltekit_experimental: routeState('/app/catalog')
	}
} satisfies Meta<typeof CatalogPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const EmptyPlan: Story = { parameters: { planner: { plan: 'empty' } } };
export const Loading: Story = {
	parameters: { planner: { loading: true } },
	args: { data: { ...baseRouteData, getCourseData: () => pending<Course>() } }
};
