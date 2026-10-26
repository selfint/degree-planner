import type { Meta, StoryObj } from '@storybook/sveltekit';
import CatalogPage from '../../routes/app/(withCourseData)/catalog/+page.svelte';
import { getCourseData, pending } from '../../../.storybook/fixtures';
import { baseRouteData, routeState } from './fixtures';
import { railCourses, railCourseData, getRailCourseData } from './railFixtures';

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
export const NoDegree: Story = {
	parameters: {
		planner: {
			noDegree: true,
			plan: 'empty',
			user: { degree: undefined, path: undefined }
		}
	}
};

export const LongWishlist: Story = {
	args: {
		data: {
			...baseRouteData,
			getCourseData: getRailCourseData,
			courseData: Promise.resolve(railCourseData)
		}
	},
	parameters: {
		planner: {
			plan: 'populated',
			user: { wishlist: railCourses.map((course) => course.code) }
		}
	}
};
