import type { Meta, StoryObj } from '@storybook/sveltekit';
import SearchPage from '../../routes/app/(withFullCourseData)/search/+page.svelte';
import { courses, pending } from '../../../.storybook/fixtures';
import { baseRouteData, failed, routeState } from './fixtures';

const data = { ...baseRouteData, fullCourseData: Promise.resolve(courses) };
const meta = {
	title: 'Pages/Search',
	component: SearchPage,
	args: { data },
	parameters: {
		componentPath: 'src/routes/app/(withFullCourseData)/search/+page.svelte',
		planner: { plan: 'populated', personalPlanReady: true },
		sveltekit_experimental: routeState('/app/search?q=Example')
	}
} satisfies Meta<typeof SearchPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {};
export const NoResults: Story = {
	parameters: {
		sveltekit_experimental: routeState('/app/search?q=no-matching-course')
	}
};
export const FilteredResults: Story = {
	parameters: {
		sveltekit_experimental: routeState(
			'/app/search?q=Example&available=&pointsMin=3&medianMin=80'
		)
	}
};
export const EmptyCatalog: Story = {
	args: { data: { ...data, fullCourseData: Promise.resolve([]) } }
};
export const Loading: Story = {
	args: { data: { ...data, fullCourseData: pending<FullCourse[]>() } }
};
export const LoadFailed: Story = {
	args: {
		data: {
			...data,
			fullCourseData: failed<FullCourse[]>('Example course catalog failure')
		}
	}
};
export const ReadOnly: Story = {
	parameters: { planner: { personalPlanReady: false, online: false } }
};
